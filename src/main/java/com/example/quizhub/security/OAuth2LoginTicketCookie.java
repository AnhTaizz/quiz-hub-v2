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
 * Secure is computed from {@link #isEffectivelySecure}, not the plain request.isSecure(): behind a
 * reverse proxy that terminates TLS and forwards plain HTTP internally (the common production shape for
 * this app - see docker-compose.prod.yml, which has no server.ssl config of its own), request.isSecure()
 * alone would report false even though the browser is actually on HTTPS, and the cookie would then be
 * issued without Secure on what the browser thinks is a secure origin. Falling back to X-Forwarded-Proto
 * closes that gap while still working unmodified over plain HTTP in local dev (neither is true there, so
 * Secure is correctly left off). This trusts X-Forwarded-Proto unconditionally, which is only safe when
 * the app is not directly reachable except through a proxy that sets/overwrites that header itself - true
 * for this deployment (docker-compose maps only the app's own container port), but worth re-checking if
 * that topology ever changes.
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

    /** See the class-level note on why this is not just request.isSecure(). */
    public static boolean isEffectivelySecure(HttpServletRequest request) {
        return request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
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
