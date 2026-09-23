package com.example.quizhub.repository;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.example.quizhub.entity.OAuth2RegistrationTicket;

@Repository
public interface OAuth2RegistrationTicketRepository extends JpaRepository<OAuth2RegistrationTicket, String> {

    /**
     * Atomically marks the ticket consumed iff it is still unconsumed and unexpired. Postgres takes a row
     * lock for the UPDATE, so two concurrent completions of the SAME ticket serialize: at most one of them
     * can match this WHERE clause and affect a row. The caller checks the returned row count (1 = this call
     * won and may proceed; 0 = missing/expired/already consumed by someone else - reject).
     */
    @Modifying
    @Query("UPDATE OAuth2RegistrationTicket t SET t.consumedAt = :now "
            + "WHERE t.token = :token AND t.consumedAt IS NULL AND t.expiresAt > :now")
    int consumeIfValid(@Param("token") String token, @Param("now") LocalDateTime now);
}
