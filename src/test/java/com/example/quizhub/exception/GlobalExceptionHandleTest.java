package com.example.quizhub.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Proves exception-handler precedence without adding any production endpoint: a test-local controller throws
 * each exception type and the real GlobalExceptionHandle advice maps it.
 */
class GlobalExceptionHandleTest {

    @RestController
    static class ThrowingController {
        @GetMapping("/denied")
        String denied() {
            throw new AccessDeniedException("Access Denied - internal detail that must not leak");
        }

        @GetMapping("/boom")
        String boom() {
            throw new IllegalStateException("some genuinely unhandled failure");
        }

        @GetMapping("/app")
        String app() {
            throw new AppException(ErrorCode.QUIZ_NOT_FOUND);
        }
    }

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ThrowingController())
                .setControllerAdvice(new GlobalExceptionHandle())
                .build();
    }

    @Test
    void accessDeniedIs403WithTheDedicatedForbiddenCode() throws Exception {
        mockMvc.perform(get("/denied"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value(ErrorCode.FORBIDDEN.getCode()))
                .andExpect(jsonPath("$.message").value(ErrorCode.FORBIDDEN.getMessage()))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void accessDeniedDoesNotLeakTheExceptionMessage() throws Exception {
        String body = mockMvc.perform(get("/denied")).andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("internal detail").doesNotContain("Access Denied").doesNotContain("Exception");
    }

    @Test
    void forbiddenAndUnauthorizedRemainDistinct() {
        assertThat(ErrorCode.FORBIDDEN.getStatusCode().value()).isEqualTo(403);
        assertThat(ErrorCode.UNAUTHORIZED.getStatusCode().value()).isEqualTo(401);
        assertThat(ErrorCode.FORBIDDEN.getCode()).isNotEqualTo(ErrorCode.UNAUTHORIZED.getCode());
    }

    @Test
    void ordinaryRuntimeExceptionsStillMapToTheGeneric500() throws Exception {
        mockMvc.perform(get("/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.code").value(ErrorCode.UNCATEGORIZED_EXCEPTION.getCode()));
    }

    @Test
    void appExceptionsAreUnaffected() throws Exception {
        mockMvc.perform(get("/app"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCode.QUIZ_NOT_FOUND.getCode()));
    }
}
