const attemptId = document.body.dataset.attemptId;

document.addEventListener('DOMContentLoaded', fetchResult);

async function fetchResult() {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/student/quiz/result?attemptId=${attemptId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!response.ok) throw new Error("Không thể tải kết quả");
        const result = await response.json();

        renderSummary(result);
        renderReview(result.questions);

        // Set up dynamic return button
        const backUrl = sessionStorage.getItem('studentReturnUrl') || '/student';
        const btnBack = document.getElementById('btnBackToOrigin');
        if (btnBack) {
            btnBack.onclick = () => {
                window.location.href = backUrl;
            };
            
            const btnBackText = document.getElementById('btnBackText');
            const btnBackIcon = document.getElementById('btnBackIcon');
            if (backUrl.includes('/classrooms/')) {
                btnBackText.textContent = 'Quay lại Lớp học';
                btnBackIcon.className = 'bi bi-door-open-fill fs-5 me-1';
            } else if (backUrl.includes('/quizzes')) {
                btnBackText.textContent = 'Quay lại Đề thi';
                btnBackIcon.className = 'bi bi-journal-text fs-5 me-1';
            } else if (backUrl.includes('/history')) {
                btnBackText.textContent = 'Quay lại Lịch sử';
                btnBackIcon.className = 'bi bi-clock-history fs-5 me-1';
            } else if (backUrl.includes('/categories')) {
                btnBackText.textContent = 'Quay lại Thư mục';
                btnBackIcon.className = 'bi bi-layers-fill fs-5 me-1';
            } else {
                btnBackText.textContent = 'Quay lại Trang chủ';
                btnBackIcon.className = 'bi bi-house-door-fill fs-5 me-1';
            }
        }

        document.getElementById('resultLoading').style.display = 'none';

    } catch (error) {
        console.error(error);
        if (typeof showToast === 'function') showToast("Lỗi khi tải kết quả.", 'error');
        else console.error("Lỗi khi tải kết quả.");
        window.location.href = '/student';
    }
}

function renderSummary(data) {
    document.getElementById('scoreValue').textContent = data.score.toFixed(1);
    document.getElementById('quizTitle').textContent = data.quizTitle;
    
    const headerTitle = document.getElementById('headerQuizTitle');
    if (headerTitle) {
        headerTitle.textContent = data.quizTitle;
    }
    
    if (data.correctNum !== null) {
        document.getElementById('correctCount').textContent = data.correctNum;
    } else {
        document.getElementById('correctCount').parentElement.style.display = 'none';
    }

    if (data.incorrectNum !== null) {
        document.getElementById('incorrectCount').textContent = data.incorrectNum;
    } else {
        document.getElementById('incorrectCount').parentElement.style.display = 'none';
    }

    const start = new Date(data.startedAt);
    const end = new Date(data.endedAt);
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 1000 / 60);
    const diffSecs = Math.floor((diffMs / 1000) % 60);
    document.getElementById('timeSpent').textContent = `${diffMins}p ${diffSecs}s`;
}

function renderReview(questions) {
    const list = document.getElementById('questionsReviewList');
    const reviewTitle = document.querySelector('.review-title');
    
    if (!questions || questions.length === 0) {
        list.innerHTML = '';
        if (reviewTitle) reviewTitle.style.display = 'none';
        return;
    }
    
    if (reviewTitle) reviewTitle.style.display = 'block';
    list.innerHTML = '';

    questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'q-result-card';
        
        const canShowResult = q.isCorrect !== null;
        const hasAnswered = q.type === 'FILL_IN_BLANK' ? (q.selectedText && q.selectedText.trim() !== '') : (q.selectedAnswerIds && q.selectedAnswerIds.length > 0);
        
        let badge = '';
        if (canShowResult) {
            if (q.isCorrect) {
                badge = '<span class="q-badge badge-correct"><i class="bi bi-check-circle-fill me-1"></i>Chính xác</span>';
            } else if (!hasAnswered) {
                badge = '<span class="q-badge badge-warning text-dark border-warning"><i class="bi bi-exclamation-circle-fill me-1"></i>Chưa trả lời</span>';
            } else {
                badge = '<span class="q-badge badge-wrong"><i class="bi bi-x-circle-fill me-1"></i>Chưa chính xác</span>';
            }
        } else {
            badge = '<span class="q-badge bg-light text-secondary"><i class="bi bi-info-circle-fill me-1"></i>Đã ghi nhận</span>';
        }

        let answersHtml = '';
        if (q.type === 'FILL_IN_BLANK') {
            const studentText = q.selectedText || '(Trống)';
            const correctAnswers = q.answers.filter(a => a.isCorrect).map(a => a.text).join(', ');
            
            let statusClass = '';
            let iconClass = 'icon-none';
            let icon = '<i class="bi bi-pencil-fill"></i>';

            if (canShowResult) {
                statusClass = q.isCorrect ? 'correct' : 'selected-wrong';
                iconClass = q.isCorrect ? 'icon-correct' : 'icon-wrong';
                icon = `<i class="bi ${q.isCorrect ? 'bi-check-lg' : 'bi-x-lg'}"></i>`;
            }

            answersHtml = `
                <div class="ans-opt ${statusClass}">
                    <div class="opt-icon ${iconClass}">${icon}</div>
                    <div>
                        <div class="small text-muted fw-bold">Câu trả lời của bạn:</div>
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
                const isCorrect = ans.isCorrect;
                
                let statusClass = '';
                let iconClass = 'icon-none';
                let icon = String.fromCharCode(65 + i);

                if (canShowResult) {
                    if (isCorrect) {
                        statusClass = 'correct';
                        iconClass = 'icon-correct';
                        icon = '<i class="bi bi-check-lg"></i>';
                    } else if (isSelected && !isCorrect) {
                        statusClass = 'selected-wrong';
                        iconClass = 'icon-wrong';
                        icon = '<i class="bi bi-x-lg"></i>';
                    }
                } else if (isSelected) {
                    statusClass = 'bg-light border-primary';
                    iconClass = 'bg-primary text-white';
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
            <div class="answers-list">
                ${answersHtml}
            </div>
        `;
        list.appendChild(card);
    });
}
