package com.example.quizhub.repository;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.example.quizhub.entity.OAuth2LoginTicket;

@Repository
public interface OAuth2LoginTicketRepository extends JpaRepository<OAuth2LoginTicket, String> {

    /**
     * Atomically marks the ticket consumed iff it is still unconsumed and unexpired. Postgres takes a row
     * lock for the UPDATE, so two concurrent exchanges of the SAME ticket serialize: at most one of them
     * can match this WHERE clause and affect a row. The caller checks the returned row count (1 = this
     * call won and may proceed; 0 = missing/expired/already consumed by someone else - reject).
     * Mirrors OAuth2RegistrationTicketRepository#consumeIfValid; kept on this separate table/repository
     * so a registration ticket can never be consumed through the login exchange path, or vice versa.
     */
    @Modifying
    @Query("UPDATE OAuth2LoginTicket t SET t.consumedAt = :now "
            + "WHERE t.token = :token AND t.consumedAt IS NULL AND t.expiresAt > :now")
    int consumeIfValid(@Param("token") String token, @Param("now") LocalDateTime now);
}
