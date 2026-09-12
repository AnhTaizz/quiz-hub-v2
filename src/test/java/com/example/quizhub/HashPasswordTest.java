package com.example.quizhub;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class HashPasswordTest {
    @Test
    public void testHash() {
        System.out.println("HASH=" + new BCryptPasswordEncoder().encode("123456"));
    }
}
