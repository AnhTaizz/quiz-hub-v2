package com.example.quizhub.security;

import java.io.IOException;
import java.net.URLEncoder;
import java.time.LocalDateTime;

import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import com.example.quizhub.dto.ErrorResponse;
import com.example.quizhub.exception.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {
    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException, ServletException {

        String requestUri = request.getRequestURI();

        if (requestUri.startsWith("/api/")) {
            ErrorCode errorCode = ErrorCode.UNAUTHORIZED;
            response.setStatus(errorCode.getStatusCode().value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ErrorResponse errorResponse = ErrorResponse.builder()
                    .code(errorCode.getCode())
                    .status(errorCode.getStatusCode().value())
                    .message(errorCode.getMessage())
                    .timestamp(LocalDateTime.now())
                    .build();
            response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
        } else {
            String returnUrl = requestUri;
            String query = request.getQueryString();
            if (query != null && !query.isEmpty()) {
                returnUrl += "?" + query;
            }
            response.sendRedirect("/login?returnUrl=" + URLEncoder.encode(returnUrl, "UTF-8"));
        }
    }

}
