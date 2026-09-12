package com.example.quizhub.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.example.quizhub.security.JwtAuthenticationEntryPoint;
import com.example.quizhub.security.JwtAuthenticationFilter;
import com.example.quizhub.security.CustomAccessDeniedHandler;
import com.example.quizhub.security.OAuth2AuthenticationSuccessHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

import lombok.RequiredArgsConstructor;

@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
@EnableMethodSecurity // Cho phép dùng @PreAuthorize trên method level
@RequiredArgsConstructor
public class SecurityConfig {

        private final JwtAuthenticationFilter jwtAuthFilter;
        private final AuthenticationProvider authenticationProvider;
        private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
        private final CustomAccessDeniedHandler accessDeniedHandler;
        private final OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler;
        private final String[] PUBLIC_ENDPOINT = { "/",
                        "/index.html",
                        "/teacher-category.html",
                        "/css/**",
                        "/js/**",
                        "/images/**",
                        "/assets/**",
                        "/login", "/register", "/forgot-password", "/oauth2-redirect.html", "/oauth2-choose-role.html",
                        "/api/auth/register", "/api/auth/login", "/api/auth/check-email", "/api/auth/oauth2-register",
                        "/api/auth/forgot-password", "/api/auth/reset-password",
                        "/error" };

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                // Kích hoạt CSRF nhưng bỏ qua các REST API (Stateless)
                                .csrf(csrf -> {
                                        CsrfTokenRequestAttributeHandler requestHandler = new CsrfTokenRequestAttributeHandler();
                                        requestHandler.setCsrfRequestAttributeName("_csrf");
                                        csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                                                        .csrfTokenRequestHandler(requestHandler)
                                                        .ignoringRequestMatchers("/api/**");
                                })

                                // Phân quyền theo HTTP path
                                .authorizeHttpRequests(auth -> auth
                                                // Public: đăng ký, đăng nhập
                                                .requestMatchers(PUBLIC_ENDPOINT).permitAll()

                                                // Chỉ ADMIN
                                                .requestMatchers("/admin/**").hasRole("ADMIN")
                                                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                                                // ADMIN hoặc TEACHER
                                                .requestMatchers("/teacher/**").hasAnyRole("ADMIN", "TEACHER")
                                                .requestMatchers("/api/teacher/**").hasAnyRole("ADMIN", "TEACHER")

                                                // ADMIN, TEACHER hoặc STUDENT
                                                .requestMatchers("/student/**")
                                                .hasAnyRole("ADMIN", "TEACHER", "STUDENT")
                                                .requestMatchers("/api/student/**")
                                                .hasAnyRole("ADMIN", "TEACHER", "STUDENT")

                                                // Tất cả request còn lại phải authenticated
                                                .anyRequest().authenticated())

                                // Google OAuth2
                                .oauth2Login(oauth2 -> oauth2
                                                .loginPage("/login")
                                                .successHandler(oAuth2AuthenticationSuccessHandler))

                                // Cho phép tạo session khi cần thiết (đặc biệt cho luồng OAuth2)
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))

                                // Gắn AuthenticationProvider (DaoAuthentication + BCrypt)
                                .authenticationProvider(authenticationProvider)
                                .exceptionHandling(exception -> exception
                                                .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                                                .accessDeniedHandler(accessDeniedHandler))

                                // Đặt JwtAuthenticationFilter chạy trước
                                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }
}
