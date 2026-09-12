document.addEventListener('DOMContentLoaded', initQuiz);

const assigningId = document.body.dataset.assigningId;
const attemptId = document.body.dataset.attemptId;
let quizData = null;
let currentIndex = 0;
let userAnswers = {}; // questionId -> [answerIds]
let flaggedQuestions = new Set(); // set of questionIds
let timerInterval = null;
let endTime = null;
let viewMode = 'single'; // 'single' or 'full'

async function initQuiz() {
    const referrer = document.referrer;
    if (referrer && referrer.includes(window.location.host) && !referrer.includes('/play') && !referrer.includes('/result')) {
        sessionStorage.setItem('studentReturnUrl', referrer);
    }
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        let url = '';
        if (attemptId && attemptId !== 'null' && attemptId !== '') {
            url = `/api/student/quiz/resume?attemptId=${attemptId}`;
        } else if (assigningId && assigningId !== 'null' && assigningId !== '') {
            url = `/api/student/quiz/start?assigningId=${assigningId}`;
        } else {
            throw new Error("Thông tin bài thi không hợp lệ");
        }

        const response = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!response.ok) {
            let errorMsg = "Không thể tải bài thi";
            try {
                const errorData = await response.json();
                if (errorData.code === 1028) {
                    errorMsg = "Bạn đã hết số lần làm bài thi này!";
                } else if (errorData.message) {
                    errorMsg = errorData.message;
                }
            } catch (e) {}
            throw new Error(errorMsg);
        }
        quizData = await response.json();

        // Initialize answers and flags from server first, then local as backup
        userAnswers = quizData.selectedAnswers || {};
        if (quizData.selectedTexts) {
            Object.assign(userAnswers, quizData.selectedTexts);
        }

        const savedAnswers = localStorage.getItem(`quiz_answers_${quizData.attemptId}`);
        if (savedAnswers) {
            const localData = JSON.parse(savedAnswers);
            Object.assign(userAnswers, localData);
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

    } catch (error) {
        showToast(error.message, 'err');
        window.location.href = '/student';
    }
}

function setupTimer() {
    if (!quizData.durationInMins) {
        document.getElementById('timerDisplay').textContent = "Không giới hạn";
        return;
    }
    const startedAt = new Date(quizData.startedAt);
    const durationMs = quizData.durationInMins * 60 * 1000;
    endTime = new Date(startedAt.getTime() + durationMs);

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    if (!endTime) return;
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
    document.getElementById('qText').textContent = q.text;

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

    // Update Nav Buttons
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
        const levelClass = `level-${(q.level || 'medium').toLowerCase()}`;
        const levelText = q.level || 'MEDIUM';
        
        qDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="d-flex align-items-center gap-2">
                    <span class="q-type-badge">Câu ${idx + 1}</span>
                    <span class="q-type-badge text-muted">${q.type === 'SINGLE_CHOICE' ? 'CHỌN MỘT ĐÁP ÁN' : (q.type === 'FILL_IN_BLANK' ? 'ĐIỀN KHUYẾT' : 'CHỌN NHIỀU ĐÁP ÁN')}</span>
                    <span class="q-level-badge ${levelClass}">${levelText}</span>
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

    // --- Scroll Spy for Full Mode ---
    if (window.scrollObserver) window.scrollObserver.disconnect();
    window.scrollObserver = new IntersectionObserver((entries) => {
        const visibleEntry = entries.find(e => e.isIntersecting);
        if (visibleEntry) {
            const idx = parseInt(visibleEntry.target.id.replace('q-full-', ''));
            currentIndex = idx;
            renderGrid();
            updateStats();
        }
    }, {
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0
    });
    document.querySelectorAll('.full-mode-question').forEach(q => window.scrollObserver.observe(q));
}

function toggleAnswer(qId, ansId, type) {
    if (type === 'SINGLE_CHOICE') {
        userAnswers[qId] = [ansId];
    } else {
        if (!userAnswers[qId] || !Array.isArray(userAnswers[qId])) userAnswers[qId] = [];
        const idx = userAnswers[qId].indexOf(ansId);
        if (idx > -1) userAnswers[qId].splice(idx, 1);
        else userAnswers[qId].push(ansId);
    }
    
    saveToLocal();
    saveToServer(qId, userAnswers[qId], null);
    renderView(); 
    renderGrid();
    updateStats();
}

let fillInputTimeout = null;
function handleFillInput(qId, value, fromFullMode = false) {
    userAnswers[qId] = value;
    saveToLocal();
    renderGrid();
    updateStats();

    clearTimeout(fillInputTimeout);
    fillInputTimeout = setTimeout(() => {
        saveToServer(qId, [], value);
    }, 500);
}

function isAnswerSelected(qId, ansId) {
    return userAnswers[qId] && Array.isArray(userAnswers[qId]) && userAnswers[qId].includes(ansId);
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

function saveToLocal() {
    localStorage.setItem(`quiz_answers_${quizData.attemptId}`, JSON.stringify(userAnswers));
}

async function saveToServer(qId, answerIds, selectedText = null) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const payload = selectedText !== null ? { selectedText: selectedText } : { answerIds: answerIds };
        await fetch(`/api/student/quiz/save-answer?attemptId=${quizData.attemptId}&questionId=${qId}`, {
            method: 'POST',
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
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
        const ans = userAnswers[q.id];
        const isAnswered = ans && ((Array.isArray(ans) && ans.length > 0) || (typeof ans === 'string' && ans.trim() !== ''));
        const isFlagged = flaggedQuestions.has(q.id);
        
        dot.className = `q-dot ${i === currentIndex ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${isFlagged ? 'flagged' : ''}`;
        dot.textContent = i + 1;
        dot.onclick = () => {
            currentIndex = i;
            if (viewMode === 'full') {
                const fullEl = document.getElementById(`q-full-${i}`);
                if (fullEl) fullEl.scrollIntoView({ behavior: 'smooth' });
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
    const progText = document.getElementById('progressText');
    if (progText) progText.textContent = `${currentIndex + 1}/${total}`;
    const ansCount = document.getElementById('answeredCount');
    if (ansCount) ansCount.textContent = answered;
    const progBar = document.getElementById('progressBar');
    if (progBar) progBar.style.width = (answered / total * 100) + '%';
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
    const timerDisp = document.getElementById('timerDisplay');
    const remTime = document.getElementById('remainingTimeInfo');
    if (timerDisp && remTime) {
        remTime.textContent = timerDisp.textContent;
    }
    new bootstrap.Modal(document.getElementById('submitModal')).show();
}

async function executeSubmit() {
    document.getElementById('pageLoading').style.display = 'flex';
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const submitBtn = document.querySelector('#submitModal .btn-primary');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang nộp...';

    try {
        // Prepare request body
        const questions = quizData.questions.map(q => {
            const ans = userAnswers[q.id];
            if (q.type === 'FILL_IN_BLANK') {
                return { questionId: q.id, answerIds: [], selectedText: ans || '' };
            } else {
                return { questionId: q.id, answerIds: Array.isArray(ans) ? ans : [] };
            }
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
        showToast(error.message, 'err');
        document.getElementById('pageLoading').style.display = 'none';
    }
}

function autoSubmit() {
    showToast("Đã hết thời gian làm bài! Hệ thống sẽ tự động nộp bài.", 'err');
    executeSubmit();
}

function confirmExit() {
    new bootstrap.Modal(document.getElementById('exitModal')).show();
}

function executeExit() {
    const returnUrl = sessionStorage.getItem('studentReturnUrl') || '/student';
    window.location.href = returnUrl;
}

window.setViewMode = setViewMode;
window.prevQuestion = prevQuestion;
window.nextQuestion = nextQuestion;
window.toggleFlag = toggleFlag;
window.toggleFlagFor = toggleFlagFor;
window.toggleAnswer = toggleAnswer;
window.submitQuiz = submitQuiz;
window.executeSubmit = executeSubmit;
window.confirmExit = confirmExit;
window.executeExit = executeExit;
