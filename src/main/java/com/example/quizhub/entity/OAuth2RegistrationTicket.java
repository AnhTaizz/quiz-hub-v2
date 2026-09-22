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
 * A single-use, time-limited proof that the holder completed a real Google OAuth2 login as a given,
 * not-yet-registered email. Issued by OAuth2AuthenticationSuccessHandler and handed to the browser as an
 * HttpOnly cookie value (never a URL query parameter, never trusted from a request body). {@code token} is
 * the opaque, high-entropy identifier - it IS the primary key, so a lookup by token is a plain findById.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "_oauth2_registration_ticket")
public class OAuth2RegistrationTicket {

    @Id
    @Column(length = 64)
    String token;

    @Column(nullable = false, length = 100)
    String email;

    @Column(name = "full_name", nullable = false)
    String fullName;

    @Column(name = "avatar_url", columnDefinition = "TEXT")
    String avatarUrl;

    @CreationTimestamp
    @Column(name = "created_at")
    LocalDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    LocalDateTime expiresAt;

    @Column(name = "consumed_at")
    LocalDateTime consumedAt;
}
