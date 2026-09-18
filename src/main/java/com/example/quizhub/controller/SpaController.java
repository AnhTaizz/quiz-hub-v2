package com.example.quizhub.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the React SPA shell for React-owned routes.
 *
 * Ownership is an explicit allow-list, deliberately NOT a "/student/**"
 * catch-all: the remaining student pages (practice, categories, personal
 * quiz authoring, ...), /profile, /teacher/** and /admin/** are still
 * Thymeleaf and must keep resolving to their own controllers. Nothing under
 * /api/**, /actuator/**, /oauth2/**, /login/oauth2/** or static asset paths
 * is ever forwarded here.
 *
 * The forward is internal (the browser URL is unchanged), and
 * SecurityConfig's existing path rules still run on the original path, so
 * role checks on /student/** are enforced server-side exactly as before.
 */
@Controller
public class SpaController {

    private static final String SPA_INDEX = "forward:/app/index.html";

    @GetMapping({ "/", "/login", "/register", "/forgot-password", "/oauth2-redirect.html" })
    public String publicRoutes() {
        return SPA_INDEX;
    }

    @GetMapping({
            "/student",
            "/student/quizzes",
            "/student/classrooms",
            "/student/classrooms/{id:\\d+}",
            "/student/history",
            "/student/quiz/play/{id:\\d+}",
            "/student/quiz/resume/{id:\\d+}",
            "/student/quiz/result/{id:\\d+}"
    })
    @PreAuthorize("hasRole('STUDENT')")
    public String studentRoutes() {
        return SPA_INDEX;
    }
}
