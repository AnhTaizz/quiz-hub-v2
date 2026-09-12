// ── Data & State ──
let questions = [];
let settings = { showAnswer: true, shuffle: false, shuffleAnswers: false, displayMode: 'sequential' };
let categoryId = null;
let categoryName = "";

let currentIndex = 0;
let practiceId = null;
let userAnswers = {}; // qId -> val
let flaggedQuestions = new Set(); // qId set
let answeredCorrectly = {}; // qId -> boolean
let practiceResult = null; // Store result details for review
let confirmedAnswers = {}; // questionId -> boolean (used in showAnswer mode)

document.addEventListener('DOMContentLoaded', () => {
    initData();
});

async function initData() {
    const referrer = document.referrer;
    if (referrer && referrer.includes(window.location.host) && !referrer.includes('/play') && !referrer.includes('/review/')) {
        sessionStorage.setItem('studentReturnUrl', referrer);
    }
    try {
        // If we have a review ID from URL
        const rId = window.reviewPracticeId;
        if (rId) {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            try {
                const res = await fetch(`/api/student/practice/history/detail?id=${rId}`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    const data = await res.json();
                    practiceResult = data;
                    categoryId = data.categoryId || 0;
                    categoryName = data.categoryName || "Review Mode";
                    document.getElementById('topCategoryName').textContent = categoryName;

                    questions = data.details.map(d => ({
                        id: d.questionId,
                        text: d.questionText,
                        level: d.questionLevel || 'MEDIUM',
                        type: d.questionType || 'SINGLE_CHOICE',
                        answers: d.answers || []
                    }));

                    data.details.forEach(d => {
                        const q = questions.find(qu => qu.id === d.questionId);
                        if (q) {
                            if (q.type === 'FILL_IN_BLANK') {
                                userAnswers[d.questionId] = d.selectedText;
                            } else if (q.type === 'MULTIPLE_CHOICE') {
                                userAnswers[d.questionId] = d.selectedAnswerIds || [];
                            } else {
                                userAnswers[d.questionId] = d.selectedAnswerIds && d.selectedAnswerIds.length > 0 ? d.selectedAnswerIds[0] : null;
                            }
                        }
                        answeredCorrectly[d.questionId] = d.isCorrect;
                    });

                    showResult(data, true);
                    return;
                }
            } catch (err) {
                console.error("Failed to fetch review detail", err);
            }
        }

        // Check if we are in review mode via sessionStorage (fallback)
        const isReview = sessionStorage.getItem('practice_review_mode');
        if (isReview === 'true') {
            const data = JSON.parse(sessionStorage.getItem('practice_result_data'));
            sessionStorage.removeItem('practice_review_mode'); // Clear it

            if (data) {
                practiceResult = data;
                categoryId = data.categoryId || 0;
                categoryName = data.categoryName || "Review";

                // Map result details back to questions for rendering
                questions = data.details.map(d => ({
                    id: d.questionId,
                    text: d.questionText,
                    level: d.questionLevel || 'MEDIUM',
                    type: d.questionType || 'SINGLE_CHOICE',
                    answers: d.answers || [] // Now included in the DTO!
                }));

                // Populate userAnswers and answeredCorrectly for immediate use
                data.details.forEach(d => {
                    const q = questions.find(qu => qu.id === d.questionId);
                    if (q) {
                        if (q.type === 'FILL_IN_BLANK') {
                            userAnswers[d.questionId] = d.selectedText;
                        } else if (q.type === 'MULTIPLE_CHOICE') {
                            userAnswers[d.questionId] = d.selectedAnswerIds || [];
                        } else {
                            userAnswers[d.questionId] = d.selectedAnswerIds && d.selectedAnswerIds.length > 0 ? d.selectedAnswerIds[0] : null;
                        }
                    }
                    answeredCorrectly[d.questionId] = d.isCorrect;
                });

                showResult(data, true);
                return;
            }
        }

        const rawQ = sessionStorage.getItem('practice_questions');
        practiceId = sessionStorage.getItem('practice_id');
        const rawS = sessionStorage.getItem(`practice_settings_${practiceId}`) || sessionStorage.getItem('practice_settings');
        const idRaw = sessionStorage.getItem('practice_category_id');
        categoryId = idRaw ? parseInt(idRaw) : null;
        categoryName = sessionStorage.getItem('practice_category_name');
        questions = JSON.parse(rawQ);
        if (rawS) settings = JSON.parse(rawS);

        // Load progress from questions themselves (newly supported)
        questions.forEach(q => {
            if (q.selectedAnswerIds && q.selectedAnswerIds.length > 0) {
                if (q.type === 'MULTIPLE_CHOICE') {
                    userAnswers[q.id] = q.selectedAnswerIds;
                } else if (q.type === 'FILL_IN_BLANK') {
                    userAnswers[q.id] = q.selectedText;
                } else {
                    userAnswers[q.id] = q.selectedAnswerIds[0];
                }
            } else if (q.selectedText) {
                userAnswers[q.id] = q.selectedText;
            }
            
            if (q.isCorrect !== null) {
                answeredCorrectly[q.id] = q.isCorrect;
                confirmedAnswers[q.id] = true;
            }
        });

        if (!rawQ || !categoryId) {
            window.location.href = sessionStorage.getItem('studentReturnUrl') || '/student/categories';
            return;
        }

        // Handle shuffle persistence
        const isShuffled = sessionStorage.getItem(`practice_is_shuffled_${practiceId}`);
        if (settings.shuffle && !isShuffled) {
            shuffleArray(questions, practiceId);
            sessionStorage.setItem('practice_questions', JSON.stringify(questions));
            sessionStorage.setItem(`practice_is_shuffled_${practiceId}`, 'true');
        }

        // Load saved progress from local session (if any, overwrites server if newer)
        const savedFlags = sessionStorage.getItem(`practice_flagged_questions_${practiceId}`);
        if (savedFlags) {
            flaggedQuestions = new Set(JSON.parse(savedFlags));
        }
        const savedAnswers = sessionStorage.getItem(`practice_user_answers_${practiceId}`);
        if (savedAnswers) Object.assign(userAnswers, JSON.parse(savedAnswers));

        const savedCorrectly = sessionStorage.getItem(`practice_answered_correctly_${practiceId}`);
        if (savedCorrectly) Object.assign(answeredCorrectly, JSON.parse(savedCorrectly));

        const savedConfirmed = sessionStorage.getItem(`practice_confirmed_answers_${practiceId}`);
        if (savedConfirmed) Object.assign(confirmedAnswers, JSON.parse(savedConfirmed));

        document.getElementById('topCategoryName').textContent = categoryName || "Danh mục";
        renderNav();

        const savedIndex = sessionStorage.getItem(`practice_current_index_${practiceId}`);
        const startIndex = savedIndex ? parseInt(savedIndex) : 0;
        showQuestion(startIndex);

        // Hide loader
        const loader = document.getElementById('pageLoading');
        if (loader) loader.style.display = 'none';
    } catch (e) {
        console.error(e);
        showToast("Lỗi dữ liệu luyện tập", "err");
        const loader = document.getElementById('pageLoading');
        if (loader) loader.style.display = 'none';
    }
}

function toggleFlag() {
    const q = questions[currentIndex];
    if (!q || practiceResult) return;
    
    if (flaggedQuestions.has(q.id)) {
        flaggedQuestions.delete(q.id);
    } else {
        flaggedQuestions.add(q.id);
    }
    
    sessionStorage.setItem(`practice_flagged_questions_${practiceId}`, JSON.stringify([...flaggedQuestions]));
    renderNav();
    showQuestion(currentIndex);
}

function shuffleArray(array, seed) {
    let rng = Math.random;
    if (seed !== undefined) {
        // Simple deterministic seed-based RNG (Mulberry32)
        let s = parseInt(seed) || 0;
        rng = function() {
            let t = s += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// ── UI Rendering ──
function renderNav() {
    const nav = document.getElementById('questionNav');
    nav.innerHTML = '';

    // Hide legend in review mode
    const legend = document.getElementById('navLegend');
    if (legend) legend.style.display = practiceResult ? 'none' : 'block';

    questions.forEach((q, i) => {
        const dot = document.createElement('div');
        dot.className = 'nav-dot';
        dot.textContent = i + 1;
        dot.id = `nav-${i}`;

        if (!practiceResult && flaggedQuestions.has(q.id)) {
            dot.classList.add('flagged');
        }

        // Coloring logic
        if (practiceResult) {
            const isCorrect = answeredCorrectly[q.id];
            dot.classList.add(isCorrect ? 'correct' : 'incorrect');
        } else if (userAnswers[q.id]) {
            dot.classList.add('answered');
            if (settings.showAnswer) {
                dot.classList.add(answeredCorrectly[q.id] ? 'correct' : 'incorrect');
            }
        }

        if (i === currentIndex) dot.classList.add('active');

        dot.onclick = () => showQuestion(i);
        nav.appendChild(dot);
    });
}

function showQuestion(index) {
    if (settings.displayMode === 'all') {
        // If not rendered yet, render first
        if (!document.getElementById('allQuestionsList')) {
            renderAllQuestions();
        }

        const el = document.getElementById(`q-block-${index}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            currentIndex = index;

            // Highlight active dot
            document.querySelectorAll('.nav-dot').forEach(d => d.classList.remove('active'));
            const dot = document.getElementById(`nav-${index}`);
            if (dot) dot.classList.add('active');
        }
        return;
    }

    if (settings.displayMode === 'flashcard') {
        document.getElementById('questionArea').style.display = 'none';
        const fa = document.getElementById('flashcardArea');
        if (fa) fa.style.display = 'block';

        currentIndex = index;
        sessionStorage.setItem(`practice_current_index_${practiceId}`, index);
        const q = questions[index];
        if (!q) return;

        // Update Nav dots
        document.querySelectorAll('.nav-dot').forEach(d => d.classList.remove('active'));
        const dot = document.getElementById(`nav-${index}`);
        if (dot) dot.classList.add('active');

        // Populate flashcard
        const fcCard = document.getElementById('fcCard');
        if (fcCard) fcCard.classList.remove('is-flipped'); // reset to front

        document.getElementById('fcNumber').textContent = `Câu ${index + 1}/${questions.length}`;
        const typeText = q.type === 'MULTIPLE_CHOICE' ? 'CHỌN NHIỀU' : (q.type === 'FILL_IN_BLANK' ? 'ĐIỀN KHUYẾT' : 'CHỌN MỘT');
        document.getElementById('fcType').textContent = typeText;
        
        // Handle line breaks in question text safely
        document.getElementById('fcFrontText').innerHTML = q.text ? esc(q.text).replace(/\n/g, '<br>') : '';

        // Build back content
        let backContent = '';
        if (q.type === 'FILL_IN_BLANK') {
            const correctTexts = (q.answers || []).filter(a => a.isCorrect).map(a => esc(a.text.trim()));
            backContent = correctTexts.join(' <span class="text-muted mx-2">hoặc</span> ');
        } else {
            const correctAnswers = (q.answers || []).filter(a => a.isCorrect);
            backContent = correctAnswers.map((a, i) => `<div class="mb-3"><i class="bi bi-check-circle-fill me-2" style="color:var(--secondary);"></i>${esc(a.text)}</div>`).join('');
        }
        document.getElementById('fcBackText').innerHTML = backContent || '<div class="text-muted">Không có đáp án cụ thể</div>';

        // Update Buttons
        document.getElementById('fcBtnPrev').disabled = (index === 0);
        if (index === questions.length - 1) {
            document.getElementById('fcBtnNext').classList.add('d-none');
            document.getElementById('fcBtnFinish').classList.remove('d-none');
        } else {
            document.getElementById('fcBtnNext').classList.remove('d-none');
            document.getElementById('fcBtnFinish').classList.add('d-none');
        }
        
        // Hide legend since flashcard mode doesn't use answered/correct coloring exactly
        const legend = document.getElementById('navLegend');
        if (legend) legend.style.display = 'none';
        
        return;
    }

    // Hide flashcard area if returning to sequential mode
    const fa = document.getElementById('flashcardArea');
    if (fa) fa.style.display = 'none';
    document.getElementById('questionArea').style.display = 'block';

    currentIndex = index;
    sessionStorage.setItem(`practice_current_index_${practiceId}`, index);
    const q = questions[index];
    if (!q) return;

    // Update Nav dots
    document.querySelectorAll('.nav-dot').forEach(d => d.classList.remove('active'));
    const dot = document.getElementById(`nav-${index}`);
    if (dot) dot.classList.add('active');

    // Update Header
    document.getElementById('qNumber').textContent = `Câu ${index + 1}/${questions.length}`;
    const typeEl = document.getElementById('qType');
    typeEl.textContent = q.type === 'MULTIPLE_CHOICE' ? 'CHỌN NHIỀU' : (q.type === 'FILL_IN_BLANK' ? 'ĐIỀN KHUYẾT' : 'CHỌN MỘT');

    const levelEl = document.getElementById('qLevel');
    levelEl.textContent = q.level || 'MEDIUM';
    levelEl.className = 'q-level-badge level-' + (q.level ? q.level.toLowerCase() : 'medium');

    // Question Text
    document.getElementById('qText').textContent = q.text;

    // Update Flag Button
    const btnFlag = document.getElementById('btnFlag');
    if (btnFlag) {
        // Hide flag button when in review mode
        if (practiceResult) {
            btnFlag.style.display = 'none';
        } else {
            btnFlag.style.display = '';
            if (flaggedQuestions.has(q.id)) {
                btnFlag.classList.add('active');
                btnFlag.innerHTML = '<i class="bi bi-flag-fill"></i> <span>Đã đặt cờ</span>';
            } else {
                btnFlag.classList.remove('active');
                btnFlag.innerHTML = '<i class="bi bi-flag"></i> <span>Đặt cờ</span>';
            }
        }
    }

    // Answers
    const list = document.getElementById('answersList');
    list.innerHTML = '';

    const feedback = document.getElementById('feedbackBox');
    feedback.style.display = 'none';

    const userVal = userAnswers[q.id];
    const isAnswered = q.type === 'FILL_IN_BLANK' ? (userVal && userVal.trim() !== '') : (Array.isArray(userVal) ? userVal.length > 0 : !!userVal);
    const showResults = settings.showAnswer || !!practiceResult;

    if (q.type === 'FILL_IN_BLANK') {
        const isLocked = !!practiceResult || (settings.showAnswer && confirmedAnswers[q.id]);
        const inputHtml = `
                <div class="p-3">
                    <label class="form-label fw-bold mb-2">Nhập đáp án của bạn:</label>
                    <input type="text" class="form-control form-control-lg rounded-4 ${isLocked ? 'locked' : ''}" 
                           id="fillInput-${q.id}" 
                           value="${userVal || ''}" 
                           placeholder="Gõ câu trả lời tại đây..." 
                           ${isLocked ? 'readonly' : ''}
                           oninput="handleFillInput(${q.id}, this.value)">
                </div>
            `;
        list.innerHTML = inputHtml;
    } else {
        // Shuffle answers if enabled (seeded by question id for consistency on reload)
        let displayAnswers = [...q.answers];
        if (settings.shuffleAnswers) {
            shuffleArray(displayAnswers, q.id);
        }

        displayAnswers.forEach((a, idx) => {
            const prefix = String.fromCharCode(65 + idx);
            const item = document.createElement('div');
            item.className = 'answer-item';

            let isSelected = false;
            if (q.type === 'MULTIPLE_CHOICE') {
                isSelected = Array.isArray(userVal) && userVal.includes(a.id);
                item.innerHTML = `
                    <div class="answer-prefix">${prefix}</div>
                    <div class="answer-content d-flex justify-content-between align-items-center">
                        <span>${esc(a.text)}</span>
                        <i class="bi ${isSelected ? 'bi-check-square-fill text-primary' : 'bi-square'}"></i>
                    </div>
                `;
            } else {
                isSelected = userVal == a.id;
                item.innerHTML = `
                    <div class="answer-prefix">${prefix}</div>
                    <div class="answer-content">${esc(a.text)}</div>
                `;
            }

            if (isSelected) item.classList.add('selected');

            const isLocked = !!practiceResult || (settings.showAnswer && confirmedAnswers[q.id]);

            if (isLocked) {
                item.classList.add('locked');
                if (a.isCorrect) item.classList.add('correct');
                else if (isSelected) item.classList.add('incorrect');
            }

            if (!item.classList.contains('locked') && !practiceResult) {
                item.onclick = (event) => selectAnswer(q.id, a.id, a.isCorrect, event);
            }

            list.appendChild(item);
        });
    }

    // Add Check button for Multi/Fill if showAnswer is on
    const isLocked = !!practiceResult || (settings.showAnswer && confirmedAnswers[q.id]);
    if (settings.showAnswer && !isLocked && !practiceResult && (q.type === 'MULTIPLE_CHOICE' || q.type === 'FILL_IN_BLANK')) {
        const checkBtnWrap = document.createElement('div');
        checkBtnWrap.className = 'text-center mt-3';
        checkBtnWrap.innerHTML = `
            <button class="btn btn-primary rounded-pill px-4" onclick="checkAnswer(${q.id}, ${index})">
                <i class="bi bi-check-lg"></i> Kiểm tra
            </button>
        `;
        list.appendChild(checkBtnWrap);
    }

    // Update Buttons
    document.getElementById('btnPrev').disabled = (index === 0);
    if (index === questions.length - 1) {
        document.getElementById('btnNext').classList.add('d-none');
        if (!practiceResult) {
            document.getElementById('btnFinish').classList.remove('d-none');
        }
    } else {
        document.getElementById('btnNext').classList.remove('d-none');
        document.getElementById('btnFinish').classList.add('d-none');
    }

    // Show feedback
    if (isLocked) {
        showFeedback(answeredCorrectly[q.id], q);
    }
}

function renderAllQuestions() {
    const container = document.getElementById('questionArea');
    container.innerHTML = '<div id="allQuestionsList"></div>';
    if (!practiceResult) {
        const footer = document.createElement('div');
        footer.className = 'd-flex justify-content-center mt-5';
        footer.innerHTML = `
            <button class="btn-finish" id="btnFinish" onclick="submitPractice()">
                <i class="bi bi-check2-all"></i> Nộp tất cả bài làm
            </button>
        `;
        container.appendChild(footer);
    }

    const list = document.getElementById('allQuestionsList');
    questions.forEach((q, index) => {
        const qBlock = document.createElement('div');
        qBlock.className = 'question-card mb-4';
        qBlock.id = `q-block-${index}`;

        const userVal = userAnswers[q.id];
        const isAnswered = q.type === 'FILL_IN_BLANK' ? (userVal && userVal.trim() !== '') : (Array.isArray(userVal) ? userVal.length > 0 : !!userVal);
        const showResults = settings.showAnswer || !!practiceResult;

        const isLocked = !!practiceResult || (settings.showAnswer && confirmedAnswers[q.id]);

        let contentHtml = '';
        if (q.type === 'FILL_IN_BLANK') {
            contentHtml = `
                <div class="p-3">
                    <input type="text" class="form-control form-control-lg rounded-4 ${isLocked ? 'locked' : ''}" 
                           value="${userVal || ''}" 
                           placeholder="Gõ câu trả lời..."
                           ${isLocked ? 'readonly' : ''}
                           oninput="handleFillInput(${q.id}, this.value, ${index})">
                </div>
            `;
        } else {
            let answersHtml = '';
            // Shuffle answers if enabled (seeded by question id for consistency on reload)
            let displayAnswers = [...q.answers];
            if (settings.shuffleAnswers) {
                shuffleArray(displayAnswers, q.id);
            }

            displayAnswers.forEach((a, idx) => {
                const prefix = String.fromCharCode(65 + idx);
                let isSelected = false;
                if (q.type === 'MULTIPLE_CHOICE') {
                    isSelected = Array.isArray(userVal) && userVal.includes(a.id);
                } else {
                    isSelected = userVal == a.id;
                }

                let classes = 'answer-item';
                if (isSelected) classes += ' selected';

                if (isLocked) {
                    classes += ' locked';
                    if (a.isCorrect) classes += ' correct';
                    else if (isSelected) classes += ' incorrect';
                }

                let innerContent = '';
                if (q.type === 'MULTIPLE_CHOICE') {
                    innerContent = `
                        <div class="answer-prefix">${prefix}</div>
                        <div class="answer-content d-flex justify-content-between align-items-center">
                            <span>${esc(a.text)}</span>
                            <i class="bi ${isSelected ? 'bi-check-square-fill text-primary' : 'bi-square'}"></i>
                        </div>
                    `;
                } else {
                    innerContent = `
                        <div class="answer-prefix">${prefix}</div>
                        <div class="answer-content">${esc(a.text)}</div>
                    `;
                }

                answersHtml += `
                    <div class="${classes}" ${(!classes.includes('locked') && !practiceResult) ? `onclick="selectAnswer(${q.id}, ${a.id}, ${a.isCorrect}, event, ${index})"` : ''}>
                        ${innerContent}
                    </div>
                `;
            });
            contentHtml = `<div class="answers-list mb-3">${answersHtml}</div>`;
        }

        let checkBtnHtml = '';
        if (settings.showAnswer && !isLocked && !practiceResult && (q.type === 'MULTIPLE_CHOICE' || q.type === 'FILL_IN_BLANK')) {
            checkBtnHtml = `
                <div class="text-center mt-2 mb-3">
                    <button class="btn btn-sm btn-primary rounded-pill px-3" onclick="checkAnswer(${q.id}, ${index})">
                        <i class="bi bi-check-lg"></i> Kiểm tra
                    </button>
                </div>
            `;
        }

        let feedbackHtml = '';
        if (isLocked) {
            const isCorrect = answeredCorrectly[q.id];
            let feedbackText = '';
            
            // Commented out feedback messages for choice questions as correct/incorrect is already highlighted on answers
            if (q.type === 'FILL_IN_BLANK') {
                if (isCorrect) feedbackText = '<i class="bi bi-check-circle-fill me-2"></i> <strong>Chính xác!</strong>';
                else if (isAnswered) {
                    feedbackText = '<i class="bi bi-x-circle-fill me-2"></i> <strong>Chưa đúng!</strong>';
                    if (practiceResult) {
                        const detail = practiceResult.details.find(d => d.questionId === q.id);
                        if (detail && detail.correctTexts) {
                            feedbackText += `<br><small>Đáp án đúng là: <strong>${detail.correctTexts.join(' hoặc ')}</strong></small>`;
                        }
                    }
                } else feedbackText = '<i class="bi bi-exclamation-circle-fill me-2"></i> <strong>Chưa trả lời!</strong>';

                feedbackHtml = `
                    <div class="feedback-box ${isCorrect ? 'correct' : 'incorrect'}" style="display:block;">
                        ${feedbackText}
                    </div>
                `;
            }
        }

        qBlock.innerHTML = `
            <div class="d-flex justify-content-between mb-3">
                <div class="d-flex gap-2 align-items-center">
                    <span class="q-number-badge">Câu ${index + 1}</span>
                    <span class="q-type-badge">${q.type === 'MULTIPLE_CHOICE' ? 'CHỌN NHIỀU' : (q.type === 'FILL_IN_BLANK' ? 'ĐIỀN KHUYẾT' : 'CHỌN MỘT')}</span>
                    <span class="q-level-badge level-${q.level ? q.level.toLowerCase() : 'medium'}">${q.level || 'MEDIUM'}</span>
                </div>
                ${!practiceResult ? `
                <button class="btn-flag ${flaggedQuestions.has(q.id) ? 'active' : ''}" onclick="toggleFlagFor(${q.id})">
                    <i class="bi bi-flag${flaggedQuestions.has(q.id) ? '-fill' : ''}"></i> <span>${flaggedQuestions.has(q.id) ? 'Đã đặt cờ' : 'Đặt cờ'}</span>
                </button>` : ''}
            </div>
            <div class="question-text mb-4">${esc(q.text)}</div>
            ${contentHtml}
            ${checkBtnHtml}
            ${feedbackHtml}
        `;
        list.appendChild(qBlock);
    });

    // --- Scroll Spy Implementation ---
    if (window.scrollObserver) window.scrollObserver.disconnect();
    
    window.scrollObserver = new IntersectionObserver((entries) => {
        // Find the entry that is most visible or near the top
        const visibleEntry = entries.find(e => e.isIntersecting);
        if (visibleEntry) {
            const index = parseInt(visibleEntry.target.id.replace('q-block-', ''));
            
            // Update dots
            document.querySelectorAll('.nav-dot').forEach(d => d.classList.remove('active'));
            const dot = document.getElementById(`nav-${index}`);
            if (dot) dot.classList.add('active');
            
            currentIndex = index;
        }
    }, {
        // Trigger when the question is roughly in the top 30% of the screen
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0
    });

    document.querySelectorAll('[id^="q-block-"]').forEach(block => {
        window.scrollObserver.observe(block);
    });
}

function selectAnswer(qId, aId, isCorrect, event, index) {
    if (practiceResult) return;

    const q = questions.find(qu => qu.id === qId);
    if (!q) return;

    if (q.type === 'MULTIPLE_CHOICE') {
        if (!Array.isArray(userAnswers[qId])) userAnswers[qId] = [];
        const idx = userAnswers[qId].indexOf(aId);
        if (idx > -1) userAnswers[qId].splice(idx, 1);
        else userAnswers[qId].push(aId);

        // For MULTIPLE_CHOICE immediate feedback, we'd need to know if the FULL set is correct.
        // For simplicity in practice mode, we might wait for a "Check" button or just check current set.
        const correctIds = q.answers.filter(a => a.isCorrect).map(a => a.id).sort();
        const selectedIds = [...userAnswers[qId]].sort();
        answeredCorrectly[qId] = JSON.stringify(correctIds) === JSON.stringify(selectedIds);
    } else {
        userAnswers[qId] = aId;
        answeredCorrectly[qId] = isCorrect;
    }

    if (q.type === 'SINGLE_CHOICE' && settings.showAnswer) {
        confirmedAnswers[qId] = true;
        sessionStorage.setItem(`practice_confirmed_answers_${practiceId}`, JSON.stringify(confirmedAnswers));
    }

    sessionStorage.setItem(`practice_user_answers_${practiceId}`, JSON.stringify(userAnswers));
    sessionStorage.setItem(`practice_answered_correctly_${practiceId}`, JSON.stringify(answeredCorrectly));

    const currentIdx = (index !== undefined) ? index : currentIndex;
    const dot = document.getElementById(`nav-${currentIdx}`);

    const isAnswered = q.type === 'MULTIPLE_CHOICE' ? userAnswers[qId].length > 0 : !!userAnswers[qId];
    if (isAnswered) dot.classList.add('answered');
    else dot.classList.remove('answered');

    const isLocked = !!practiceResult || (settings.showAnswer && confirmedAnswers[q.id]);

    if (isLocked) {
        if (dot) dot.classList.add(answeredCorrectly[q.id] ? 'correct' : 'incorrect');
    }

    if (settings.displayMode === 'all') {
        renderAllQuestions();
        document.getElementById(`q-block-${currentIdx}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        showQuestion(currentIndex);
    }

    // Persistence on Server
    if (practiceId) {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const val = userAnswers[qId];
        const dto = { questionId: qId };
        if (q.type === 'FILL_IN_BLANK') {
            dto.selectedText = val || "";
        } else if (q.type === 'MULTIPLE_CHOICE') {
            dto.selectedAnswerIds = Array.isArray(val) ? val : [];
        } else {
            dto.selectedAnswerId = val || null;
        }

        fetch(`/api/student/practice/save-answer?practiceId=${practiceId}`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).catch(err => console.error("Auto-save failed", err));
    }
}

function handleFillInput(qId, val, index) {
    if (practiceResult) return;
    userAnswers[qId] = val;

    const q = questions.find(qu => qu.id === qId);
    const correctTexts = q.answers.filter(a => a.isCorrect).map(a => a.text.trim());
    answeredCorrectly[qId] = correctTexts.includes(val.trim());

    sessionStorage.setItem(`practice_user_answers_${practiceId}`, JSON.stringify(userAnswers));
    sessionStorage.setItem(`practice_answered_correctly_${practiceId}`, JSON.stringify(answeredCorrectly));

    const currentIdx = (index !== undefined) ? index : currentIndex;
    const dot = document.getElementById(`nav-${currentIdx}`);
    if (val && val.trim() !== '') dot.classList.add('answered');
    else dot.classList.remove('answered');

    if (settings.displayMode === 'all') {
        // If in 'all' mode, we might want to update the dot, but avoid full re-render on every keystroke
    }

    // Persistence on Server (Debounced would be better, but simple for now)
    if (practiceId) {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        fetch(`/api/student/practice/save-answer?practiceId=${practiceId}`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionId: qId, selectedText: val || "" })
        }).catch(err => console.error("Auto-save failed", err));
    }
}

function checkAnswer(qId, index) {
    const userVal = userAnswers[qId];
    const q = questions.find(qu => qu.id === qId);
    if (!q) return;

    const isValPresent = q.type === 'FILL_IN_BLANK' ? (userVal && userVal.trim() !== '') : (Array.isArray(userVal) ? userVal.length > 0 : !!userVal);
    if (!isValPresent) {
        showToast("Vui lòng chọn hoặc nhập đáp án trước khi kiểm tra!", "err");
        return;
    }

    confirmedAnswers[qId] = true;
    sessionStorage.setItem(`practice_confirmed_answers_${practiceId}`, JSON.stringify(confirmedAnswers));

    if (settings.displayMode === 'all') {
        renderAllQuestions();
        document.getElementById(`q-block-${index}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        showQuestion(currentIndex);
    }
}

function showFeedback(isCorrect, q) {
    const box = document.getElementById('feedbackBox');
    if (!box) return;

    box.className = 'feedback-box ' + (isCorrect ? 'correct' : 'incorrect');

    const userVal = userAnswers[q.id];
    const isAnswered = q.type === 'FILL_IN_BLANK' ? (userVal && userVal.trim() !== '') : (Array.isArray(userVal) ? userVal.length > 0 : !!userVal);

    // Commented out feedback messages for choice questions as correct/incorrect is already highlighted on answers
    if (q.type === 'FILL_IN_BLANK') {
        if (isCorrect) {
            box.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i> <strong>Chính xác!</strong> Bạn đã chọn đáp án đúng.';
        } else if (isAnswered) {
            box.innerHTML = '<i class="bi bi-x-circle-fill me-2"></i> <strong>Chưa đúng rồi!</strong> Hãy xem lại kiến thức nhé.';
            if (!!practiceResult) {
                const detail = practiceResult.details.find(d => d.questionId === q.id);
                if (detail && detail.correctTexts) {
                    box.innerHTML += `<br><small>Đáp án đúng là: <strong>${detail.correctTexts.join(' hoặc ')}</strong></small>`;
                }
            }
        } else {
            box.innerHTML = '<i class="bi bi-exclamation-circle-fill me-2"></i> <strong>Chưa trả lời!</strong> Bạn nên chọn một đáp án.';
        }
        box.style.display = 'block';
    } else {
        // Hide the feedback box for choice questions
        box.style.display = 'none';
    }

    const dot = document.getElementById(`nav-${currentIndex}`);
    if (dot) dot.classList.add(isCorrect ? 'correct' : 'incorrect');
}

function nextQuestion() {
    if (currentIndex < questions.length - 1) showQuestion(currentIndex + 1);
}

function prevQuestion() {
    if (currentIndex > 0) showQuestion(currentIndex - 1);
}

window.flipFlashcard = function() {
    const fcCard = document.getElementById('fcCard');
    if (fcCard) {
        fcCard.classList.toggle('is-flipped');
        
        // Mark dot as "answered" to show they have viewed the back
        const dot = document.getElementById(`nav-${currentIndex}`);
        if (dot && fcCard.classList.contains('is-flipped')) {
            dot.classList.add('answered');
        }
    }
}

// ── Submission ──
async function submitPractice() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const answersArray = questions.map(q => {
        const val = userAnswers[q.id];
        const dto = { questionId: q.id };
        if (q.type === 'FILL_IN_BLANK') {
            dto.selectedText = val || "";
        } else if (q.type === 'MULTIPLE_CHOICE') {
            dto.selectedAnswerIds = Array.isArray(val) ? val : [];
        } else {
            dto.selectedAnswerId = val || null;
        }
        return dto;
    });

    const btn = document.getElementById('btnFinish');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang nộp...';

    if (!practiceId) {
        // Local Grading (for custom quizzes)
        try {
            let correctCount = 0;
            const details = questions.map(q => {
                const val = userAnswers[q.id];
                let isCorrect = false;
                
                const correctIds = q.answers.filter(a => a.isCorrect).map(a => a.id).sort();
                const correctTexts = q.answers.filter(a => a.isCorrect).map(a => a.text.trim());
                
                let selectedAnswers = [];
                
                if (q.type === 'FILL_IN_BLANK') {
                    if (val && val.trim() !== '') {
                        isCorrect = correctTexts.some(t => t.toLowerCase() === val.trim().toLowerCase());
                    }
                } else if (q.type === 'MULTIPLE_CHOICE') {
                    const selectedIds = Array.isArray(val) ? [...val].sort() : [];
                    selectedAnswers = selectedIds;
                    isCorrect = JSON.stringify(correctIds) === JSON.stringify(selectedIds);
                } else {
                    const selId = val;
                    if (selId) {
                        selectedAnswers = [selId];
                        isCorrect = correctIds.includes(parseInt(selId));
                    }
                }
                
                if (isCorrect) correctCount++;
                
                return {
                    questionId: q.id,
                    questionText: q.text,
                    selectedAnswerIds: q.type === 'FILL_IN_BLANK' ? null : selectedAnswers,
                    selectedText: q.type === 'FILL_IN_BLANK' ? val : null,
                    correctAnswerIds: correctIds,
                    correctTexts: correctTexts,
                    isCorrect: isCorrect,
                    questionType: q.type,
                    questionLevel: q.level,
                    answers: q.answers
                };
            });
            
            const totalQuestions = questions.length;
            const result = {
                practiceId: null,
                categoryName: categoryName,
                totalQuestions: totalQuestions,
                correctAnswers: correctCount,
                score: parseFloat(((correctCount * 10.0) / totalQuestions).toFixed(1)),
                createdAt: new Date().toISOString(),
                details: details
            };
            
            practiceResult = result;
            showResult(result);
            return;
        } catch (e) {
            if (typeof showToast === 'function') showToast(e.message, 'err');
            btn.disabled = false;
            btn.innerHTML = orig;
            return;
        }
    }

    try {
        const res = await fetch('/api/student/practice/submit', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId, practiceId, answers: answersArray })
        });

        if (!res.ok) throw new Error("Không thể nộp bài");

        const result = await res.json();
        practiceResult = result; // Store for review
        showResult(result);
    } catch (e) {
        if (typeof showToast === 'function') showToast(e.message, 'err');
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

function showResult(data, silent = false) {
    // Hide all submit buttons
    document.querySelectorAll('#btnFinish').forEach(b => b.classList.add('d-none'));

    // Update exit button label
    const exitBtn = document.getElementById('btnExit');
    if (exitBtn) {
        exitBtn.innerHTML = '<i class="bi bi-box-arrow-left"></i> <span>Thoát</span>';
    }

    // Hide reset button
    const btnReset = document.getElementById('btnReset');
    if (btnReset) btnReset.style.display = 'none';

    // Hide sidebar and question area
    document.querySelector('.col-lg-3').style.display = 'none';
    document.getElementById('questionArea').style.display = 'none';

    // Expand main content column to full width and show result
    const mainCol = document.querySelector('.col-lg-9');
    mainCol.className = 'col-lg-12'; // Make it full width

    const card = document.getElementById('resultCard');
    card.style.display = 'block';

    const correct = data.correctAnswers;
    const total = data.totalQuestions;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

    document.getElementById('resCorrect').textContent = correct;
    document.getElementById('resTotal').textContent = `/ ${total}`;
    document.getElementById('resPercent').textContent = `${percent}%`;
    document.getElementById('resScore').textContent = data.score !== undefined ? data.score.toFixed(1) : "0.0";

    // Hide loader if any
    const loader = document.getElementById('pageLoading');
    if (loader) loader.style.display = 'none';

    // Animate circle
    const circle = document.getElementById('scoreCircleProgress');
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = circumference;

    // Set offset
    setTimeout(() => {
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }, 100);

    // Clean up session storage
    sessionStorage.removeItem('practice_user_answers');
    sessionStorage.removeItem('practice_answered_correctly');
    sessionStorage.removeItem('practice_confirmed_answers');
    sessionStorage.removeItem('practice_is_shuffled');
    sessionStorage.removeItem('practice_current_index');
    sessionStorage.removeItem('practice_flagged_questions');

    // Update Go Back button label dynamically based on return URL
    const btnGoBack = document.getElementById('btnGoBack');
    if (btnGoBack) {
        const returnUrl = sessionStorage.getItem('studentReturnUrl') || '/student/categories';
        if (returnUrl.includes('/history')) {
            btnGoBack.innerHTML = '<i class="bi bi-clock-history me-1"></i> Quay lại Lịch sử';
        } else if (returnUrl.includes('/categories')) {
            if (returnUrl.includes('type=mine')) {
                btnGoBack.innerHTML = '<i class="bi bi-folder-fill me-1"></i> Về thư mục của tôi';
            } else {
                btnGoBack.innerHTML = '<i class="bi bi-layers-fill me-1"></i> Về ngân hàng đề';
            }
        } else {
            btnGoBack.innerHTML = '<i class="bi bi-arrow-left me-1"></i> Quay lại trang trước';
        }
    }

    if (!silent) {
        showToast("Đã hoàn thành luyện tập!", "ok");
    }
}

function viewReview() {
    // Update URL to review mode without reloading
    if (practiceResult && practiceResult.practiceId) {
        const reviewUrl = `/student/practice/review/${practiceResult.practiceId}`;
        window.history.pushState({ path: reviewUrl }, '', reviewUrl);
    }

    const card = document.getElementById('resultCard');
    card.style.display = 'none';

    const exitBtn = document.getElementById('btnExit');
    if (exitBtn) {
        exitBtn.innerHTML = '<i class="bi bi-x-lg"></i> <span>Đóng review</span>';
    }

    // Show sidebar and expand main content
    document.querySelector('.col-lg-3').style.display = 'block';
    const mainCol = document.querySelector('.col-lg-12');
    if (mainCol) mainCol.className = 'col-lg-9';

    const area = document.getElementById('questionArea');
    area.style.display = 'block';

    // Re-render questions in review mode
    settings.displayMode = 'all';
    settings.showAnswer = true;

    // Use results to update answeredCorrectly and userAnswers
    practiceResult.details.forEach(d => {
        const q = questions.find(qu => qu.id === d.questionId);
        if (q) {
            if (q.type === 'FILL_IN_BLANK') {
                userAnswers[d.questionId] = d.selectedText;
            } else if (q.type === 'MULTIPLE_CHOICE') {
                userAnswers[d.questionId] = d.selectedAnswerIds || [];
            } else {
                userAnswers[d.questionId] = d.selectedAnswerIds && d.selectedAnswerIds.length > 0 ? d.selectedAnswerIds[0] : null;
            }
        }
        answeredCorrectly[d.questionId] = d.isCorrect;
    });

    renderAllQuestions();
    renderNav();

    // Add a "Back to Result" button at the top of questionArea
    const header = `
        <div class="d-flex justify-content-between align-items-center mb-4 p-3 bg-light rounded-4">
            <div>
                <h4 class="fw-bold mb-0 text-primary">Xem lại bài làm</h4>
                <p class="text-muted small mb-0">Đáp án đúng được đánh dấu xanh</p>
            </div>
            <button class="btn btn-dark rounded-pill px-4" onclick="showResult(practiceResult, true)">
                Quay lại bảng điểm
            </button>
        </div>
    `;
    const list = document.getElementById('allQuestionsList');
    list.insertAdjacentHTML('afterbegin', header);
}

// ── Utils ──
function confirmExit() {
    const returnUrl = sessionStorage.getItem('studentReturnUrl') || '/student/categories';
    if (practiceResult) {
        // In review mode, just exit without warning
        sessionStorage.removeItem('practice_result_data');
        sessionStorage.removeItem('practice_review_mode');
        window.location.href = returnUrl;
        return;
    }
    // User requested to keep progress, so we just exit
    window.location.href = returnUrl;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function toggleFlag() {
    const qId = questions[currentIndex].id;
    toggleFlagFor(qId);
}

function toggleFlagFor(qId) {
    if (flaggedQuestions.has(qId)) {
        flaggedQuestions.delete(qId);
    } else {
        flaggedQuestions.add(qId);
    }
    sessionStorage.setItem(`practice_flagged_questions_${practiceId}`, JSON.stringify(Array.from(flaggedQuestions)));
    
    if (settings.displayMode === 'all') renderAllQuestions();
    else showQuestion(currentIndex);
    
    renderNav();
}



function showToast(msg, type = 'ok') {
    if (type === 'err' || type === 'error') toast.error(msg);
    else if (type === 'warn' || type === 'warning') toast.warning(msg);
    else toast.success(msg);
}

// ── Keyboard Navigation ──
document.addEventListener('keydown', function(e) {
    // If typing in input or textarea, don't interfere
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.key === 'ArrowLeft') {
        prevQuestion();
    } else if (e.key === 'ArrowRight') {
        nextQuestion();
    } else if ((e.key === ' ' || e.key === 'Enter') && settings.displayMode === 'flashcard') {
        e.preventDefault(); // Prevent page scroll on Space
        window.flipFlashcard();
    }
});
