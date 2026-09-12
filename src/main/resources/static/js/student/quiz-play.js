const assigningId = document.body.dataset.assigningId;
let quizData = null;
let currentIndex = 0;
let userAnswers = {}; // questionId -> [answerIds] or string
let flaggedQuestions = new Set(); // set of questionIds
let timerInterval = null;
let endTime = null;
let viewMode = 'single'; // 'single' or 'full'

document.addEventListener('DOMContentLoaded', initQuiz);

function showErrorOverlay(err) {
    const overlay = document.getElementById('errorOverlay');
    const title = document.getElementById('errorTitle');
    const msg = document.getElementById('errorMsg');
    const icon = document.getElementById('errorIcon');

    overlay.style.display = 'flex';

    // Map error codes
    switch (err.code) {
        case 1029: // QUIZ_EXPIRED
            title.innerText = "Bài thi đã kết thúc";
            msg.innerText = "Rất tiếc, thời gian làm bài của kỳ thi này đã hết. Bạn không thể bắt đầu lượt làm bài mới.";
            icon.innerText = "⏰";
            break;
        case 1030: // QUIZ_NOT_STARTED
            title.innerText = "Chưa đến giờ làm bài";
            msg.innerText = "Kỳ thi này chưa bắt đầu. Vui lòng quay lại vào đúng thời gian đã được thông báo.";
            icon.innerText = "📅";
            break;
        case 1028: // MAX_ATTEMPTS_REACHED
            title.innerText = "Hết lượt làm bài";
            msg.innerText = "Bạn đã hoàn thành tối đa số lượt làm bài cho phép đối với kỳ thi này.";
            icon.innerText = "🏁";
            break;
        default:
            title.innerText = "Không thể truy cập";
            msg.innerText = err.message || "Đã có lỗi xảy ra khi tải bài thi. Vui lòng kiểm tra lại kết nối hoặc liên hệ giáo viên.";
            icon.innerText = "⚠️";
    }

    const backBtn = document.querySelector('.btn-back');
    if (backBtn) {
        const returnUrl = sessionStorage.getItem('studentReturnUrl') || '/student';
        backBtn.href = returnUrl;
        if (returnUrl.includes('/classrooms/')) {
            backBtn.innerText = "Quay lại Lớp học";
        } else if (returnUrl.includes('/quizzes')) {
            backBtn.innerText = "Quay lại Đề thi";
        } else if (returnUrl.includes('/history')) {
            backBtn.innerText = "Quay lại Lịch sử";
        } else {
            backBtn.innerText = "Quay lại Trang chủ";
        }
    }
}

async function initQuiz() {
    const referrer = document.referrer;
    if (referrer && referrer.includes(window.location.host) && !referrer.includes('/play') && !referrer.includes('/result')) {
        sessionStorage.setItem('studentReturnUrl', referrer);
    }
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`/api/student/quiz/start?assigningId=${assigningId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!response.ok) {
            const errData = await response.json();
            showErrorOverlay(errData);
            return;
        }
        quizData = await response.json();

        // Initialize answers from server first
        userAnswers = quizData.selectedAnswers || {};
        if (quizData.selectedTexts) {
            Object.assign(userAnswers, quizData.selectedTexts);
        }

        const saved = localStorage.getItem(`quiz_answers_${quizData.attemptId}`);
        if (saved) {
            const localData = JSON.parse(saved);
            Object.assign(userAnswers, localData.answers || localData);
        }

        const savedFlags = localStorage.getItem(`quiz_flags_${quizData.attemptId}`);
        if (savedFlags) {
            flaggedQuestions = new Set(JSON.parse(savedFlags));
        }

        setupTimer();
        renderView();
        renderGrid();
        updateStats();

        document.getElementById('examTitle').textContent = quizData.quizTitle;
        document.getElementById('pageLoading').style.display = 'none';

        // Check for fullscreen after loading
        checkFullScreen();

    } catch (error) {
        console.error(error);
        showToast("Lỗi hệ thống khi tải bài thi.", 'error');
        window.location.href = '/student';
    }
}

function setupTimer() {
    if (!quizData.durationInMins) {
        document.getElementById('timerDisplay').textContent = "Không giới hạn";
        return;
    }
    const startTime = quizData.startedAtMillis || new Date(quizData.startedAt).getTime();
    const durationMs = quizData.durationInMins * 60 * 1000;
    endTime = new Date(startTime + durationMs);

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const now = new Date();
    const diff = endTime - now;

    if (diff <= 0) {
        clearInterval(timerInterval);
        document.getElementById('timerDisplay').textContent = "00:00";
        autoSubmit();
        return;
    }

    const mins = Math.floor(diff / 1000 / 60);
    const secs = Math.floor((diff / 1000) % 60);

    const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('timerDisplay').textContent = display;

    if (mins < 5) {
        document.getElementById('timerBox').classList.add('timer-warning');
    }
}

function setViewMode(mode) {
    viewMode = mode;
    document.getElementById('btnSingleMode').classList.toggle('active', mode === 'single');
    document.getElementById('btnFullMode').classList.toggle('active', mode === 'full');

    document.getElementById('singleModeView').style.display = mode === 'single' ? 'block' : 'none';
    document.getElementById('fullModeView').style.display = mode === 'full' ? 'block' : 'none';

    renderView();
    renderGrid();
}

function renderView() {
    if (viewMode === 'single') {
        renderSingleQuestion();
    } else {
        renderFullQuiz();
    }
}

function renderSingleQuestion() {
    const q = quizData.questions[currentIndex];
    document.getElementById('qNumber').textContent = `Câu ${currentIndex + 1}`;
    document.getElementById('qType').textContent = q.type === 'SINGLE_CHOICE' ? 'CHỌN MỘT ĐÁP ÁN' : (q.type === 'FILL_IN_BLANK' ? 'ĐIỀN KHUYẾT' : 'CHỌN NHIỀU ĐÁP ÁN');

    // Update Flag Button
    const btnFlag = document.getElementById('btnFlag');
    if (flaggedQuestions.has(q.id)) {
        btnFlag.classList.add('active');
        btnFlag.innerHTML = '<i class="bi bi-flag-fill"></i> <span>Đã đặt cờ</span>';
    } else {
        btnFlag.classList.remove('active');
        btnFlag.innerHTML = '<i class="bi bi-flag"></i> <span>Đặt cờ</span>';
    }

    const meta = document.querySelector('.q-meta');
    const existingLevel = meta.querySelector('.q-level-badge');
    if (existingLevel) existingLevel.remove();

    const levelBadge = document.createElement('span');
    levelBadge.className = `q-level-badge level-${(q.level || 'medium').toLowerCase()}`;
    levelBadge.textContent = q.level || 'MEDIUM';
    meta.appendChild(levelBadge);

    document.getElementById('qText').textContent = q.text;

    const list = document.getElementById('answersList');
    list.innerHTML = '';

    if (q.type === 'FILL_IN_BLANK') {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'fill-input';
        input.placeholder = 'Nhập câu trả lời của bạn tại đây...';
        input.value = userAnswers[q.id] || '';
        input.oninput = (e) => handleFillInput(q.id, e.target.value);
        list.appendChild(input);
    } else {
        q.answers.forEach((ans, i) => {
            const div = document.createElement('div');
            div.className = `answer-opt ${isAnswerSelected(q.id, ans.id) ? 'selected' : ''}`;
            div.innerHTML = `
                <div class="opt-prefix">${String.fromCharCode(65 + i)}</div>
                <div class="opt-text">${ans.text}</div>
            `;
            div.onclick = () => toggleAnswer(q.id, ans.id, q.type);
            list.appendChild(div);
        });
    }

    document.getElementById('btnPrev').disabled = currentIndex === 0;
    if (currentIndex === quizData.questions.length - 1) {
        document.getElementById('btnNext').classList.add('d-none');
    } else {
        document.getElementById('btnNext').classList.remove('d-none');
        document.getElementById('btnNext').innerHTML = 'Câu tiếp theo <i class="bi bi-chevron-right"></i>';
    }
}

function renderFullQuiz() {
    const container = document.getElementById('fullModeView');
    container.innerHTML = '';

    quizData.questions.forEach((q, idx) => {
        const qDiv = document.createElement('div');
        qDiv.className = 'full-mode-question';
        qDiv.id = `q-full-${idx}`;

        let answersHtml = '';
        if (q.type === 'FILL_IN_BLANK') {
            answersHtml = `<input type="text" class="fill-input" placeholder="Nhập câu trả lời..." value="${userAnswers[q.id] || ''}" oninput="handleFillInput(${q.id}, this.value, true)">`;
        } else {
            q.answers.forEach((ans, i) => {
                answersHtml += `
                    <div class="answer-opt ${isAnswerSelected(q.id, ans.id) ? 'selected' : ''}"
                         onclick="toggleAnswer(${q.id}, ${ans.id}, '${q.type}')">
                        <div class="opt-prefix">${String.fromCharCode(65 + i)}</div>
                        <div class="opt-text">${ans.text}</div>
                    </div>
                `;
            });
        }

        const isFlagged = flaggedQuestions.has(q.id);
        qDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <span class="q-type-badge">Câu ${idx + 1}</span>
                    <span class="q-type-badge text-muted">${q.type === 'SINGLE_CHOICE' ? 'CHỌN MỘT ĐÁP ÁN' : (q.type === 'FILL_IN_BLANK' ? 'ĐIỀN KHUYẾT' : 'CHỌN NHIỀU ĐÁP ÁN')}</span>
                    <span class="q-level-badge level-${(q.level || 'medium').toLowerCase()}">${q.level || 'MEDIUM'}</span>
                </div>
                <button class="btn-flag ${isFlagged ? 'active' : ''}" onclick="toggleFlagFor(${q.id})">
                    <i class="bi bi-flag${isFlagged ? '-fill' : ''}"></i> <span>${isFlagged ? 'Đã đặt cờ' : 'Đặt cờ'}</span>
                </button>
            </div>
            <div class="fw-bold fs-5 mb-3">${q.text}</div>
            <div class="answers-list">${answersHtml}</div>
        `;
        container.appendChild(qDiv);
    });

    // Add spacer at bottom to allow last questions to scroll up
    const spacer = document.createElement('div');
    spacer.style.height = '60vh';
    spacer.className = 'full-mode-spacer';
    container.appendChild(spacer);

    if (window.scrollObserver) window.scrollObserver.disconnect();
    const intersectingIndices = new Set();
    window.scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const idx = parseInt(entry.target.id.replace('q-full-', ''));
            if (entry.isIntersecting) intersectingIndices.add(idx);
            else intersectingIndices.delete(idx);
        });

        if (intersectingIndices.size > 0) {
            // Pick the smallest index among those currently in the "active" zone
            const bestIdx = Math.min(...Array.from(intersectingIndices));
            if (bestIdx !== currentIndex) {
                currentIndex = bestIdx;
                renderGrid();
                updateStats();
            }
        }
    }, {
        rootMargin: '-15% 0px -75% 0px',
        threshold: 0
    });
    document.querySelectorAll('.full-mode-question').forEach(q => window.scrollObserver.observe(q));
}

function toggleAnswer(qId, ansId, type) {
    if (type === 'SINGLE_CHOICE') {
        userAnswers[qId] = [ansId];
    } else {
        if (!Array.isArray(userAnswers[qId])) userAnswers[qId] = [];
        const idx = userAnswers[qId].indexOf(ansId);
        if (idx > -1) userAnswers[qId].splice(idx, 1);
        else userAnswers[qId].push(ansId);
    }

    saveToLocal();
    saveToServer(qId, userAnswers[qId]);
    renderView();
    renderGrid();
    updateStats();
}

function isAnswerSelected(qId, ansId) {
    return Array.isArray(userAnswers[qId]) && userAnswers[qId].includes(ansId);
}

function isQuestionAnswered(qId) {
    const ans = userAnswers[qId];
    return (Array.isArray(ans) && ans.length > 0) || (typeof ans === 'string' && ans.trim() !== '');
}

let fillDebounceTimer = null;
function handleFillInput(qId, val, isFullMode = false) {
    userAnswers[qId] = val;
    saveToLocal();
    clearTimeout(fillDebounceTimer);
    fillDebounceTimer = setTimeout(() => {
        saveToServer(qId, val);
    }, 500);
    renderGrid();
}

function saveToLocal() {
    const dataToSave = {
        answers: userAnswers,
        timestamp: new Date().getTime()
    };
    localStorage.setItem(`quiz_answers_${quizData.attemptId}`, JSON.stringify(dataToSave));
}

async function saveToServer(qId, val) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const q = quizData.questions.find(qu => qu.id == qId);
    const payload = {};
    if (q && q.type === 'FILL_IN_BLANK') {
        payload.selectedText = val;
    } else {
        payload.answerIds = val;
    }

    try {
        const response = await fetch(`/api/student/quiz/save-answer?attemptId=${quizData.attemptId}&questionId=${qId}`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            if (errData.code === 1029 || errData.code === 1027 || errData.code === 1022) {
                // QUIZ_EXPIRED or QUIZ_ASSIGNING_NOT_FOUND (hidden)
                showToast("Bài thi đã kết thúc. Bạn không thể thay đổi đáp án. Đang tự động nộp bài...", "err");
                setTimeout(() => executeSubmit(), 2000);
            }
        }
    } catch (e) {
        console.error("Lỗi khi lưu đáp án lên server:", e);
    }
}

function renderGrid() {
    const grid = document.getElementById('qGrid');
    if (!grid) return;
    grid.innerHTML = '';
    quizData.questions.forEach((q, i) => {
        const dot = document.createElement('div');
        const isAnswered = isQuestionAnswered(q.id);
        const isFlagged = flaggedQuestions.has(q.id);

        dot.className = `q-dot ${i === currentIndex ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${isFlagged ? 'flagged' : ''}`;
        dot.textContent = i + 1;
        dot.onclick = () => {
            currentIndex = i;
            if (viewMode === 'full') {
                document.getElementById(`q-full-${i}`).scrollIntoView({ behavior: 'smooth' });
            } else {
                renderView();
            }
            renderGrid();
        };
        grid.appendChild(dot);
    });
}

function updateStats() {
    const total = quizData.questions.length;
    const answered = Object.values(userAnswers).filter(a => (Array.isArray(a) && a.length > 0) || (typeof a === 'string' && a.trim() !== '')).length;
    document.getElementById('progressText').textContent = `${currentIndex + 1}/${total}`;
    document.getElementById('answeredCount').textContent = answered;
    document.getElementById('progressBar').style.width = (answered / total * 100) + '%';
}

function nextQuestion() {
    if (currentIndex < quizData.questions.length - 1) {
        currentIndex++;
        renderView();
        renderGrid();
        updateStats();
    }
}

function prevQuestion() {
    if (currentIndex > 0) {
        currentIndex--;
        renderView();
        renderGrid();
        updateStats();
    }
}

function submitQuiz() {
    document.getElementById('remainingTimeInfo').textContent = document.getElementById('timerDisplay').textContent;
    new bootstrap.Modal(document.getElementById('submitModal')).show();
}

async function executeSubmit() {
    isMonitoring = false;
    document.getElementById('pageLoading').style.display = 'flex';
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const submitBtn = document.querySelector('#submitModal .btn-primary');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang nộp...';

    try {
        const questions = quizData.questions.map(q => {
            const ans = userAnswers[q.id];
            const qPayload = { questionId: q.id };
            if (q.type === 'FILL_IN_BLANK') {
                qPayload.selectedText = ans || '';
            } else {
                qPayload.answerIds = ans || [];
            }
            return qPayload;
        });

        const response = await fetch('/api/student/quiz/submit', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                attemptId: quizData.attemptId,
                questions: questions
            })
        });

        if (response.ok) {
            const result = await response.json();
            localStorage.removeItem(`quiz_answers_${quizData.attemptId}`);
            localStorage.removeItem(`quiz_flags_${quizData.attemptId}`);
            window.location.replace(`/student/quiz/result/${result.id}`);
        } else {
            throw new Error("Lỗi khi nộp bài");
        }
    } catch (error) {
        showToast(error.message, 'error');
        document.getElementById('pageLoading').style.display = 'none';
    }
}

function autoSubmit() {
    showToast("Đã hết thời gian làm bài! Hệ thống sẽ tự động nộp bài.", "err");
    executeSubmit();
}

function confirmExit() {
    new bootstrap.Modal(document.getElementById('exitModal')).show();
}

function toggleFlag() {
    const qId = quizData.questions[currentIndex].id;
    toggleFlagFor(qId);
}

function toggleFlagFor(qId) {
    if (flaggedQuestions.has(qId)) {
        flaggedQuestions.delete(qId);
    } else {
        flaggedQuestions.add(qId);
    }
    saveFlagsToLocal();
    renderView();
    renderGrid();
}

function saveFlagsToLocal() {
    localStorage.setItem(`quiz_flags_${quizData.attemptId}`, JSON.stringify(Array.from(flaggedQuestions)));
}

function executeExit() {
    logViolation('MANUAL_EXIT');
    setTimeout(() => {
        isMonitoring = false;
        const returnUrl = sessionStorage.getItem('studentReturnUrl') || '/student';
        window.location.href = returnUrl;
    }, 500);
}

// Monitoring logic
let isMonitoring = true;
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isMonitoring) {
        logViolation('TAB_SWITCH');
    }
});

window.addEventListener('blur', () => {
    if (isMonitoring) {
        logViolation('WINDOW_BLUR');
    }
});

window.addEventListener('beforeunload', (event) => {
    if (isMonitoring) {
        logViolation('TAB_CLOSE', true);
    }
});

// Fullscreen Enforcement Logic
function checkFullScreen() {
    if (!document.fullscreenElement && isMonitoring) {
        document.getElementById('fullscreenOverlay').style.display = 'flex';
        document.getElementById('fsMessage').innerHTML = `
            <span class="text-danger fw-bold">Phát hiện hành động thoát toàn màn hình!</span><br>
            Để đảm bảo tính công bằng, vui lòng quay lại chế độ toàn màn hình để tiếp tục làm bài.
        `;
        return false;
    }
    return true;
}

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isMonitoring) {
        logViolation('FULLSCREEN_EXIT');
        checkFullScreen();
    } else if (document.fullscreenElement) {
        document.getElementById('fullscreenOverlay').style.display = 'none';
    }
});

function requestFullScreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
    }
}

const MAX_VIOLATIONS = 3;

async function logViolation(code, isBeacon = false) {
    if (!quizData || !quizData.attemptId) return;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const url = '/api/student/quiz/log-violation';
    const data = JSON.stringify({
        attemptId: quizData.attemptId,
        violationCode: code
    });

    // Dùng sendBeacon khi đóng tab (không đọc được response)
    if (isBeacon && navigator.sendBeacon) {
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
        return;
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: data
        });

        if (!res.ok) return;

        const result = await res.json();
        const count = result.violationCount || 0;
        const remaining = MAX_VIOLATIONS - count;

        if (result.autoSubmitted) {
            // Backend đã auto-submit → dừng monitoring, thông báo, redirect
            isMonitoring = false;
            clearInterval(timerInterval);
            showToast(`Bài thi đã bị nộp tự động do vi phạm ${count} lần!`, "err");
            localStorage.removeItem(`quiz_answers_${quizData.attemptId}`);
            localStorage.removeItem(`quiz_flags_${quizData.attemptId}`);
            setTimeout(() => {
                window.location.replace(`/student/quiz/result/${result.attemptId}`);
            }, 2000);
        } else {
            showToast(`⚠️ Cảnh báo vi phạm lần ${count}/${MAX_VIOLATIONS}! Còn ${remaining} lần trước khi bị nộp tự động.`, "err");
        }
    } catch (e) {
        console.error("Lỗi khi ghi nhận vi phạm:", e);
    }
}

    function showToast(msg, type = 'ok') {
        if (type === 'err' || type === 'error') toast.error(msg);
        else if (type === 'warn' || type === 'warning') toast.warning(msg);
        else toast.success(msg);
    }
