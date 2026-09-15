package com.example.quizhub.integration;

import org.junit.jupiter.api.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.assertj.core.api.Assertions.assertThat;

public class QuizPlayClientConsolidationTest {

    @Test
    void activeTemplateReferencesCanonicalClient() throws Exception {
        Path htmlTemplate = Paths.get("src/main/resources/templates/student/quiz-play-student.html");
        assertThat(Files.exists(htmlTemplate)).isTrue();

        String htmlContent = Files.readString(htmlTemplate);
        assertThat(htmlContent).contains("quiz-play.js");
        assertThat(htmlContent).doesNotContain("quiz-play-student.js");
    }

    @Test
    void obsoleteClientIsNoLongerPresent() {
        Path obsoleteJs = Paths.get("src/main/resources/static/js/student/quiz-play-student.js");
        assertThat(Files.exists(obsoleteJs)).isFalse();
    }

    @Test
    void canonicalClientSupportsResumeAndRevision() throws Exception {
        Path canonicalJs = Paths.get("src/main/resources/static/js/student/quiz-play.js");
        assertThat(Files.exists(canonicalJs)).isTrue();

        String jsContent = Files.readString(canonicalJs);
        
        // 1. Supports attemptId parsing
        assertThat(jsContent).contains("const attemptId = document.body.dataset.attemptId;");
        
        // 2. Supports resume path
        assertThat(jsContent).contains("/api/student/quiz/resume?attemptId=");
        
        // 3. Contains revision-aware save payload
        assertThat(jsContent).contains("revision");
        assertThat(jsContent).contains("answerRevisions");
        assertThat(jsContent).contains("reconcileLocalAndServerState");
    }
    @Test
    void activeTemplateContainsRequiredDomElements() throws Exception {
        Path htmlTemplate = Paths.get("src/main/resources/templates/student/quiz-play-student.html");
        String htmlContent = Files.readString(htmlTemplate);

        assertThat(htmlContent).contains("id=\"fullscreenOverlay\"");
        assertThat(htmlContent).contains("id=\"fsMessage\"");

        assertThat(htmlContent).contains("id=\"errorOverlay\"");
        assertThat(htmlContent).contains("id=\"errorIcon\"");
        assertThat(htmlContent).contains("id=\"errorTitle\"");
        assertThat(htmlContent).contains("id=\"errorMsg\"");

        assertThat(htmlContent).contains("class=\"btn-back\"");
    }

    @Test
    void answerInteractionIsTargetedAndRevisionAware() throws Exception {
        Path canonicalJs = Paths.get("src/main/resources/static/js/student/quiz-play.js");
        String jsContent = Files.readString(canonicalJs);

        String toggleAnswerBody = jsContent.substring(jsContent.indexOf("function toggleAnswer"), jsContent.indexOf("function isAnswerSelected"));
        assertThat(toggleAnswerBody).doesNotContain("renderView()");
        assertThat(toggleAnswerBody).doesNotContain("renderGrid()");
        assertThat(toggleAnswerBody).contains("updateAnswerSelectionDom(qId)");
        assertThat(toggleAnswerBody).contains("updateQuestionDot(qId)");
        
        String handleFillInputBody = jsContent.substring(jsContent.indexOf("function handleFillInput"), jsContent.indexOf("function saveToLocal"));
        assertThat(handleFillInputBody).doesNotContain("renderGrid()");
        assertThat(handleFillInputBody).contains("updateQuestionDot(qId)");
        
        assertThat(jsContent).contains("const rev = nextRevision(qId)");
    }
}
