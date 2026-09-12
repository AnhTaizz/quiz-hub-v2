package com.example.quizhub.scheduler;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.example.quizhub.service.quiz.QuizTakingService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class QuizScheduler {

    private final QuizTakingService quizTakingService;

    @Scheduled(cron = "0 * * * * *")
    public void autoSubmitExpiredQuizzes() {
        log.info("Starting auto-submit task for expired quizzes...");
        try {
            quizTakingService.autoSubmitExpiredAttempts();
        } catch (Exception e) {
            log.error("Error during auto-submit task: ", e);
        }
    }
}
