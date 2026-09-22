package com.example.quizhub.security;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

import org.springframework.http.ResponseCookie;

/**
 * Everything about the ticket cookie that both the issuer (OAuth2AuthenticationSuccessHandler) and the
 * consumer (AuthController) need to agree on: its name, lifetime, token shape, and attributes.
 *
 * The cookie is HttpOnly (never readable by JS - not even our own React code needs to read it, only send
 * it back), scoped to /api/auth (nothing else needs it), and SameSite=Lax. SameSite=Lax excludes the cookie
 * from cross-site POST/fetch/XHR requests entirely (only a cross-site top-level GET navigation would carry
 * it), which is exactly the CSRF vector this cookie would otherwise be exposed to on the registration POST -
 * so this is a deliberate, sufficient mitigation on its own; layering the app's separate double-submit CSRF
 * token scheme (currently blanket-disabled for /api/**) on top of just this one endpoint was judged
 * disproportionate. Secure is set from the actual request scheme so this also works over plain HTTP in local
 * dev, not just behind TLS.
 */
public final class OAuth2RegistrationTicketCookie {

    public static final String COOKIE_NAME = "oauth2_reg_ticket";
    public static final Duration TTL = Duration.ofMinutes(10);
    private static final String COOKIE_PATH = "/api/auth";
    private static final SecureRandom RANDOM = new SecureRandom();

    private OAuth2RegistrationTicketCookie() {
    }

    /** 256 bits of randomness, URL-safe alphabet - never appears in a URL, but keep it safe regardless. */
    public static String generateToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
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
