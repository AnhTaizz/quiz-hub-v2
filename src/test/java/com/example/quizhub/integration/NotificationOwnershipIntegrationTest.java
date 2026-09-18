package com.example.quizhub.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.quizhub.entity.Notification;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.NotificationType;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.NotificationRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.security.JwtService;

/**
 * Notifications are per-user. PUT /api/notifications/{id}/read used to load the notification by id alone,
 * so any authenticated user who knew (or guessed) an id could mark someone else's notification read.
 */
@SpringBootTest(properties = "app.jwt.secret=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class NotificationOwnershipIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private NotificationRepository notificationRepository;
    @Autowired
    private JwtService jwtService;

    private User userA;
    private User userB;
    private String tokenA;
    private String tokenB;
    private Notification notifA1;
    private Notification notifA2;
    private Notification notifB1;
    private Notification notifB2;

    @BeforeEach
    void seed() {
        notificationRepository.deleteAll();
        userA = user("notif_a@test.com");
        userB = user("notif_b@test.com");
        tokenA = jwtService.generateToken(userA);
        tokenB = jwtService.generateToken(userB);
        notifA1 = notification(userA, "A one");
        notifA2 = notification(userA, "A two");
        notifB1 = notification(userB, "B one");
        notifB2 = notification(userB, "B two");
    }

    private User user(String email) {
        return userRepository.findByEmail(email).orElseGet(() -> userRepository.save(User.builder()
                .email(email).password("pw").fullName(email)
                .isEnable(true).isVerified(true).role(Role.STUDENT).build()));
    }

    private Notification notification(User owner, String title) {
        return notificationRepository.save(Notification.builder()
                .user(owner).title(title).message(title + " message").type(NotificationType.values()[0])
                .link("/student/quizzes").isRead(false).build());
    }

    private MvcResult call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String token)
            throws Exception {
        return mockMvc.perform(request.header("Authorization", "Bearer " + token)).andReturn();
    }

    private boolean isRead(Notification n) {
        return notificationRepository.findById(n.getId()).orElseThrow().isRead();
    }

    @Test
    void userCannotMarkAnotherUsersNotificationAsRead() throws Exception {
        MvcResult result = call(put("/api/notifications/" + notifB1.getId() + "/read"), tokenA);

        assertThat(isRead(notifB1)).as("B's notification must not be mutated by A").isFalse();
        assertThat(result.getResponse().getStatus()).as("A gets an error, not success").isGreaterThanOrEqualTo(400);
    }

    @Test
    void foreignAndNonExistentIdsAreIndistinguishable() throws Exception {
        MvcResult foreign = call(put("/api/notifications/" + notifB1.getId() + "/read"), tokenA);
        MvcResult missing = call(put("/api/notifications/999999999/read"), tokenA);

        assertThat(foreign.getResponse().getStatus()).isEqualTo(missing.getResponse().getStatus());
        // Same body apart from the timestamp: no signal that the id exists for someone else.
        String foreignBody = foreign.getResponse().getContentAsString().replaceAll("\"timestamp\":\"[^\"]*\"", "");
        String missingBody = missing.getResponse().getContentAsString().replaceAll("\"timestamp\":\"[^\"]*\"", "");
        assertThat(foreignBody).isEqualTo(missingBody);
    }

    @Test
    void ownerCanMarkOwnNotificationAsRead() throws Exception {
        MvcResult result = call(put("/api/notifications/" + notifB1.getId() + "/read"), tokenB);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(isRead(notifB1)).isTrue();
        assertThat(isRead(notifB2)).as("only the targeted notification changes").isFalse();
    }

    @Test
    void markAllOnlyAffectsTheCurrentUser() throws Exception {
        MvcResult result = call(put("/api/notifications/read-all"), tokenA);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(isRead(notifA1)).isTrue();
        assertThat(isRead(notifA2)).isTrue();
        assertThat(isRead(notifB1)).as("B's notifications untouched by A's mark-all").isFalse();
        assertThat(isRead(notifB2)).isFalse();
    }

    @Test
    void unreadCountIsPerUser() throws Exception {
        call(put("/api/notifications/" + notifA1.getId() + "/read"), tokenA);

        assertThat(call(get("/api/notifications/unread-count"), tokenA).getResponse().getContentAsString()).isEqualTo("1");
        assertThat(call(get("/api/notifications/unread-count"), tokenB).getResponse().getContentAsString()).isEqualTo("2");
    }

    @Test
    void foreignNotificationIs404WithTheStandardErrorShape() throws Exception {
        MvcResult result = call(put("/api/notifications/" + notifB1.getId() + "/read"), tokenA);

        assertThat(result.getResponse().getStatus()).isEqualTo(404);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1046").contains("\"status\":404");
    }

    @Test
    void listExposesOnlyTheUiFieldsAndNeverTheUserGraph() throws Exception {
        String body = call(get("/api/notifications"), tokenA).getResponse().getContentAsString();

        assertThat(body).contains("\"id\":").contains("\"title\":").contains("\"message\":").contains("\"type\":")
                .contains("\"read\":false").contains("\"link\":\"/student/quizzes\"").contains("\"createdAt\":");
        assertThat(body).doesNotContain("\"user\"").doesNotContain("notif_a@test.com").doesNotContain("password");
    }

    @Test
    void listReturnsOnlyTheCallersNotifications() throws Exception {
        String body = call(get("/api/notifications"), tokenA).getResponse().getContentAsString();

        assertThat(body).contains("A one").contains("A two").doesNotContain("B one").doesNotContain("B two");
    }
}
