const CAT_API = '/api/student/categories/public';
const QUIZ_API = '/api/student/categories/{id}/quizzes/public';

let TREE_DATA = [];
let navStack = [];

// Palette for random category colors
const COLOR_PALETTE = [
    { bg1: '#4f46e5', bg2: '#7c3aed', icon: 'bi-globe' },
    { bg1: '#ea580c', bg2: '#f97316', icon: 'bi-lightbulb' },
    { bg1: '#059669', bg2: '#10b981', icon: 'bi-book' },
    { bg1: '#be123c', bg2: '#e11d48', icon: 'bi-compass' },
    { bg1: '#0284c7', bg2: '#0ea5e9', icon: 'bi-rocket' },
    { bg1: '#65a30d', bg2: '#84cc16', icon: 'bi-award' },
    { bg1: '#7c3aed', bg2: '#a855f7', icon: 'bi-puzzle' },
    { bg1: '#b45309', bg2: '#d97706', icon: 'bi-star' }
];

document.addEventListener('DOMContentLoaded', () => {
    loadRoot();
    document.addEventListener('click', () => {
        document.querySelectorAll('.bc-dropdown').forEach(d => d.classList.remove('show'));
    });
});

async function loadRoot() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch(CAT_API, { headers: { Authorization: 'Bearer ' + token } });
        if (!res.ok) throw new Error('Lỗi tải danh mục');
        TREE_DATA = await res.json();
        window.publicCategories = TREE_DATA;

        if (navStack.length === 0) {
            renderRoot();
        } else {
            // Restore state if needed (not strictly necessary for public explore view, but good practice)
            const currentId = navStack[navStack.length - 1].id;
            loadCategory(currentId);
        }
    } catch (e) {
        document.getElementById('exploreContent').innerHTML = `<div class="empty-state"><i class="bi bi-wifi-off"></i><h3>${e.message}</h3></div>`;
    }
}

function renderRoot() {
    const content = document.getElementById('exploreContent');
    const bc = document.getElementById('breadcrumb');
    const header = document.getElementById('exploreHeader');

    bc.style.display = 'none';
    header.style.display = 'block';

    if (!TREE_DATA || TREE_DATA.length === 0) {
        content.innerHTML = `<div class="empty-state"><i class="bi bi-folder-x"></i><h3>Chưa có danh mục nào</h3><p>Hệ thống hiện chưa có đề thi công khai.</p></div>`;
        return;
    }

    let html = `<h2 class="section-title"><i class="bi bi-grid-fill text-primary"></i> Chủ Đề Nổi Bật</h2>`;
    html += `<div class="cat-grid fade-in">`;
    TREE_DATA.forEach((cat, idx) => {
        const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
        const total = calcTotal(cat);
        html += `<div class="cat-card" style="--bg1:${color.bg1}; --bg2:${color.bg2};" onclick="navigateTo(${cat.id}, '${escJs(cat.name)}')">
    <div class="cat-icon-wrap"><i class="bi ${color.icon}"></i></div>
    <div class="cat-name">${esc(cat.name)}</div>
    <div class="cat-meta">${getCatMetaLabel(total, cat)}</div>
</div>`;
    });
    html += `</div>`;
    content.innerHTML = html;
}

function getPathToNode(nodes, targetId, currentPath = []) {
    for (const n of nodes) {
        const path = [...currentPath, { id: n.id, name: n.name }];
        if (n.id === targetId) return path;
        if (n.children) {
            const found = getPathToNode(n.children, targetId, path);
            if (found) return found;
        }
    }
    return null;
}

function findNode(nodes, id) {
    for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) { const f = findNode(n.children, id); if (f) return f; }
    }
    return null;
}

function calcTotal(node) {
    return node.quizCount || 0;
}

function getCatMetaLabel(total, node) {
    if (total > 0) return `${total} câu hỏi`;
    if (node.children && node.children.length > 0) return `${node.children.length} danh mục con`;
    return 'Trống';
}

// Global scope assignments for functions needed inline in templates or in dynamic scripts
window.navigateToRoot = function() {
    navStack = [];
    renderRoot();
}

window.navigateTo = function(id, name) {
    const path = getPathToNode(TREE_DATA, id);
    if (path) {
        navStack = path;
    } else {
        navStack = [{ id, name }];
    }
    loadCategory(id);
}

window.navigateFromBreadcrumb = function(idx) {
    if (idx < 0) { navigateToRoot(); return; }
    const item = navStack[idx];
    navigateTo(item.id, item.name);
}

function renderBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    let html = `<span class="bc-item" onclick="navigateToRoot()"><i class="bi bi-house-door-fill" style="font-size:1.1rem;"></i> Trang chủ</span>`;
    navStack.forEach((item, i) => {
        const parentId = i > 0 ? navStack[i - 1].id : null;
        const siblings = getChildrenOf(parentId);

        let siblingHtml = '';
        let hasSiblings = siblings && siblings.length > 1;
        if (hasSiblings) {
            siblingHtml = `<div class="bc-dropdown" onclick="event.stopPropagation()">
        ${siblings.map(s => `<div class="bc-dropdown-item ${s.id === item.id ? 'active' : ''}" onclick="navigateTo(${s.id}, '${escJs(s.name)}')">${esc(s.name)}</div>`).join('')}
    </div>`;
        }

        html += `<span class="bc-sep ${hasSiblings ? 'bc-sep-hoverable' : ''}" ${hasSiblings ? 'style="cursor:pointer;" onclick="toggleBcDropdown(event, this)"' : ''}>
    <i class="bi bi-chevron-right"></i>
    ${siblingHtml}
</span>`;

        if (i < navStack.length - 1) {
            html += `<span class="bc-item" onclick="navigateFromBreadcrumb(${i})">${esc(item.name)}</span>`;
        } else {
            html += `<span class="bc-item active">${esc(item.name)}</span>`;
        }
    });
    bc.innerHTML = html;
    bc.style.display = 'flex';
    document.getElementById('exploreHeader').style.display = 'none';
}

function getChildrenOf(parentId) {
    if (!parentId) return TREE_DATA;
    const parent = findNode(TREE_DATA, parentId);
    return parent ? parent.children : [];
}

window.toggleBcDropdown = function(e, el) {
    e.stopPropagation();
    document.querySelectorAll('.bc-dropdown').forEach(d => {
        if (d !== el.querySelector('.bc-dropdown')) d.classList.remove('show');
    });
    const dropdown = el.querySelector('.bc-dropdown');
    if (dropdown) dropdown.classList.toggle('show');
}

async function loadCategory(id) {
    renderBreadcrumb();
    const content = document.getElementById('exploreContent');
    content.innerHTML = `
<div class="cat-grid">${[1, 2].map(() => `<div class="skeleton skeleton-cat"></div>`).join('')}</div>
`;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const node = findNode(TREE_DATA, id);
    const subCats = node ? (node.children || []) : [];

    // Removed quiz fetching logic per user request

    let html = '';

    if (subCats.length > 0) {
        html += `<h2 class="section-title"><i class="bi bi-folder2-open text-primary"></i> Thư mục con</h2>`;
        html += `<div class="cat-grid fade-in">`;
        subCats.forEach((cat, idx) => {
            const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
            const total = calcTotal(cat);
            html += `<div class="cat-card" style="--bg1:${color.bg1}; --bg2:${color.bg2};" onclick="navigateTo(${cat.id}, '${escJs(cat.name)}')">
        <div class="cat-icon-wrap"><i class="bi bi-folder-fill"></i></div>
        <div class="cat-name">${esc(cat.name)}</div>
        <div class="cat-meta">${getCatMetaLabel(total, cat)}</div>
    </div>`;
        });
        html += `</div>`;
    }

    // Removed quiz rendering block per user request

    if (id) {
        // Fetch question count first
        try {
            const res = await fetch(`/api/student/practice/count?categoryId=${id}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
                currentPracticeTotalQuestions = parseInt(await res.text()) || 0;
            }
        } catch (e) { console.error(e); }

        currentPracticeCategoryId = id;

        if (currentPracticeTotalQuestions > 0) {
            html += `
    <div class="row g-4 mt-3 mb-5" id="practiceSetupSection">
        <!-- Left Column: Chế độ Tự Luyện -->
        <div class="col-lg-7">
            <div class="p-4 bg-white rounded-4 border shadow-sm d-flex flex-column" style="border-color:#e2e8f0 !important;">
                <div class="mb-3 d-flex align-items-center justify-content-between">
                    <div>
                        <h4 class="fw-bold mb-1" style="color:#1e1b4b;"><i class="bi bi-joystick text-primary me-2"></i>Chế độ Tự Luyện: <span id="practiceCatName">${esc(navStack.map(i => i.name).join(' > '))}</span></h4>
                        <p class="text-muted mb-0" style="font-size:0.85rem;">Hệ thống sẽ bốc ngẫu nhiên câu hỏi trong danh mục này để bạn luyện tập.</p>
                    </div>
                    <span class="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill fw-bold" style="font-size: 0.85rem;">
                        ${currentPracticeTotalQuestions} câu hỏi
                    </span>
                </div>

                <!-- Tabs for Modes -->
                <ul class="nav nav-tabs border-0 mb-3 practice-tabs" id="practiceTabs" role="tablist" style="gap: 10px;">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active rounded-pill px-4 fw-bold shadow-sm" id="tabSequential" data-bs-toggle="tab" data-bs-target="#panelSequential" type="button" role="tab"
                            onclick="document.getElementById('btnPreviewPractice').style.display='inline-block'; document.getElementById('limitHint').textContent='Lấy câu hỏi theo dải bạn đã chọn phía trên';">
                            <i class="bi bi-list-ol me-1"></i> Luyện theo dải
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link rounded-pill px-4 fw-bold shadow-sm" id="tabRandom" data-bs-toggle="tab" data-bs-target="#panelRandom" type="button" role="tab"
                            onclick="document.getElementById('btnPreviewPractice').style.display='none'; document.getElementById('limitHint').textContent='Hệ thống sẽ bốc ngẫu nhiên số câu bạn nhập từ toàn bộ danh mục';">
                            <i class="bi bi-dice-5 me-1"></i> Luyện tập ngẫu nhiên
                        </button>
                    </li>
                </ul>

                <div class="tab-content" id="practiceTabsContent">
                    <!-- Panel: Sequential (Range-based) -->
                    <div class="tab-pane fade show active" id="panelSequential" role="tabpanel" aria-labelledby="tabSequential">
                        <!-- Row: Chọn dải câu hỏi (Range) -->
                        <div class="practice-setting-row flex-column align-items-start gap-2 py-3">
                            <div class="d-flex align-items-center justify-content-between w-100">
                                <div class="practice-setting-label m-0">Chọn dải câu hỏi</div>
                                <div class="btn-group btn-group-sm" role="group">
                                    <input type="radio" class="btn-check" name="rangeMode" id="rangeModeQuick" value="quick" checked onchange="switchRangeMode('quick')">
                                    <label class="btn btn-outline-primary" for="rangeModeQuick" style="font-size:0.75rem; font-weight:600;">Chọn nhanh</label>

                                    <input type="radio" class="btn-check" name="rangeMode" id="rangeModeCustom" value="custom" onchange="switchRangeMode('custom')">
                                    <label class="btn btn-outline-primary" for="rangeModeCustom" style="font-size:0.75rem; font-weight:600;">Tùy chọn</label>
                                </div>
                            </div>

                            <!-- Quick Range Section -->
                            <div id="quickRangeArea" class="w-100">
                                <div class="d-flex align-items-center gap-2 mb-2 mt-1">
                                    <span class="text-muted small fw-bold" style="font-size:0.8rem;">Số câu mỗi dải:</span>
                                    <select id="selectChunkSize" class="form-select form-select-sm" style="width: 120px; border-radius: 8px; font-weight: 600;" onchange="onChunkSizeChange()">
                                        <option value="25">25 câu</option>
                                        <option value="50" selected>50 câu</option>
                                        <option value="75">75 câu</option>
                                        <option value="100">100 câu</option>
                                    </select>
                                </div>
                                <div class="range-group" id="rangeGroup"></div>
                            </div>

                            <!-- Custom Range Section -->
                            <div id="customRangeArea" class="w-100 d-none">
                                <div class="row g-2 align-items-center mt-1">
                                    <div class="col-6">
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-white text-muted">Từ câu</span>
                                            <input type="number" id="customStartQuestion" class="form-control" value="1" min="1" onchange="validateCustomRange()">
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-white text-muted">Đến câu</span>
                                            <input type="number" id="customEndQuestion" class="form-control" value="10" min="1" onchange="validateCustomRange()">
                                        </div>
                                    </div>
                                </div>
                                <div class="text-muted mt-2 ps-1" id="customRangeHint" style="font-size: 0.8rem; font-style: italic;">
                                    Danh mục có tổng cộng <span id="customRangeTotal">0</span> câu hỏi.
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Panel: Random Challenge -->
                    <div class="tab-pane fade" id="panelRandom" role="tabpanel" aria-labelledby="tabRandom">
                        <!-- Row: Chọn số lượng câu hỏi -->
                        <div class="practice-setting-row py-3">
                            <div class="practice-setting-label">
                                Số lượng câu hỏi muốn luyện tập
                                <small id="limitHint">Hệ thống sẽ bốc ngẫu nhiên số câu bạn nhập từ toàn bộ danh mục</small>
                            </div>
                            <input type="number" id="practiceLimit" class="prac-number" value="10" min="1" max="100000" onchange="validateRandomLimit()">
                        </div>
                    </div>
                </div>

                <!-- Row: Kiểu hiển thị -->
                <div class="practice-setting-row py-3">
                    <div class="practice-setting-label">Kiểu hiển thị</div>
                    <select id="selectDisplayMode" class="prac-select">
                        <option value="sequential">Trả lời tuần tự từng câu</option>
                        <option value="all">Hiển thị tất cả câu hỏi</option>
                        <option value="flashcard">Thẻ ghi nhớ (Flashcard)</option>
                    </select>
                </div>

                <!-- Row: Hiển thị đáp án sau câu hỏi -->
                <div class="practice-setting-row py-3">
                    <div class="practice-setting-label">Hiển thị đáp án sau câu hỏi</div>
                    <label class="prac-toggle">
                        <input type="checkbox" id="toggleShowAnswer" checked>
                        <span class="prac-slider"></span>
                    </label>
                </div>

                <!-- Row: Xáo trộn câu hỏi -->
                <div class="practice-setting-row py-3">
                    <div class="practice-setting-label">Xáo trộn câu hỏi</div>
                    <label class="prac-toggle">
                        <input type="checkbox" id="toggleShuffle">
                        <span class="prac-slider"></span>
                    </label>
                </div>

                <!-- Row: Xáo trộn đáp án -->
                <div class="practice-setting-row py-3" style="border-bottom: none;">
                    <div class="practice-setting-label">Xáo trộn đáp án</div>
                    <label class="prac-toggle">
                        <input type="checkbox" id="toggleAnswerShuffle">
                        <span class="prac-slider"></span>
                    </label>
                </div>

                <!-- Action Buttons -->
                <div class="d-flex justify-content-end gap-3 mt-3">
                    <button type="button" class="btn btn-outline-primary fw-bold px-4 py-2 rounded-pill shadow-sm" id="btnPreviewPractice" onclick="previewQuestions()" style="border-color:#4f46e5; color:#4f46e5;">
                        <i class="bi bi-eye me-1"></i> Xem trước
                    </button>
                    <button type="button" class="btn btn-primary fw-bold px-4 py-2 rounded-pill shadow-sm" id="btnStartPractice" onclick="submitStartPractice()" style="background: linear-gradient(135deg, #4f46e5, #3b82f6); border:none;">
                        <i class="bi bi-play-fill me-1"></i> Bắt đầu ngay
                    </button>
                </div>
            </div>
        </div>

        <!-- Right Column: Lịch sử Luyện tập -->
        <div class="col-lg-5">
            <div class="p-4 bg-white rounded-4 border shadow-sm h-100 d-flex flex-column" style="border-color:#e2e8f0 !important;">
                <h4 class="fw-bold mb-1" style="color:#1e1b4b;"><i class="bi bi-clock-history text-success me-2"></i>Lịch sử Luyện tập</h4>
                <p class="text-muted mb-4" style="font-size:0.85rem;">Các lượt tự luyện của bạn gần đây nhất trong danh mục này.</p>
                <div id="practiceHistoryArea" style="max-height: 650px; overflow-y: auto;">
                    <div class="text-center text-muted p-3">Đang tải lịch sử...</div>
                </div>
            </div>
        </div>
    </div>
    `;
        }
    }

    if (subCats.length === 0 && (!id || currentPracticeTotalQuestions === 0)) {
        html += `<div class="empty-state">
    <i class="bi bi-box-seam"></i>
    <h3>Thư mục trống</h3>
    <p>Hiện chưa có nội dung nào trong danh mục này.</p>
</div>`;
    }

    content.innerHTML = html;

    // Reset toggles & selects to default on layout rendering
    if (id && currentPracticeTotalQuestions > 0) {
        document.getElementById('toggleShowAnswer').checked = true;
        document.getElementById('toggleShuffle').checked = false;
        document.getElementById('toggleAnswerShuffle').checked = false;
        document.getElementById('selectDisplayMode').value = 'sequential';

        // Reset range mode and chunk size to default
        currentRangeMode = 'quick';
        document.getElementById('rangeModeQuick').checked = true;
        document.getElementById('selectChunkSize').value = "50";
        document.getElementById('quickRangeArea').classList.remove('d-none');
        document.getElementById('customRangeArea').classList.add('d-none');

        // Build range buttons and load history
        buildRangeButtons(currentPracticeTotalQuestions);
        loadPracticeHistory(id);
    }
}

// ==========================================
// PRACTICE LOGIC
// ==========================================
async function loadPracticeHistory(categoryId) {
    const area = document.getElementById('practiceHistoryArea');
    if (!area) return;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch(`/api/student/practice/history?categoryId=${categoryId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
            const history = await res.json();
            if (!history || history.length === 0) {
                area.innerHTML = `
        <div class="text-center text-muted p-4">
            <i class="bi bi-journal-x fs-2 text-secondary opacity-50 mb-2"></i>
            <p class="mb-0" style="font-size:0.88rem;">Bạn chưa có lượt luyện tập nào.</p>
        </div>`;
                return;
            }

            let html = '<div class="d-flex flex-column gap-3">';
            history.forEach(item => {
                const isCompleted = item.isCompleted;
                const isRandom = item.isRandom;
                const percent = item.totalQuestions > 0 ? Math.round((item.correctAnswers / item.totalQuestions) * 100) : 0;
                const date = new Date(item.createdAt).toLocaleString('vi-VN', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });

                let rangeText = '';
                if (!isRandom) {
                    const startQ = (item.practiceOffset || 0) + 1;
                    const endQ = (item.practiceOffset || 0) + (item.totalQuestions || 0);
                    rangeText = `<span class="badge bg-info bg-opacity-10 text-info rounded-pill" style="font-size:0.68rem;"><i class="bi bi-list-ol me-1"></i>Câu ${startQ} - ${endQ}</span>`;
                }

                if (isCompleted) {
                    // Completed practice: show score and "Xem lại"
                    html += `
        <div class="bg-light p-3 rounded-4 border d-flex flex-column gap-2" style="border-color: #e2e8f0 !important;">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2">
                    <span class="text-muted fw-semibold" style="font-size:0.8rem;"><i class="bi bi-calendar3 me-1"></i>${date}</span>
                    ${isRandom ? '<span class="badge bg-primary bg-opacity-10 text-primary rounded-pill" style="font-size:0.68rem;"><i class="bi bi-dice-5 me-1"></i>Ngẫu nhiên</span>' : rangeText}
                </div>
                <a href="/student/practice/review/${item.id}" class="btn btn-sm btn-dark py-1 px-3 rounded-pill fw-bold shadow-sm" style="font-size:0.7rem; text-decoration:none;">
                    <i class="bi bi-eye-fill me-1"></i> Xem lại
                </a>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-1">
                <span class="badge ${percent >= 50 ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'} rounded-pill" style="font-size:0.75rem; padding: 5px 12px;">
                    Đúng ${item.correctAnswers}/${item.totalQuestions} (${percent}%)
                </span>
                <div class="flex-grow-1 ms-3" style="height: 6px; border-radius: 10px; overflow: hidden; background-color:#e2e8f0;">
                    <div class="progress-bar ${percent >= 50 ? 'bg-success' : 'bg-danger'}" role="progressbar" style="width: ${percent}%; height:100%;"></div>
                </div>
            </div>
        </div>`;
                } else {
                    // In-progress practice: same card structure as completed, yellow Làm tiếp button
                    html += `
        <div class="bg-light p-3 rounded-4 border d-flex flex-column gap-2" style="border-color: #e2e8f0 !important;">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2">
                    <span class="text-muted fw-semibold" style="font-size:0.8rem;"><i class="bi bi-calendar3 me-1"></i>${date}</span>
                    ${isRandom ? '<span class="badge bg-primary bg-opacity-10 text-primary rounded-pill" style="font-size:0.68rem;"><i class="bi bi-dice-5 me-1"></i>Ngẫu nhiên</span>' : rangeText}
                </div>
                <button class="btn btn-sm btn-warning fw-bold rounded-pill px-3 shadow-sm" style="font-size:0.7rem;" onclick="resumePractice(${item.id}, ${!!item.isRandom}, ${item.practiceLimit || 10}, ${item.practiceOffset || 0})">
                    <i class="bi bi-play-fill me-1"></i> Làm tiếp
                </button>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-1">
                <span class="badge bg-secondary bg-opacity-10 text-secondary rounded-pill" style="font-size:0.75rem; padding: 5px 12px;">
                    Đã làm ${item.answeredQuestions || 0}/${item.totalQuestions} câu
                </span>
                <div class="flex-grow-1 ms-3" style="height: 6px; border-radius: 10px; overflow: hidden; background-color:#e2e8f0;">
                    <div class="progress-bar bg-warning" role="progressbar" style="width: ${item.totalQuestions > 0 ? (item.answeredQuestions / item.totalQuestions) * 100 : 0}%; height:100%;"></div>
                </div>
            </div>
        </div>`;
                }
            });
            html += '</div>';
            area.innerHTML = html;
        } else {
            area.innerHTML = `<div class="text-center text-danger p-3">Không thể tải lịch sử luyện tập.</div>`;
        }
    } catch (e) {
        area.innerHTML = `<div class="text-center text-danger p-3">Lỗi khi tải lịch sử luyện tập.</div>`;
    }
}

window.resumePractice = async function(practiceId, isRandom, practiceLimit, practiceOffset) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        let data = null;
        sessionStorage.removeItem('practice_user_answers');
        sessionStorage.removeItem('practice_answered_correctly');
        sessionStorage.removeItem('practice_confirmed_answers');
        sessionStorage.removeItem('practice_current_index');
        sessionStorage.removeItem('practice_is_shuffled');
        sessionStorage.removeItem('practice_questions');

        if (isRandom) {
            // RANDOM: Questions are pre-saved in PracticeDetail, load them via history/detail
            const res = await fetch(`/api/student/practice/history/detail?id=${practiceId}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) throw new Error('Không thể tải bài luyện tập');
            data = await res.json();

            const questions = data.details.map(d => ({
                id: d.questionId,
                text: d.questionText,
                type: d.questionType,
                level: d.questionLevel,
                answers: d.answers,
                selectedAnswerIds: d.selectedAnswerIds || null,
                selectedText: d.selectedText || null,
                isCorrect: d.isCorrect !== undefined ? d.isCorrect : null
            }));

            sessionStorage.setItem('practice_questions', JSON.stringify(questions));
            sessionStorage.setItem('practice_id', practiceId);
            sessionStorage.removeItem(`practice_is_shuffled_${practiceId}`);
        } else {
            // RANGE: Re-call startPractice with same limit/offset - backend finds existing incomplete practice
            const limit = practiceLimit || 10;
            const offset = practiceOffset || 0;
            const payload = { categoryId: currentPracticeCategoryId, limit, offset, isRandom: false, forceNew: false, practiceId: practiceId };
            const res = await fetch('/api/student/practice/start', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Không thể tải bài luyện tập');
            data = await res.json();

            sessionStorage.setItem('practice_questions', JSON.stringify(data.questions));
            sessionStorage.setItem('practice_id', data.practiceId);
            sessionStorage.removeItem(`practice_is_shuffled_${data.practiceId}`);
        }

        sessionStorage.setItem('practice_category_id', currentPracticeCategoryId);
        sessionStorage.setItem('practice_category_name', document.getElementById('practiceCatName').textContent);
        
        const finalId = data ? data.practiceId : practiceId;
        let currentSettings = JSON.parse(sessionStorage.getItem(`practice_settings_${finalId}`) || 'null');
        if (!currentSettings) {
            currentSettings = JSON.parse(sessionStorage.getItem('practice_settings') || 'null');
        }
        if (!currentSettings) {
            currentSettings = { showAnswer: true, shuffle: false, displayMode: 'sequential' };
        }
        sessionStorage.setItem('practice_settings', JSON.stringify(currentSettings));
        sessionStorage.setItem(`practice_settings_${finalId}`, JSON.stringify(currentSettings));
        
        showToast('Tiếp tục bài luyện tập, hãy cố lên! 💪', 'ok');
        setTimeout(() => { window.location.href = '/student/practice/play'; }, 800);
    } catch (e) {
        showToast(e.message, 'err');
    }
}

let currentPracticeCategoryId = null;
let currentPracticeTotalQuestions = 10;

let currentRangeMode = 'quick';

window.switchRangeMode = function(mode) {
    currentRangeMode = mode;
    if (mode === 'quick') {
        document.getElementById('quickRangeArea').classList.remove('d-none');
        document.getElementById('customRangeArea').classList.add('d-none');
    } else {
        document.getElementById('quickRangeArea').classList.add('d-none');
        document.getElementById('customRangeArea').classList.remove('d-none');

        // Populate current start/end in custom mode based on currentPracticeTotalQuestions
        const chunkSize = parseInt(document.getElementById('selectChunkSize').value) || 50;
        document.getElementById('customStartQuestion').value = 1;
        document.getElementById('customEndQuestion').value = Math.min(currentPracticeTotalQuestions, chunkSize);
        document.getElementById('customRangeTotal').textContent = currentPracticeTotalQuestions;
        validateCustomRange();
    }
}

window.validateRandomLimit = function() {
    const input = document.getElementById('practiceLimit');
    let val = parseInt(input.value) || 0;
    // Immediate warnings removed per user request
}

window.validateCustomRange = function() {
    let start = parseInt(document.getElementById('customStartQuestion').value) || 1;
    let end = parseInt(document.getElementById('customEndQuestion').value) || start;

    // Immediate warnings removed per user request
    const count = (end >= start && end <= currentPracticeTotalQuestions && start >= 1) ? (end - start + 1) : 0;
    document.getElementById('practiceLimit').value = count;
}

window.onChunkSizeChange = function() {
    buildRangeButtons(currentPracticeTotalQuestions);
}

window.openPracticeModal = async function(categoryId, categoryName) {
    currentPracticeCategoryId = categoryId;
    document.getElementById('practiceCatName').textContent = categoryName;
    // Reset toggles & selects to default
    document.getElementById('toggleShowAnswer').checked = true;
    document.getElementById('toggleShuffle').checked = false;
    document.getElementById('toggleAnswerShuffle').checked = false;
    document.getElementById('selectDisplayMode').value = 'sequential';

    // Reset range mode and chunk size to default
    currentRangeMode = 'quick';
    document.getElementById('rangeModeQuick').checked = true;
    document.getElementById('selectChunkSize').value = "50";
    document.getElementById('quickRangeArea').classList.remove('d-none');
    document.getElementById('customRangeArea').classList.add('d-none');

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch(`/api/student/practice/count?categoryId=${categoryId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
            currentPracticeTotalQuestions = parseInt(await res.text()) || 0;
        }
    } catch (e) {
        console.error(e);
    }

    // Build range buttons dynamically based on actual total questions
    buildRangeButtons(currentPracticeTotalQuestions);

    // Update limits and hints
    const limitInput = document.getElementById('practiceLimit');
    if (limitInput) {
        limitInput.max = currentPracticeTotalQuestions;
    }

    const customTotalSpan = document.getElementById('customRangeTotal');
    if (customTotalSpan) {
        customTotalSpan.textContent = currentPracticeTotalQuestions;
    }

    const modal = new bootstrap.Modal(document.getElementById('practiceModal'));
    modal.show();
}

function buildRangeButtons(total) {
    const container = document.getElementById('rangeGroup');
    if (!container) return;
    container.innerHTML = '';

    const chunkSize = parseInt(document.getElementById('selectChunkSize').value) || 50;
    const count = Math.ceil(total / chunkSize);

    if (total === 0) {
        container.innerHTML = `<span class="text-muted" style="font-size:0.85rem; font-style:italic;">Chưa có câu hỏi nào trong danh mục này.</span>`;
        return;
    }

    for (let i = 0; i < count; i++) {
        const start = i * chunkSize + 1;
        const end = Math.min((i + 1) * chunkSize, total);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'range-btn' + (i === 0 ? ' active' : '');
        btn.textContent = `Câu ${start} - ${end}`;
        btn.dataset.start = start;
        btn.dataset.end = end;
        btn.dataset.offset = (start - 1);
        btn.onclick = function () {
            document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // Set limit input automatically
            document.getElementById('practiceLimit').value = end - start + 1;
        };
        container.appendChild(btn);
    }

    if (count > 0) {
        const firstEnd = Math.min(chunkSize, total);
        document.getElementById('practiceLimit').value = firstEnd;
    }
}

window.setRandomLimit = function(limit) {
    document.getElementById('practiceLimit').value = limit;
}

// Add event listeners for tabs to update UI hints
document.addEventListener('DOMContentLoaded', () => {
    const tabSequential = document.getElementById('tabSequential');
    const tabRandom = document.getElementById('tabRandom');
    if (tabSequential && tabRandom) {
        tabSequential.addEventListener('shown.bs.tab', () => {
            document.getElementById('btnPreviewPractice').style.display = 'inline-block';
        });
        tabRandom.addEventListener('shown.bs.tab', () => {
            document.getElementById('btnPreviewPractice').style.display = 'none';
        });
    }
});

window.submitStartPractice = async function() {
    // Reset old practice session data
    sessionStorage.removeItem('practice_user_answers');
    sessionStorage.removeItem('practice_answered_correctly');
    sessionStorage.removeItem('practice_confirmed_answers');
    sessionStorage.removeItem('practice_current_index');
    sessionStorage.removeItem('practice_is_shuffled');
    sessionStorage.removeItem('practice_questions');

    const showAnswer = document.getElementById('toggleShowAnswer').checked;
    const shuffle = document.getElementById('toggleShuffle').checked;
    const shuffleAnswers = document.getElementById('toggleAnswerShuffle').checked;
    const displayMode = document.getElementById('selectDisplayMode').value;

    // Detect if Random Mode is active
    const isRandom = document.getElementById('tabRandom').classList.contains('active');

    let limit;
    let offset = 0;

    if (!isRandom) {
        let startQ = 1;
        let endQ = currentPracticeTotalQuestions;
        if (currentRangeMode === 'quick') {
            const activeRange = document.querySelector('.range-btn.active');
            if (activeRange) {
                startQ = parseInt(activeRange.dataset.start) || 1;
                endQ = parseInt(activeRange.dataset.end) || startQ;
            }
        } else {
            startQ = parseInt(document.getElementById('customStartQuestion').value) || 1;
            endQ = parseInt(document.getElementById('customEndQuestion').value) || startQ;

            if (startQ < 1 || endQ > currentPracticeTotalQuestions || startQ > endQ) {
                showToast(`Dải câu hỏi không hợp lệ (Dải hiện có: 1 - ${currentPracticeTotalQuestions})`, 'err');
                return;
            }
        }

        limit = endQ - startQ + 1; // calculate limit implicitly
        offset = startQ - 1;
    } else {
        limit = parseInt(document.getElementById('practiceLimit').value);
        if (isNaN(limit) || limit < 1 || limit > currentPracticeTotalQuestions) {
            showToast(`Số lượng câu hỏi không hợp lệ (Tối đa: ${currentPracticeTotalQuestions})`, 'err');
            return;
        }
    }

    const btn = document.getElementById('btnStartPractice');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang tạo...';

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const payload = { categoryId: currentPracticeCategoryId, limit, offset, isRandom, forceNew: true };
        const res = await fetch('/api/student/practice/start', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Không thể tạo bài luyện tập');
        }
        const data = await res.json();
        // Save everything to sessionStorage for the play page
        sessionStorage.setItem('practice_questions', JSON.stringify(data.questions));
        sessionStorage.setItem('practice_id', data.practiceId);
        sessionStorage.removeItem(`practice_is_shuffled_${data.practiceId}`);
        sessionStorage.setItem('practice_offset', offset);
        sessionStorage.setItem('practice_category_id', currentPracticeCategoryId);
        sessionStorage.setItem('practice_category_name', document.getElementById('practiceCatName').textContent);
        sessionStorage.setItem(`practice_settings_${data.practiceId}`, JSON.stringify({ showAnswer, shuffle, shuffleAnswers, displayMode, isRandom }));
        // Also set a generic one for compatibility if needed, but per-ID is priority
        sessionStorage.setItem('practice_settings', JSON.stringify({ showAnswer, shuffle, shuffleAnswers, displayMode, isRandom }));
        
        // Hide modal if exists
        const modalEl = document.getElementById('practiceModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }
        showToast('Chuẩn bị bài luyện tập thành công!', 'ok');
        setTimeout(() => { window.location.href = '/student/practice/play'; }, 800);
    } catch (e) {
        showToast(e.message, 'err');
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
}

let currentPreviewQuestions = [];

window.togglePreviewAnswers = function() {
    const show = document.getElementById('previewShowAnswers').checked;
    renderPreviewQuestions(show);
}

function renderPreviewQuestions(showAnswers) {
    let html = '';
    currentPreviewQuestions.forEach((q, idx) => {
        html += `<div class="p-3 mb-3 border rounded-3 bg-light">
    <div class="fw-bold mb-2">Câu ${idx + 1}: ${esc(q.text)}</div>
    <div class="ms-3">`;
        q.answers.forEach(a => {
            const isCorrect = a.isCorrect === true && showAnswers;
            html += `<div class="mb-1 ${isCorrect ? 'text-success fw-bold' : ''}">
        <i class="bi ${isCorrect ? 'bi-check-circle-fill' : 'bi-circle'} me-1"></i>
        ${esc(a.text)}
    </div>`;
        });
        html += `</div></div>`;
    });
    document.getElementById('previewQuestionsBody').innerHTML = html;
}

window.previewQuestions = async function() {
    const limit = parseInt(document.getElementById('practiceLimit').value);
    if (isNaN(limit) || limit < 1 || limit > 100000) {
        showToast('Vui lòng nhập số câu từ 1 đến 100000', 'err');
        return;
    }
    let startQ = 1;
    let endQ = currentPracticeTotalQuestions;
    if (currentRangeMode === 'quick') {
        const activeRange = document.querySelector('.range-btn.active');
        if (activeRange) {
            startQ = parseInt(activeRange.dataset.start) || 1;
            endQ = parseInt(activeRange.dataset.end) || startQ;
        }
    } else {
        startQ = parseInt(document.getElementById('customStartQuestion').value) || 1;
        endQ = parseInt(document.getElementById('customEndQuestion').value) || startQ;
    }

    const maxLimit = endQ - startQ + 1;
    if (limit > maxLimit) {
        showToast(`Bạn chỉ được chọn tối đa ${maxLimit} câu hỏi trong dải đã chọn!`, 'err');
        return;
    }

    const offset = startQ - 1;

    const btn = document.getElementById('btnPreviewPractice');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang tải...';

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const payload = { categoryId: currentPracticeCategoryId, limit, offset };
        const res = await fetch('/api/student/practice/preview', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Không thể xem trước câu hỏi');
        }
        currentPreviewQuestions = await res.json();

        // Reset checkbox to unchecked initially
        document.getElementById('previewShowAnswers').checked = false;

        renderPreviewQuestions(false);

        // Show preview modal
        const previewModal = new bootstrap.Modal(document.getElementById('previewQuestionsModal'));
        previewModal.show();
    } catch (e) {
        showToast(e.message, 'err');
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
}

window.startAttempt = async function(quizId, title, btn) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang nạp...';
    try {
        const res = await fetch('/api/student/attempts/start', {
            method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ quizId })
        });
        if (!res.ok) throw new Error('Không thể bắt đầu làm bài. Hãy thử lại.');
        const data = await res.json();
        showToast(`🎯 Bắt đầu: "${title}"`, 'ok');
        if (data.attemptId) setTimeout(() => window.location.href = `/student/attempts/${data.attemptId}`, 800);
        else { btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Đã tạo!'; btn.style.background = '#10b981'; }
    } catch (e) { showToast(e.message, 'err'); btn.disabled = false; btn.innerHTML = orig; }
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function escJs(s) { return s ? s.replace(/'/g, "\\'").replace(/"/g, '\\"') : ''; }



function showToast(msg, type = 'ok') {
    if (type === 'err' || type === 'error') toast.error(msg);
    else if (type === 'warn' || type === 'warning') toast.warning(msg);
    else toast.success(msg);
}
