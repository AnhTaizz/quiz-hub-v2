package com.example.quizhub.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * A single-use, short-lived proof that the holder completed a real Google OAuth2 login as an EXISTING,
 * already-enabled user. Issued by OAuth2AuthenticationSuccessHandler and handed to the browser as an
 * HttpOnly cookie value (never a URL query parameter, never the request body). {@code token} is the
 * opaque, high-entropy identifier - it IS the primary key, so a lookup by token is a plain findById.
 *
 * Deliberately separate from OAuth2RegistrationTicket: that one proves "a real Google callback happened
 * for an email with NO account yet" and carries the identity fields needed to create one. This one proves
 * "a real Google callback happened for a user id that already exists" and carries only that id - there is
 * nothing to redeem it for except a fresh JWT for that same account. Neither ticket type is accepted by
 * the other's exchange endpoint (see OAuth2LoginTicketRepository / OAuth2RegistrationTicketRepository -
 * two different tables, two different single-use consume queries).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "_oauth2_login_ticket")
public class OAuth2LoginTicket {

    @Id
    @Column(length = 64)
    String token;

    @Column(name = "user_id", nullable = false)
    Long userId;

    @CreationTimestamp
    @Column(name = "created_at")
    LocalDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    LocalDateTime expiresAt;

    @Column(name = "consumed_at")
    LocalDateTime consumedAt;
}
