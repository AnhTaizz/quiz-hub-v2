package com.example.quizhub.security;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;

/**
 * Everything about the login-ticket cookie that both the issuer (OAuth2AuthenticationSuccessHandler) and
 * the consumer (AuthController) need to agree on: its name, lifetime, token shape, and attributes.
 *
 * The cookie is HttpOnly (never readable by JS), scoped to /api/auth (nothing else needs it), and
 * SameSite=Lax. SameSite=Lax excludes the cookie from cross-site POST/fetch/XHR entirely (only a
 * cross-site top-level GET navigation would carry it, and the exchange endpoint is POST-only), which is
 * the CSRF vector this cookie would otherwise be exposed to - the app's separate double-submit CSRF token
 * scheme is blanket-disabled for /api/** and layering it onto just this one endpoint was judged
 * disproportionate, mirroring the same call already made for OAuth2RegistrationTicketCookie.
 *
 * TTL is deliberately short (90s, inside the 60-120s the task calls for): this ticket only needs to
 * survive the round trip from the Google redirect landing on /oauth2-redirect.html to that page's own
 * exchange call a moment later, not a user pausing to read anything.
 *
 * Secure ({@link #shouldBeSecure}) follows request.isSecure() - the scheme the servlet container says the
 * request arrived on - plus an explicit override. It deliberately does NOT read X-Forwarded-Proto itself:
 * whether that header came from a trusted TLS-terminating proxy or straight from a client is a deployment
 * fact only the container can know (server.forward-headers-strategy, and for "native" the trusted proxy
 * addresses in server.tomcat.remoteip.internal-proxies). docker-compose.prod.yml publishes the app's port
 * directly on the host, so nothing in this repository guarantees every request passes through a proxy.
 *
 * - Local HTTP: isSecure() is false, override off -> no Secure (the cookie must still work).
 * - Direct HTTPS (TLS terminated by the app): isSecure() is true -> Secure.
 * - HTTPS behind a reverse proxy: Secure only if the deployment either configures forwarded-header trust
 *   for that proxy (then isSecure() is true) or sets app.security.cookie-force-secure=true. See
 *   docs/backend/OAUTH2_EXISTING_LOGIN_SECURITY.md for the configuration requirement.
 */
public final class OAuth2LoginTicketCookie {

    public static final String COOKIE_NAME = "oauth2_login_ticket";
    public static final Duration TTL = Duration.ofSeconds(90);
    private static final String COOKIE_PATH = "/api/auth";
    private static final SecureRandom RANDOM = new SecureRandom();

    private OAuth2LoginTicketCookie() {
    }

    /** 256 bits of randomness, URL-safe alphabet - never appears in a URL, but keep it safe regardless. */
    public static String generateToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** See the class-level note: never derived from a raw forwarded header. */
    public static boolean shouldBeSecure(HttpServletRequest request, boolean forceSecure) {
        return forceSecure || request.isSecure();
    }

    public static ResponseCookie issue(String token, boolean secureRequest) {
        return ResponseCookie.from(COOKIE_NAME, token)
                .httpOnly(true)
                .secure(secureRequest)
                .sameSite("Lax")
                .path(COOKIE_PATH)
                .maxAge(TTL)
                .build();
    }

    public static ResponseCookie clear(boolean secureRequest) {
        return ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true)
                .secure(secureRequest)
                .sameSite("Lax")
                .path(COOKIE_PATH)
                .maxAge(0)
                .build();
    }
}
