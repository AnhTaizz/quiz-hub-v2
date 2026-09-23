package com.example.quizhub.dto.auth.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Display-only preview of a pending OAuth2 registration ("Signed in as X (email)"), read from the
 * server-side ticket bound to the caller's cookie. Never used to create the account - the POST that
 * actually creates the User re-derives these same fields from the same ticket, ignoring anything the client
 * might send.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OAuth2PendingRegistrationResponse {
    private String email;
    private String fullName;
    private String avatarUrl;
}
