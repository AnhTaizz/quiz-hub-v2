/**
 * Teacher Quiz Result View Logic
 * Depends on: apiClient (api-client.js), window.attemptId (declared in Thymeleaf HTML)
 */
document.addEventListener('DOMContentLoaded', async () => {
    const attemptId = window.attemptId;
    if (!attemptId) {
        console.error('Không tìm thấy mã bài làm (attemptId).');
        return;
    }

    try {
        const data = await apiClient.get(`/api/teacher/classrooms/assigned-quizzes/attempts/${attemptId}/result`);
        renderSummary(data);
        renderReview(data.questions);

        document.getElementById('resultLoading').style.display = 'none';
        document.getElementById('result-content').style.display = 'block';
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu bài làm:', error);
    }
});

function renderSummary(data) {
    document.getElementById('score-val').textContent  = data.score !== null ? data.score.toFixed(1) : '—';
    document.getElementById('quiz-title').textContent = data.quizTitle;
    document.getElementById('correct-num').textContent   = data.correctNum ?? '—';
    document.getElementById('incorrect-num').textContent = data.incorrectNum ?? '—';
    document.getElementById('total-num').textContent     = data.totalNum ?? '—';

    const start = new Date(data.startedAt);
    const end   = new Date(data.endedAt);
    const diffMs   = end - start;
    const diffMins = Math.floor(diffMs / 1000 / 60);
    const diffSecs = Math.floor((diffMs / 1000) % 60);
    document.getElementById('duration').textContent  = `${diffMins}p ${diffSecs}s`;
    document.getElementById('started-at').textContent = 'Ngày làm: ' + start.toLocaleString('vi-VN');
}

function renderReview(questions) {
    const list = document.getElementById('questionsReviewList');
    if (!questions || questions.length === 0) {
        list.innerHTML = '<p class="text-muted text-center py-5">Không có dữ liệu chi tiết câu hỏi.</p>';
        return;
    }

    list.innerHTML = '';
    questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'q-result-card';

        const canShowResult = q.isCorrect !== null;
        const hasAnswered = q.type === 'FILL_IN_BLANK'
            ? (q.selectedText && q.selectedText.trim() !== '')
            : (q.selectedAnswerIds && q.selectedAnswerIds.length > 0);

        let badge = '';
        if (canShowResult) {
            if (q.isCorrect) {
                badge = '<span class="q-badge badge-correct"><i class="bi bi-check-circle-fill me-1"></i>Chính xác</span>';
            } else if (!hasAnswered) {
                badge = '<span class="q-badge badge-warning"><i class="bi bi-exclamation-circle-fill me-1"></i>Chưa trả lời</span>';
            } else {
                badge = '<span class="q-badge badge-wrong"><i class="bi bi-x-circle-fill me-1"></i>Chưa chính xác</span>';
            }
        } else {
            badge = '<span class="q-badge bg-light text-secondary"><i class="bi bi-info-circle-fill me-1"></i>Đã ghi nhận</span>';
        }

        let answersHtml = '';
        if (q.type === 'FILL_IN_BLANK') {
            const studentText   = q.selectedText || '(Trống)';
            const correctAnswers = q.answers.filter(a => a.isCorrect).map(a => a.text).join(', ');

            let statusClass = '';
            let iconClass   = 'icon-none';
            let icon        = '<i class="bi bi-pencil-fill"></i>';

            if (canShowResult) {
                statusClass = q.isCorrect ? 'correct' : 'selected-wrong';
                iconClass   = q.isCorrect ? 'icon-correct' : 'icon-wrong';
                icon        = `<i class="bi ${q.isCorrect ? 'bi-check-lg' : 'bi-x-lg'}"></i>`;
            }

            answersHtml = `
                <div class="ans-opt ${statusClass}">
                    <div class="opt-icon ${iconClass}">${icon}</div>
                    <div>
                        <div class="small text-muted fw-bold">Câu trả lời của học sinh:</div>
                        <div class="fw-bold">${studentText}</div>
                    </div>
                </div>
                ${canShowResult && !q.isCorrect ? `
                <div class="ans-opt correct mt-2">
                    <div class="opt-icon icon-correct"><i class="bi bi-check-lg"></i></div>
                    <div>
                        <div class="small text-muted fw-bold">Đáp án đúng:</div>
                        <div class="fw-bold">${correctAnswers}</div>
                    </div>
                </div>` : ''}
            `;
        } else {
            q.answers.forEach((ans, i) => {
                const isSelected = q.selectedAnswerIds.includes(ans.answerId);
                const isCorrect  = ans.isCorrect;

                let statusClass = '';
                let iconClass   = 'icon-none';
                let icon        = String.fromCharCode(65 + i);

                if (canShowResult) {
                    if (isCorrect) {
                        statusClass = 'correct';
                        iconClass   = 'icon-correct';
                        icon        = '<i class="bi bi-check-lg"></i>';
                    } else if (isSelected && !isCorrect) {
                        statusClass = 'selected-wrong';
                        iconClass   = 'icon-wrong';
                        icon        = '<i class="bi bi-x-lg"></i>';
                    }
                } else if (isSelected) {
                    statusClass = 'bg-light border-primary';
                    iconClass   = 'bg-primary text-white';
                }

                answersHtml += `
                    <div class="ans-opt ${statusClass}">
                        <div class="opt-icon ${iconClass}">${icon}</div>
                        <div class="opt-text">${ans.text}</div>
                    </div>
                `;
            });
        }

        const typeLabel = q.type === 'SINGLE_CHOICE' ? 'CHỌN MỘT' : (q.type === 'FILL_IN_BLANK' ? 'ĐIỀN KHUYẾT' : 'CHỌN NHIỀU');

        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div class="w-100">
                    <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                        ${badge}
                        <span class="q-badge bg-light text-muted">${typeLabel}</span>
                        <span class="q-level-badge level-${(q.level || 'medium').toLowerCase()}">${q.level || 'MEDIUM'}</span>
                    </div>
                    <h5 class="fw-bold mb-3">Câu ${idx + 1}: ${q.text}</h5>
                </div>
            </div>
            <div class="answers-list">${answersHtml}</div>
        `;
        list.appendChild(card);
    });
}
