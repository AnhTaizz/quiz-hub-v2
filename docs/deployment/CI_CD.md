# QuizHub V2 — CI/CD Pipeline

This document explains the delivery pipeline introduced in the backend
closing sprint's follow-up: continuous integration on every PR/push, an
immutable container image published to GHCR on `main`, and a manual,
rollback-aware production deployment workflow.

## 1. Pipeline overview

```text
PR / push to main
      │
      ▼
  Backend Tests  (Java 21, mvnw clean package, full Testcontainers suite)
      │
      ▼
  Container Smoke Test  (real Dockerfile + docker-compose.yml, health-checked)
      │
      ▼ (push to main only)
  Publish Image  (ghcr.io/<owner>/<repo>:latest and :sha-<short-sha>)
      │
      ▼ (manual, separate workflow)
  Deploy Production  (workflow_dispatch → SSH → docker compose → health → rollback)
```

CI is defined in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).
CD is defined in [`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml).

## 2. CI jobs

| Job | Runs on | What it proves |
| :--- | :--- | :--- |
| **Backend Tests** | every PR to `main`, every push to `main`, manual | The full Maven suite (Testcontainers against real PostgreSQL) passes and the jar packages successfully. |
| **Container Smoke Test** | after Backend Tests succeeds | The *actual* Dockerfile builds, the *actual* `docker-compose.yml` stack starts, PostgreSQL and the app both report healthy, the app container runs as a non-root user, and `GET /actuator/health` returns `200 {"status":"UP"}` over real HTTP. |
| **Publish Image** | push to `main` only, after both jobs above succeed | Builds and pushes `ghcr.io/<owner>/<repo>:latest` and `:sha-<short-sha>` using `GITHUB_TOKEN` (no PAT), with OCI labels, build provenance, and an SBOM attached. |

The smoke-test stage generates its own throwaway credentials on the runner
(random DB password, random JWT secret, dummy OAuth/mail/Gemini values) — it
never touches repository or production secrets, so **CI passes unmodified on
pull requests from forks**.

## 3. GitHub repository settings to configure

### 3.1 Production environment

```text
Settings → Environments → New environment → "production"
```

Then:

- Add the deployment secrets listed in section 4 below as **environment
  secrets** (not repository secrets), scoped to `production`.
- Optionally require one or more reviewers before a deployment run can
  proceed.
- Restrict which branches/tags may deploy to this environment to `main`.

`deploy-production.yml` references `environment: production`, so these
settings apply automatically once the environment exists.

### 3.2 Recommended branch protection for `main`

```text
Settings → Branches → Branch protection rules → main
```

Recommended policy:

- Require a pull request before merging.
- Require status checks to pass before merging, specifically:
  - `Backend Tests`
  - `Container Smoke Test`
- Optionally require branches to be up to date before merging.
- Block force pushes to `main`.

These check names must match the `name:` fields of the jobs in `ci.yml`
exactly. This repository does not enable branch protection automatically —
apply it manually once you've confirmed the check names above match a real
CI run.

## 4. GitHub Actions secrets (production environment)

Only secret **names** are documented here — never commit real values.

| Secret | Meaning |
| :--- | :--- |
| `DEPLOY_HOST` | Production server DNS name or IP address. |
| `DEPLOY_USER` | Non-root SSH deployment user on the server. |
| `DEPLOY_PORT` | SSH port. |
| `DEPLOY_SSH_KEY` | Private SSH key used to authenticate as `DEPLOY_USER`. |
| `DEPLOY_KNOWN_HOSTS` | The server's trusted SSH host-key entry (output of `ssh-keyscan`), used instead of disabling host-key checking. |
| `DEPLOY_PATH` | Absolute path on the server holding `docker-compose.prod.yml` and `.env.production`, e.g. `/opt/quizhub`. |

`deploy-production.yml` never sets `StrictHostKeyChecking=no`. It writes
`DEPLOY_KNOWN_HOSTS` into `~/.ssh/known_hosts` on the runner and passes
`-o UserKnownHostsFile=~/.ssh/known_hosts` to every `ssh`/`scp` call.

## 5. Production server bootstrap

Target: any Linux server/VPS. Commands below are Debian/Ubuntu examples;
adapt package names for other distributions.

```bash
# 1. Install Docker Engine + the Compose plugin (see docs.docker.com/engine/install)

# 2. Create a non-root deployment user (matches DEPLOY_USER)
sudo useradd -m -s /bin/bash quizhub-deploy
sudo usermod -aG docker quizhub-deploy

# 3. Create the deployment directory (matches DEPLOY_PATH)
sudo mkdir -p /opt/quizhub
sudo chown quizhub-deploy:quizhub-deploy /opt/quizhub

# 4. As quizhub-deploy, add the GitHub Actions runner's public key to
#    ~/.ssh/authorized_keys, and register the server's own host key as
#    the DEPLOY_KNOWN_HOSTS secret value:
ssh-keyscan -p <DEPLOY_PORT> <DEPLOY_HOST>

# 5. Copy the production env template and fill in real values
cp deploy/.env.production.example /opt/quizhub/.env.production
chmod 600 /opt/quizhub/.env.production
```

`.env.production` lives **only** on the server and is never committed —
see [`deploy/.env.production.example`](../../deploy/.env.production.example)
for the full list of placeholders it must contain.

The first deployment run copies `docker-compose.prod.yml` and
`deploy/remote-deploy.sh` into `DEPLOY_PATH` automatically; nothing else
needs to be pre-staged on the server beyond the two steps above.

## 6. GHCR access from the server

### Public package (default expectation)

```bash
docker pull ghcr.io/anhtaizz/quiz-hub-v2:latest
```

works without any credentials once the package is public.

### Private package

If the package is kept private, authenticate **on the server** with a
read-only, appropriately scoped token before the first pull:

```bash
echo "<token>" | docker login ghcr.io -u <github-username> --password-stdin
```

Do this once, interactively, on the server itself — never pass a reusable
GHCR credential through the deploy workflow on every run, and never commit
it.

## 7. Rollback model

`deploy/remote-deploy.sh` (invoked by `deploy-production.yml`):

1. Records the currently running `quizhub-backend` image (if any).
2. Pulls and starts the requested image.
3. Polls container health (PostgreSQL + app) — no fixed sleep.
4. If the new image becomes healthy, the deployment succeeds.
5. If it does not, the script redeploys the previously running image and
   polls health again, then always exits non-zero so the GitHub Actions run
   is shown as failed either way (a successful rollback is still a failed
   *deployment*).

**Important limitation:** this rolls back the application container image
only. Flyway database migrations already applied by a failed deployment are
**not** automatically reversed. Write migrations with backward-compatible
deployment discipline in mind (e.g. additive changes first, destructive
changes in a later release) so an application rollback remains safe against
the newer schema.

## 8. Manual deployment procedure

```text
GitHub → Actions → Deploy Production → Run workflow
  branch: main
  image_tag: (optional — defaults to sha-<short SHA of the selected branch>)
```

Deployment is **never** automatic on push to `main` — only the image publish
step is. A human explicitly triggers `Deploy Production` when ready.

### 8.1 Only immutable `sha-<git-sha>` tags are deployable

The `Resolve image tag` step validates the resolved tag against
`^sha-[0-9a-f]{7,40}$` and fails the run if it doesn't match. This applies
whether the tag came from the `image_tag` input or from the default
(`sha-$(git rev-parse --short HEAD)`).

`Publish Image` also pushes a `latest` tag to GHCR for convenience (e.g.
manually pulling the newest build), but `Deploy Production` intentionally
refuses to deploy `latest`, or any other non-SHA tag: production deployments
must stay traceable to an exact commit, and accepting free-form tag text
into a workflow that ultimately runs on a remote server over SSH would let
arbitrary input reach a shell command.

## 9. Current status

As of this pipeline being introduced, no production server or `production`
environment secrets have been configured in this repository. The CI and
image-publishing pipeline is fully functional; production deployment is
implemented and ready to use once a real server and its secrets exist
(`CI_READY_CD_PENDING_INFRA`).
