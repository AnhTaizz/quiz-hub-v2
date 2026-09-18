package com.example.quizhub.dto.student;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import com.example.quizhub.entity.QuizAssigning;

/**
 * Availability is decided by the server clock, not the browser's: the JVM is pinned to
 * Asia/Ho_Chi_Minh and dates are serialized without an offset, so clients outside that zone
 * cannot compare them to their own clock (this broke E2E in CI, which runs in UTC).
 */
class AssignedQuizSummaryDTOTest {

    private static QuizAssigning assigning(LocalDateTime start, LocalDateTime due) {
        return QuizAssigning.builder().id(1L).startDate(start).dueDate(due).build();
    }

    @Test
    void notStartedWhenStartIsInTheFuture() {
        LocalDateTime now = LocalDateTime.now();
        assertThat(AssignedQuizSummaryDTO.availabilityOf(assigning(now.plusHours(1), now.plusDays(1))))
                .isEqualTo("NOT_STARTED");
    }

    @Test
    void expiredWhenDueIsInThePast() {
        LocalDateTime now = LocalDateTime.now();
        assertThat(AssignedQuizSummaryDTO.availabilityOf(assigning(now.minusDays(2), now.minusHours(1))))
                .isEqualTo("EXPIRED");
    }

    @Test
    void availableInsideTheWindow() {
        LocalDateTime now = LocalDateTime.now();
        assertThat(AssignedQuizSummaryDTO.availabilityOf(assigning(now.minusHours(1), now.plusDays(1))))
                .isEqualTo("AVAILABLE");
    }

    @Test
    void missingBoundsAreTreatedAsOpenEnded() {
        assertThat(AssignedQuizSummaryDTO.availabilityOf(assigning(null, null))).isEqualTo("AVAILABLE");
        assertThat(AssignedQuizSummaryDTO.availabilityOf(assigning(null, LocalDateTime.now().plusDays(1))))
                .isEqualTo("AVAILABLE");
        assertThat(AssignedQuizSummaryDTO.availabilityOf(assigning(LocalDateTime.now().minusDays(1), null)))
                .isEqualTo("AVAILABLE");
    }

    @Test
    void factoriesPopulateAvailability() {
        QuizAssigning open = assigning(LocalDateTime.now().minusHours(1), LocalDateTime.now().plusDays(1));
        assertThat(AssignedQuizSummaryDTO.fromAssigning(open).getAvailability()).isEqualTo("AVAILABLE");

        QuizDashboardInfoDTO info = new QuizDashboardInfoDTO();
        info.setAssigning(assigning(LocalDateTime.now().plusHours(2), null));
        assertThat(AssignedQuizSummaryDTO.fromDashboardInfo(info).getAvailability()).isEqualTo("NOT_STARTED");
    }
}
