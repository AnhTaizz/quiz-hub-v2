# QuizHub V2 — Existing-User Google Login Security

Evidence record for hardening the existing-user Google OAuth2 login path
(branch `fix/oauth2-existing-login-ticket`, starting from `main`
`da8a1bf4240ab93cf336beb3bc144e730782feb0`). This documents one specific
defect - JWT and identity in a redirect URL - not a general audit of the
OAuth2 login feature. It is the companion to
`docs/backend/OAUTH2_REGISTRATION_SECURITY.md` (the first-login/registration
ticket), which already fixed the sibling defect for brand-new Google users.

## 1. Confirmed defect (pre-fix)

`OAuth2AuthenticationSuccessHandler.onAuthenticationSuccess`, existing-user
branch: for a Google callback matching an existing, enabled account, the
handler generated a real JWT with `JwtService.generateToken(user)` and built
the redirect target with `UriComponentsBuilder`, putting `token`, `id`,
`email`, `fullName` (base64), `role` and `avatarUrl` directly into the
`/oauth2-redirect.html` query string of a server-side `sendRedirect`. The
React `OAuth2RedirectPage` then read all of it straight from
`useSearchParams()`.

Reproduced by `OAuth2AuthenticationSuccessHandlerTest`
(`existingEnabledUserLoginRedirectsToABarePathWithNoJwtOrIdentity`,
`existingEnabledUserLoginIssuesASingleUseLoginTicketBoundToThatUserId`) against
the pre-fix handler with a mocked `OAuth2User` - no real Google account
involved. See §6 for the exact RED command and failure.

**Impact:** the JWT and full account identity persisted in:

- Browser history (a back-navigation replays the URL, though not the
  now-already-consumed... there was no consumption at all - the JWT itself
  was long-lived and fully valid, reusable from history indefinitely until
  its own expiry).
- Any reverse proxy/CDN/access log that logs query strings (a common
  default) - see `docker-compose.prod.yml` / the container's own log output.
- The `Referer` header of any subresource load that raced the client-side
  `AuthProvider.login()` call before the browser's history entry was
  replaced.

This was **separate from and unaffected by** the registration-ticket fix in
`OAUTH2_REGISTRATION_SECURITY.md`, which only ever touched the *new*-user
branch. `OAUTH2_REGISTRATION_SECURITY.md` §1 already flagged this exact gap
as a known, deliberately-deferred risk ("Existing-user login still hands the
JWT to the browser via a URL query parameter... a separate, pre-existing
risk... documented, unfixed"). This document closes it.

## 2. Design: a second, separate single-use ticket

Mirrors the registration ticket's mechanism (DB-backed, opaque, single-use,
HttpOnly cookie) but is a **distinct entity, table, cookie and endpoint**,
because it proves a different thing and has a different lifecycle:

| | Registration ticket | Login ticket |
| :--- | :--- | :--- |
| Proves | "a real Google callback happened for this **new** email" | "a real Google callback happened for this **existing user id**" |
| Carries | email, fullName, avatarUrl (nothing else exists yet) | only `userId` (everything else is looked up fresh) |
| TTL | 10 minutes (user may sit on the choose-role form) | 90 seconds (immediate, automatic exchange - no user interaction) |
| Table | `_oauth2_registration_ticket` | `_oauth2_login_ticket` |
| Cookie | `oauth2_reg_ticket` | `oauth2_login_ticket` |
| Exchange endpoint | `POST /api/auth/oauth2-register` | `POST /api/auth/oauth2-login` |

Neither ticket type is accepted by the other's endpoint: they live in
different tables behind different repositories with different single-use
`consumeIfValid` queries, so a login ticket's token is simply never found by
`OAuth2RegistrationTicketRepository.findById`, and vice versa. Verified by
`aRegistrationTicketCannotBeUsedAtTheLoginExchangeEndpoint` and
`aLoginTicketCannotBeUsedAtTheRegistrationEndpoint`.

### Flow

1. User completes the Google OAuth2 callback (`GET /login/oauth2/code/google`,
   unchanged Spring Security machinery).
2. `OAuth2AuthenticationSuccessHandler` verifies `email`/`email_verified`
   (unchanged from the registration fix), looks up the user by email, and
   checks `isEnable` - unchanged rejection paths (`redirectWithError`) for a
   missing/unverified email or a locked account.
3. For an existing, enabled user: mints an `OAuth2LoginTicket` (random
   256-bit token, `userId`, 90s TTL), saves it, and issues it to the browser
   as an HttpOnly cookie. Redirects to a **bare** `/oauth2-redirect.html` -
   no query string.
4. React's `OAuth2RedirectPage` calls `POST /api/auth/oauth2-login`
   (`authApi.oauth2Login`) via a `useQuery` fired once on mount. The cookie
   travels automatically (`httpClient` already uses
   `credentials: "same-origin"`).
5. `AuthController.exchangeOAuth2Login` reads the ticket from the cookie
   (never the body - there is no body) and calls
   `AuthService.exchangeOAuth2Login`.
6. `AuthServiceImpl.exchangeOAuth2Login`, in one `@Transactional` method:
   atomically consumes the ticket (`consumeIfValid`), re-loads the user by
   the ticket's `userId`, re-checks `isEnable` (the account may have changed
   state in the few seconds since step 3), and only then issues a fresh JWT.
   Any failure past the consume rolls the whole transaction back, so the
   ticket becomes usable again rather than being burned for nothing - the
   same rule `AuthServiceImpl.registerOAuth2` already follows.
7. The `AuthResponse` (JWT + user fields) comes back in the JSON body only,
   with `Cache-Control: no-store`. React's `OAuth2RedirectPage` calls
   `AuthProvider.login()` and navigates to the role home page - the same
   code path the registration flow and a plain email/password login use.

## 3. Invariants

- **No JWT or identity ever appears in a URL for this flow.** The redirect
  target is the literal string `/oauth2-redirect.html`, verified by an exact
  string match in `OAuth2AuthenticationSuccessHandlerTest`, not a substring
  check that could hide a stray query parameter.
- **Single-use, even under a race.** `OAuth2LoginTicketRepository
  .consumeIfValid` is one conditional `UPDATE ... WHERE consumed_at IS NULL
  AND expires_at > now()`; Postgres's row lock makes it atomic. Two
  concurrent exchange calls for the same ticket can only ever have one
  winner - verified with two real concurrent threads
  (`concurrentExchangesOfTheSameTicketYieldExactlyOneSuccess`), not a
  sequential simulation.
- **Account status is re-checked at exchange time, not trusted from
  issuance.** A ticket issued for an account that becomes locked or is
  deleted in the (short, ~90s-bounded) window before exchange is rejected -
  `lockedAccountCannotExchangeItsTicketForAJwt`,
  `deletedAccountCannotExchangeItsTicketForAJwt`. No JWT is ever generated
  for either case.
- **One error code, all failure modes.** Missing, fake, expired,
  already-consumed ticket, or a since-invalidated account all answer
  `400 OAUTH2_LOGIN_INVALID` (code 1049) - never a distinguishable error, and
  never `401` (which the frontend's `httpClient` treats as a dead session
  and force-logs the caller out; irrelevant here since the caller was never
  logged in yet, but kept consistent with the registration ticket's own
  rule).
- **The ticket types are not interchangeable** (see §2 table and its tests).
- **CSRF:** the exchange endpoint is `POST`-only, reads its only input from
  a cookie, and takes no request body - there is nothing for a client to
  supply. The app's CSRF protection is blanket-disabled for `/api/**`; this
  cookie's `SameSite=Lax` is the mitigation instead, exactly the same
  reasoning already applied to the registration ticket cookie:
  `SameSite=Lax` excludes the cookie from a cross-site `POST` entirely (Lax
  only rides along on a cross-site top-level *GET* navigation), so a
  cross-site form or `fetch` cannot trigger a valid exchange. The
  controller's class-level `@CrossOrigin("*")` does not weaken this: a
  wildcard `Access-Control-Allow-Origin` cannot be combined with credentialed
  (cookie-carrying) cross-origin requests per the CORS spec, and this
  controller does not set `Access-Control-Allow-Credentials: true`, so
  browsers never attach the cookie to a cross-origin request against this
  endpoint regardless.
- **`Secure` cookie attribute behind a reverse proxy.** Unlike the
  registration ticket's cookie (which uses the plain `request.isSecure()`
  and is unaffected by this fix), `OAuth2LoginTicketCookie.issue` computes
  `Secure` via `isEffectivelySecure`, which also trusts
  `X-Forwarded-Proto: https` when set. `request.isSecure()` alone reports
  `false` behind a reverse proxy that terminates TLS and forwards plain HTTP
  internally - the shape `docker-compose.prod.yml` implies (no
  `server.ssl.*` in `application.yaml`, and no in-repo reverse-proxy config,
  so whatever terminates TLS in front of this app in production is external
  and unverified from this repository). This trusts `X-Forwarded-Proto`
  unconditionally, which is only safe when the app is not directly reachable
  except through a proxy that sets/overwrites that header itself; that
  matches `docker-compose.prod.yml`'s topology (only the app container's own
  port is published) but should be re-checked if that topology changes. Over
  plain HTTP in local dev, neither condition is true, so `Secure` is
  correctly omitted and the cookie still works. The *registration* ticket
  cookie's own use of plain `request.isSecure()` was already flagged as a
  deployment-dependent risk in a prior review pass and is unchanged here -
  deliberately out of scope for this fix (see §5).

## 4. API status/error codes

| Endpoint | Case | Before | After |
| :--- | :--- | :--- | :--- |
| Google callback, existing enabled user | redirect target | `/oauth2-redirect.html?token=...&id=...&email=...&fullName=...&role=...&avatarUrl=...` | `/oauth2-redirect.html` (bare) |
| `POST /api/auth/oauth2-login` | valid, unconsumed, unexpired ticket for an enabled user | *(endpoint did not exist)* | `200`, `AuthResponse` body, `Cache-Control: no-store` |
| `POST /api/auth/oauth2-login` | missing/fake/expired/replayed ticket | — | `400 OAUTH2_LOGIN_INVALID` (code 1049) |
| `POST /api/auth/oauth2-login` | ticket valid but account now locked or deleted | — | `400 OAUTH2_LOGIN_INVALID` (code 1049), no JWT |
| `POST /api/auth/oauth2-login` | a registration ticket's token, sent under either cookie name | — | `400 OAUTH2_LOGIN_INVALID` (code 1049) - never found in this table |
| `POST /api/auth/oauth2-register` | a login ticket's token, sent under the registration cookie name | — | `400 OAUTH2_REGISTRATION_INVALID` (code 1047) - never found in that table |

Unchanged: `GET /login/oauth2/code/google` (Spring Security's own callback
handling), the missing/unverified-email rejection, the locked-account
rejection at Google-callback time (still redirects with an error message,
still no JWT), the entire new-user/registration-ticket flow, plain
email/password `login()`/`register()`, and logout.

## 5. Remaining risks (not fixed this pass)

- **Registration ticket cookie's `Secure` flag** still uses plain
  `request.isSecure()` (no `X-Forwarded-Proto` fallback). Flagged in a prior
  review pass, unchanged here - fixing it is a one-line, low-risk change but
  is a different file/concern than this task's mandate; recommend folding it
  into the same follow-up that revisits `isEffectivelySecure`'s
  trust-the-proxy assumption if the deployment topology ever changes.
- **Legacy static `src/main/resources/static/oauth2-redirect.html` and
  `oauth2-choose-role.html`** still exist on disk and still contain the old
  vanilla-JS logic that reads `token` from the URL and writes it to
  `localStorage`/a non-HttpOnly `jwt` cookie (the pre-React-migration page
  `OAuth2RedirectPage.tsx` replaced - see `docs/frontend/FRONTEND_AUDIT.md`
  F-02). Verified **unreachable**: `SpaController` maps `GET
  /oauth2-redirect.html` and `GET /oauth2-choose-role.html` to
  `forward:/app/index.html` (the React shell), and an explicit
  `@GetMapping` on a `@Controller` takes priority over Spring's static-
  resource handler for an identical path - already independently confirmed
  for `/oauth2-choose-role.html` by the CI container-smoke job's route-
  ownership check. No other code path serves these files at their nominal
  URLs. Recommend deleting them in a separate, narrowly-scoped cleanup PR
  rather than folding that into this one.
- **`OAuth2LoginTicketCookie.isEffectivelySecure` trusts `X-Forwarded-Proto`
  unconditionally.** Safe only because this app is not directly exposed
  except through docker-compose's own port mapping; would need a
  trusted-proxy allowlist if that ever changes (e.g. a CDN or LB the app
  itself is also directly reachable behind/around).
- **Ticket TTL of 90 seconds** is a judgment call inside the 60-120s range
  the task specified; not load-tested under slow-network conditions where
  the redirect-to-exchange round trip itself could occasionally exceed it.
  A user hitting this would simply see the "hết hạn" error and be sent back
  to `/login` to retry - not a security issue, a possible rare UX papercut.

## 6. RED/GREEN evidence

RED (pre-fix, run against the handler before any production code changed):

```
cd quiz-hub-v2-oauth2-login-wt
./mvnw.cmd test -Dtest=OAuth2AuthenticationSuccessHandlerTest
```

`Tests run: 4, Failures: 2, Errors: 0` -

```
existingEnabledUserLoginMustNotPutTheJwtInTheRedirectUrl:
  Expecting actual:
    "null/oauth2-redirect.html?token=FAKE.JWT.MARKER.NOT-A-REAL-TOKEN&id=42&email=existing.user@gmail.com&fullName=RXhpc3RpbmcgVXNlcg%3D%3D&role=STUDENT&avatarUrl=https://example.test/avatar.png"
  not to contain:
    "FAKE.JWT.MARKER.NOT-A-REAL-TOKEN"

existingEnabledUserLoginMustNotPutIdentityFieldsInTheRedirectUrl:
  expected: "/oauth2-redirect.html"
   but was: "null/oauth2-redirect.html?token=FAKE.JWT.MARKER.NOT-A-REAL-TOKEN&id=42&email=existing.user@gmail.com&fullName=RXhpc3RpbmcgVXNlcg%3D%3D&role=STUDENT&avatarUrl=https://example.test/avatar.png"
```

(`FAKE.JWT.MARKER.NOT-A-REAL-TOKEN` is a literal string stubbed onto a mocked
`JwtService` - never a real signing key or token. The `null` prefix is a
`request.getContextPath()` test-fixture artifact from an unstubbed mock, not
a production behavior - fixed in the same commit by stubbing it to `""`,
which is what a real root-context servlet deployment returns; the RED
assertions themselves are unaffected either way, since the JWT/identity
being present in the URL is what fails them, not the prefix.)

GREEN (post-fix): see the final test run in this branch's PR description /
CI for exact counts - `OAuth2AuthenticationSuccessHandlerTest` (5 tests),
`OAuth2ExistingLoginSecurityIntegrationTest` (11 tests),
`OAuth2RedirectPage.test.tsx` (4 tests, Vitest), plus the full backend and
frontend suites for regressions.

## 7. Numbers in this document

Test counts and commit references above are as of this branch's HEAD. If
this file is read significantly later, re-run the tests named above and
diff against current `main` before trusting these numbers.
