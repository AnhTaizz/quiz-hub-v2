# QuizHub V2 — OAuth2 Registration Security

Evidence record for the OAuth2 self-registration hardening sprint
(branch `fix/oauth2-registration-proof`, starting from `main`
`0cdbc2dc30702f3a54d050532ea76a21657093b6`). This documents a defect
reproduced end-to-end against the pre-fix code, the two designs
considered, and the invariants the fix now enforces.

## 1. The defect

`POST /api/auth/oauth2-register` is `permitAll()` in `SecurityConfig`.
Before this fix, `AuthServiceImpl.registerOAuth2(OAuth2RegisterRequest)`
took `email`, `fullName`, `avatarUrl`, and `role` **entirely from the
client's JSON body**, checked only `userRepository.existsByEmail(...)`,
then created a `User` with `isEnable=true`, `isVerified=true`, and
immediately signed and returned a JWT for it.

```
POST /api/auth/oauth2-register
{"email":"victim@example.com","fullName":"x","avatarUrl":"","role":"TEACHER"}

→ 200 {"token": "<valid JWT for a new, verified TEACHER account>", ...}
```

No step anywhere checked that the caller had actually completed a
Google OAuth2 login for that email. `curl` was as good as Google.
Reproduced without any real Google account by
`OAuth2RegistrationSecurityIntegrationTest.cannotRegisterWithoutPriorGoogleCallback`
(see RED evidence in that test's commit).

Two adjacent gaps, same endpoint:

- An unrecognized `role` (e.g. `"SUPERADMIN"`) silently downgraded to
  `STUDENT` instead of being rejected.
- `OAuth2AuthenticationSuccessHandler` read
  `oAuth2User.getAttribute("email")` unconditionally and proceeded to
  redirect a missing or Google-marked-`email_verified=false` identity to
  the choose-role page anyway (`OAuth2AuthenticationSuccessHandlerTest`).

## 2. Designs considered

| | **A — HTTP session** | **B — DB-backed one-time ticket (chosen)** |
| :--- | :--- | :--- |
| Where the pending Google identity lives | `HttpSession` attribute, set by the success handler | A `_oauth2_registration_ticket` row, keyed by an opaque 256-bit token |
| What the browser holds | The existing `JSESSIONID` cookie (already set for the OAuth2 login dance via `SessionCreationPolicy.IF_REQUIRED`) | A new, purpose-built `HttpOnly` cookie scoped to `/api/auth` |
| Multi-instance | **Breaks** without a shared session store. This app has no Spring Session / Redis dependency (checked `pom.xml`) - only in-memory `HttpSession`, which does not survive a second instance or a restart without sticky sessions | Works unmodified: every instance already talks to the same Postgres |
| New schema | None | One small table (`token`, `email`, `fullName`, `avatarUrl`, `createdAt`, `expiresAt`, `consumedAt`) |
| Single-use / replay | Natural to add (clear the session attribute after use), but shares fate with the whole session (e.g. a logout or session-fixation defense elsewhere could wipe it) | Explicit, atomic, and independent of any other session state (`consumeIfValid`, a single conditional `UPDATE`) |
| Expiry | Would piggyback on session timeout (global, not per-registration) | Explicit `expiresAt` per ticket, unrelated to any other session policy |
| CSRF | The existing session cookie is what `SecurityConfig` explicitly warns is *not* safe to leave CSRF-exempt once a cookie drives a mutating `/api/**` request | Same category of risk, addressed the same way (see §3) — a new cookie does not sidestep the requirement to think about it |
| Credential in the URL | Avoidable the same way as B | Avoidable: the ticket travels only as a cookie, never a query parameter (see §3) |

**Chosen: B.** The deciding factor was multi-instance correctness: this
app already runs (per `docker-compose`/CI) as a container that could in
principle be scaled to more than one instance, and there is no shared
session store to make option A safe under that condition without adding
a new infrastructure dependency (Redis) that the task explicitly said
not to add unless truly necessary. Postgres is already the one thing
every instance agrees on. A DB-backed ticket also gets single-use and
expiry as first-class, explicit columns rather than inherited,
coarser-grained session semantics.

## 3. How B addresses each requirement

- **Expiry.** `expiresAt`, checked in `consumeIfValid`'s `WHERE` clause
  and in the read-only `getPendingOAuth2Registration` lookup. 10 minutes
  (`OAuth2RegistrationTicketCookie.TTL`), matching the cookie's own
  `Max-Age`.
- **Single-use, atomically.** `consumeIfValid` is one `UPDATE ... SET
  consumedAt = :now WHERE token = :token AND consumedAt IS NULL AND
  expiresAt > :now`. Postgres takes a row lock for the `UPDATE`; of two
  concurrent calls for the *same* token, only one can match the `WHERE`
  clause and affect a row — the other affects zero rows and is rejected.
  This is not "a JWT that happens to be single-use by convention"; it is
  enforced by the database's own locking, verified by
  `concurrentCompletionsOfTheSameTicketCreateExactlyOneAccount` (two
  threads racing `AuthService.registerOAuth2` for the same token — see
  the "Concurrency-safety pattern" note below).
- **Random source.** `SecureRandom`, 32 bytes (256 bits), URL-safe
  Base64 (`OAuth2RegistrationTicketCookie.generateToken()`).
- **Credential never in a URL.** The ticket travels only as an `HttpOnly`
  cookie. The post-Google redirect is a clean
  `/oauth2-choose-role.html` with **no query parameters at all** — not
  even email/fullName/avatarUrl for display. The choose-role page fetches
  those via a separate `GET /api/auth/oauth2-register/pending`, which
  reads the same cookie server-side and returns a display-only preview.
  Nothing identity-bearing ever appears in browser history, `Referer`,
  or a web server access log for this flow.
- **CSRF.** The new cookie is `SameSite=Lax`. Lax cookies are excluded
  from cross-site `POST`/`fetch`/`XHR` requests entirely (only a
  cross-site *top-level GET navigation* would carry it) — the exact
  vector a forged `POST /api/auth/oauth2-register` would need. This was
  judged sufficient on its own; wiring up the app's existing
  double-submit CSRF token scheme (currently disabled for all of
  `/api/**`) for just this one endpoint was judged disproportionate
  given SameSite=Lax already closes the gap. Residual risk: SameSite
  depends on browser support (universal in current browsers) and does
  not defend against same-origin XSS, which is a different threat class.
- **Atomic consume-then-commit.** `AuthServiceImpl.registerOAuth2` is
  `@Transactional`. The ticket-consume `UPDATE` and the `User` insert
  happen in that one transaction. If the insert fails for any reason
  (`AppException` and Spring Data's own exceptions are all unchecked, so
  Spring's default rollback rule applies — the same rule verified for
  `PracticeServiceImpl.submitPractice` in the prior sprint), the whole
  transaction — including the ticket-consume `UPDATE` — rolls back. The
  ticket reverts to unconsumed rather than being burned with no account
  to show for it, and no JWT is ever generated for a `User` that did not
  actually commit. No ambiguous state is possible: either both the
  ticket-consume and the `User` insert commit together, or neither does.
- **Role is the only client-controlled field.** `OAuth2RegisterRequest`
  now has exactly one field, `role`. `email`/`fullName`/`avatarUrl` are
  read only from the ticket row, resolved server-side; the client cannot
  influence them by any means, tampered request body or otherwise
  (`clientSuppliedIdentityFieldsAreIgnoredInFavorOfTheTicket`).
- **TEACHER self-registration.** Confirmed this is deliberate, existing
  product policy: `AuthServiceImpl.register()` (the plain email/password
  path) has the identical STUDENT/TEACHER selection logic. This sprint
  did not change that policy — it only made an *unrecognized* role value
  (e.g. `"SUPERADMIN"`) an explicit rejection instead of a silent
  downgrade to STUDENT. Whether self-service TEACHER registration should
  require approval is a separate product question, not addressed here.

## 4. API contracts

| Endpoint | Before | After |
| :--- | :--- | :--- |
| `POST /api/auth/oauth2-register` | Body `{email,fullName,avatarUrl,role}`; 200 for any syntactically valid, not-yet-registered email, no prior Google interaction required | Body `{role}` only; requires a valid `oauth2_reg_ticket` cookie (set only by a real Google callback); 400 `OAUTH2_REGISTRATION_INVALID` (code 1047) for a missing/expired/already-consumed ticket; 400 `INVALID_ROLE` (code 1048) for anything other than `STUDENT`/`TEACHER`; 400 `USER_EXISTED` (code 1013, unchanged) if the ticket's email already has an account |
| `GET /api/auth/oauth2-register/pending` | Did not exist | **New.** Public, reads the same cookie, returns `{email,fullName,avatarUrl}` for display (200) or 400 `OAUTH2_REGISTRATION_INVALID` if there is no valid pending ticket. Read-only — does not consume. |
| Google → new user redirect | `/oauth2-choose-role.html?email=&fullName=<base64>&avatarUrl=` | `/oauth2-choose-role.html` (no query parameters); identity travels via the `oauth2_reg_ticket` cookie instead |
| Google → existing user redirect | `/oauth2-redirect.html?token=&id=&email=&fullName=&role=&avatarUrl=` | **Unchanged** — see §5 |

## 5. Remaining risk: JWT-in-URL for existing Google users

`OAuth2AuthenticationSuccessHandler`'s existing-user branch is
**unchanged** by this sprint. When a Google login matches an already-
registered, enabled account, the handler still issues a real JWT and
redirects to `/oauth2-redirect.html?token=<jwt>&id=&email=&fullName=&role=&avatarUrl=`
— a live bearer credential in a URL query parameter, delivered via a
server-side `sendRedirect`. `OAuth2RedirectPage.tsx` immediately calls
`navigate(path, { replace: true })`, so the token-bearing URL does not
persist in the browser's forward/back history — but the HTTP request
that fetched that URL still happened, meaning the token can appear in:

- Access logs of the Spring Boot app or any reverse proxy/CDN in front
  of it, if query strings are logged (common default).
- Any browser extension, autofill, or telemetry that observes navigation
  before the client-side replace runs.
- `Referer` headers, if any subresource load races the replace (none
  currently do on this exact page, but this is fragile, not structurally
  prevented).

This is a **separate, pre-existing risk** from the one this sprint
closes (unauthenticated account *creation*) — it concerns an
*already-authenticated* user's login redirect, not registration. Fixing
it would mean redesigning the existing-user login hand-off the same way
this sprint redesigned the new-user one (e.g. a short-lived, one-time
login ticket delivered via cookie instead of a URL-embedded JWT), which
was out of scope for this sprint's mandate (OAuth2 *registration*
specifically). Flagged here, not fixed. Suggested follow-up: apply the
same ticket-cookie pattern to the existing-user redirect, or move the
existing-user hand-off through `/api/auth/*-register/pending`-style
endpoint instead of a `sendRedirect` with the JWT as a parameter.

## 6. Test coverage

- `OAuth2RegistrationSecurityIntegrationTest` (Testcontainers + MockMvc,
  no real Google account, no real JWT ever logged) — 11 tests:
  unauthenticated-creation RED case, invalid-role RED case, two
  already-correct regression tests (existing/locked account, now
  exercised via a seeded ticket instead of a bare body), tampering,
  replay, expiry, concurrent double-completion, and the three
  `GET /pending` cases (valid/missing/expired).
- `OAuth2AuthenticationSuccessHandlerTest` (plain Mockito unit test, no
  Spring context) — 2 tests: missing email, `email_verified=false`,
  both driven by a mocked `OAuth2User` standing in for a real Google
  token exchange.

RED (pre-fix): 6 tests total across both classes, 4 failures, 0 errors
(the 2 non-failing tests are the already-correct regressions).
GREEN (post-fix): 11 + 2 = 13 tests, 0 failures, 0 errors.

## 7. Numbers in this document

All test counts and commit references are as of the tip of
`fix/oauth2-registration-proof` at the time this sprint's final commit
was made. Re-run the two test classes above and diff against current
`main` before trusting these numbers if this file is read significantly
later.
