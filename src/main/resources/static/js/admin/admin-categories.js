/* ══════════════════════════════════════════════
   STATE
 ══════════════════════════════════════════════ */
let MODE      = 'admin';
let TREE_DATA = [];
let navStack  = [];       // [{id, name}]
let OWN_MODE  = true;     // always true for admin
let expandedNodes = new Set();
let searchTerm = '';

// Hàm tìm đường dẫn chuẩn từ Gốc -> Thư mục hiện tại (giúp Breadcrumb chuẩn như File Explorer)
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

/* ══════════════════════════════════════════════
   INIT
 ══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    initResize();

    initMode();

    const searchInput = document.getElementById('treeSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            searchTerm = e.target.value.trim().toLowerCase();
            renderTree(TREE_DATA);
            restoreTreeState();
        });
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.bc-dropdown').forEach(d => d.classList.remove('show'));
    });
});

/* ══════════════════════════════════════════════
   MODE INIT
 ══════════════════════════════════════════════ */
function initMode() {
    MODE = 'admin'; OWN_MODE = true;

    document.getElementById('treeLabel').textContent = 'Danh mục công khai';
    document.getElementById('rootHint').textContent  = 'Chọn thư mục bên trái hoặc tạo danh mục mới để bắt đầu.';

    // Show/hide create buttons per mode
    const tf = document.getElementById('toolbarActions');
    tf.style.display = 'flex';
    document.getElementById('btnNewFolder').style.display = 'flex';
    const treeGlobal = document.getElementById('treeGlobalActions');
    if(treeGlobal) treeGlobal.style.display = 'flex';

    navStack = [];
    TREE_DATA = [];
    searchTerm = '';
    const searchInput = document.getElementById('treeSearchInput');
    if (searchInput) searchInput.value = '';

    navigateToRoot();
    loadTree();
}

/* ══════════════════════════════════════════════
   TREE
 ══════════════════════════════════════════════ */
async function loadTree() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const api   = '/api/admin/categories';
    try {
        const res = await fetch(api, { headers: { Authorization: 'Bearer ' + token } });
        if (!res.ok) throw new Error('Lỗi tải danh mục');
        TREE_DATA = await res.json();

        renderTree(TREE_DATA);
        restoreTreeState();
    } catch (e) {
        document.getElementById('treeScroll').innerHTML =
            `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:.84rem;">
                <i class="bi bi-wifi-off d-block mb-2" style="font-size:1.6rem;"></i>${e.message}
             </div>`;
    }
}

function renderTree(nodes) {
    const wrap = document.getElementById('treeScroll');
    if (!nodes || nodes.length === 0) {
        wrap.innerHTML = `<div style="padding:24px 10px;text-align:center;color:#94a3b8;">
            <i class="bi bi-folder-plus d-block mb-3" style="font-size:2.5rem;color:#c4b5fd;"></i>
            <h6 style="color:#475569;font-weight:700;margin-bottom:8px;">Chưa có danh mục</h6>
            <p style="font-size:0.8rem;margin-bottom:16px;">Tạo thư mục đầu tiên để lưu trữ đề thi.</p>
            ${OWN_MODE ? `<button class="btn-tool btn-new-folder" style="margin:0 auto;" onclick="openCatModal(null)"><i class="bi bi-plus-lg"></i> Thêm mới</button>` : ''}
        </div>`;
        return;
    }
    wrap.innerHTML = `<div style="padding:6px;">${nodes.map(n => treeNodeHtml(n)).join('')}</div>`;
}

function treeNodeHtml(node) {
    const match = searchTerm === '' || node.name.toLowerCase().includes(searchTerm);
    let childrenHtml = '';
    let hasMatchingChild = false;

    if (node.children && node.children.length > 0) {
        const childHtmls = node.children.map(c => treeNodeHtml(c)).filter(h => h !== '');
        if (childHtmls.length > 0) {
            hasMatchingChild = true;
            childrenHtml = childHtmls.join('');
        }
    }

    if (searchTerm !== '' && !match && !hasMatchingChild) {
        return '';
    }

    const isForceOpen = searchTerm !== '' && hasMatchingChild;
    const isNodeOpen = isForceOpen || expandedNodes.has(node.id);

    const hasKids = node.children && node.children.length > 0;
    const arrow = hasKids
        ? `<i class="bi bi-chevron-right tree-arrow ${isNodeOpen ? 'open' : ''}" id="arr-${node.id}"></i>`
        : `<span style="width:12px;display:inline-block;"></span>`;

    const finalKidsHtml = (searchTerm !== '') ? childrenHtml : (node.children ? node.children.map(c => treeNodeHtml(c)).join('') : '');
    const kids = finalKidsHtml !== ''
        ? `<div class="tree-children ${isNodeOpen ? 'open' : ''}" id="kids-${node.id}">${finalKidsHtml}</div>`
        : '';

    // Inline action buttons — chỉ hiện trong chế độ Own
    const actions = OWN_MODE ? `
        <span class="tree-row-actions" onclick="event.stopPropagation()">
            <button class="tree-act-btn" title="Thêm thư mục con"
                onclick="openCatModal(${node.id})">
                <i class="bi bi-folder-plus"></i>
            </button>
            <button class="tree-act-btn" title="Sửa thư mục"
                onclick="openEditCatModal(${node.id},${JSON.stringify(node.name).replace(/"/g,'&quot;')},${JSON.stringify(node.description||'').replace(/"/g,'&quot;')},${node.parentId || null})">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="tree-act-btn" title="Xóa thư mục"
                onclick="openDelCatModal(${node.id})">
                <i class="bi bi-trash"></i>
            </button>
        </span>` : '';

    let displayName = esc(node.name);
    if (searchTerm !== '' && match) {
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        displayName = esc(node.name).replace(regex, '<mark style="background:#fef08a;padding:0 2px;border-radius:3px;color:#1e1b4b;">$1</mark>');
    }

    return `<div class="tree-node">
        <div class="tree-row" id="tr-${node.id}"
            draggable="${OWN_MODE ? 'true' : 'false'}"
            ondragstart="handleDragStart(event, ${node.id})"
            ondragover="handleDragOver(event)"
            ondragleave="handleDragLeave(event)"
            ondrop="handleDrop(event, ${node.id})"
            onclick="treeClick(${node.id},${JSON.stringify(node.name).replace(/"/g,'&quot;')},event)">
            ${arrow}
            <i class="bi bi-folder-fill tree-icon"></i>
            <span class="tree-label">${displayName}</span>
            <span class="tree-count">${calcTotal(node)}</span>
            ${actions}
        </div>
        ${kids}
    </div>`;
}

function calcTotal(node) {
    return node.quizCount || 0;
}

function treeClick(id, name, e) {
    // 1. Xem nội dung thư mục (hiển thị sang bảng bên phải)
    navigateTo(id, name);

    // 2. Tự động đóng/mở thư mục tại chỗ
    const kids = document.getElementById('kids-' + id);
    const arr  = document.getElementById('arr-'  + id);
    if (kids) {
        const isOpen = kids.classList.contains('open');
        if (isOpen) {
            kids.classList.remove('open');
            if (arr) arr.classList.remove('open');
            expandedNodes.delete(id);
        } else {
            kids.classList.add('open');
            if (arr) arr.classList.add('open');
            expandedNodes.add(id);
        }
    }
    e.stopPropagation();
}

function setTreeActive(id) {
    document.querySelectorAll('.tree-row').forEach(r => r.classList.remove('active'));
    const el = document.getElementById('tr-' + id);
    if (el) { el.classList.add('active'); el.scrollIntoView({ block: 'nearest' }); }
}

function restoreTreeState() {
    // Tự động xổ lại những thư mục người dùng đã thao tác mở trước đó
    expandedNodes.forEach(id => {
        const kids = document.getElementById('kids-' + id);
        const arr  = document.getElementById('arr-'  + id);
        if (kids) kids.classList.add('open');
        if (arr) arr.classList.add('open');
    });
    // Active lại node cuối cùng
    if (navStack.length > 0) {
        setTreeActive(navStack[navStack.length - 1].id);
    }
}

/* ══════════════════════════════════════════════
   NAVIGATION
 ══════════════════════════════════════════════ */
function navigateToRoot() {
    navStack = [];
    document.getElementById('breadcrumb').innerHTML =
        `<span class="bc-item active"><i class="bi bi-house-fill"></i> Gốc</span>`;
    document.getElementById('dynamicContent').style.display = 'none';
    document.getElementById('rootLanding').style.display    = 'flex';
    document.querySelectorAll('.tree-row').forEach(r => r.classList.remove('active'));

    // Reset toolbar buttons
    document.getElementById('btnNewFolder').onclick = () => openCatModal(null);
    // Ẩn dropdown tạo câu hỏi khi ở root
    const dd = document.getElementById('dropdownCreateQuestion');
    if (dd) dd.style.display = 'none';
}

function navigateTo(id, name) {
    // Tự động tính toán đường dẫn thực tế (Ví dụ: Gốc > Toán > Giải Tích)
    const path = getPathToNode(TREE_DATA, id);
    if (path) {
        navStack = path;
        // Đảm bảo tất cả các thư mục cha trên đường dẫn này đều được xổ ra
        path.forEach(p => expandedNodes.add(p.id));
    } else {
        navStack = [{ id, name }];
    }

    setTreeActive(id);
    renderBreadcrumb();

    document.getElementById('rootLanding').style.display    = 'none';
    document.getElementById('dynamicContent').style.display = 'block';

    // Cập nhật toolbars tạo mới
    document.getElementById('btnNewFolder').onclick = () => openCatModal(id);
    // Hiện dropdown tạo câu hỏi khi đứng trong folder
    const dd = document.getElementById('dropdownCreateQuestion');
    if (dd) dd.style.display = 'block';

    loadFolderContent(id);
}

function navigateFromBreadcrumb(idx) {
    if (idx < 0) { navigateToRoot(); return; }
    const item = navStack[idx];
    navigateTo(item.id, item.name); // Click trên thanh đường dẫn sẽ điều hướng như bình thường
}

function renderBreadcrumb() {
    let html = `<span class="bc-item" onclick="navigateToRoot()"><i class="bi bi-house-fill"></i></span>`;
    navStack.forEach((item, i) => {
        const parentId = i > 0 ? navStack[i-1].id : null;
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

        if (i < navStack.length - 1)
            html += `<span class="bc-item" onclick="navigateFromBreadcrumb(${i})">${esc(item.name)}</span>`;
        else
            html += `<span class="bc-item active">${esc(item.name)}</span>`;
    });
    document.getElementById('breadcrumb').innerHTML = html;
}

function getChildrenOf(parentId) {
    if (!parentId) return TREE_DATA;
    const parent = findNode(TREE_DATA, parentId);
    return parent ? parent.children : [];
}

function toggleBcDropdown(e, el) {
    e.stopPropagation();
    document.querySelectorAll('.bc-dropdown').forEach(d => {
        if (d !== el.querySelector('.bc-dropdown')) d.classList.remove('show');
    });
    const dropdown = el.querySelector('.bc-dropdown');
    if (dropdown) dropdown.classList.toggle('show');
}

/* ══════════════════════════════════════════════
   FOLDER CONTENT
 ══════════════════════════════════════════════ */
let currentQuestionPage = 0;
let currentQuestionSize = 10;
let activeFolderId = null;

async function loadFolderContent(catId, page = 0) {
    if (activeFolderId !== catId) {
        currentQuestionPage = 0;
        activeFolderId = catId;
        // Reset selection khi chuyển folder
        selectedIds = [];
        isSelectAllResults = false;
    } else {
        currentQuestionPage = page;
        // Reset selection khi chuyển trang
        selectedIds = [];
        isSelectAllResults = false;
    }

    const dc = document.getElementById('dynamicContent');
    dc.style.display = 'block';
    const rootLanding = document.getElementById('rootLanding');
    if (rootLanding) rootLanding.style.display = 'none';

    // Filter values
    const keyword = document.getElementById('q-filter-keyword')?.value || '';
    const type = document.getElementById('q-filter-type')?.value || '';
    const level = document.getElementById('q-filter-level')?.value || '';

    // Render skeleton and filters if not already there
    if (!document.getElementById('q-filters-container')) {
        dc.innerHTML = `
            <div id="q-filters-container" class="dashboard-card mb-4" style="padding: 15px; border-radius: 14px; background: #f8fafc; border: 1px dashed #cbd5e1;">
                <div class="row g-2">
                    <div class="col-md-5">
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                            <input type="text" id="q-filter-keyword" class="form-control border-start-0" placeholder="Tìm câu hỏi..." value="${keyword}" oninput="debounceQFetch()">
                        </div>
                    </div>
                    <div class="col-md-3">
                        <select id="q-filter-type" class="form-select form-select-sm" onchange="loadFolderContent(activeFolderId, 0)">
                            <option value="">-- Loại --</option>
                            <option value="SINGLE_CHOICE" ${type==='SINGLE_CHOICE'?'selected':''}>Một đáp án</option>
                            <option value="MULTIPLE_CHOICE" ${type==='MULTIPLE_CHOICE'?'selected':''}>Nhiều đáp án</option>
                            <option value="FILL_IN_BLANK" ${type==='FILL_IN_BLANK'?'selected':''}>Điền khuyết</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <select id="q-filter-level" class="form-select form-select-sm" onchange="loadFolderContent(activeFolderId, 0)">
                            <option value="">-- Mức độ --</option>
                            <option value="EASY" ${level==='EASY'?'selected':''}>Dễ</option>
                            <option value="MEDIUM" ${level==='MEDIUM'?'selected':''}>Trung bình</option>
                            <option value="HARD" ${level==='HARD'?'selected':''}>Khó</option>
                        </select>
                    </div>
                    <div class="col-md-1">
                        <button class="btn btn-sm btn-outline-secondary w-100" onclick="resetQFilters()" title="Xóa bộ lọc"><i class="bi bi-x-lg"></i></button>
                    </div>
                </div>
            </div>
            <div id="q-content-area">
                <div class="quiz-grid">${[1,2,3].map(()=>`<div class="skeleton" style="height:180px;border-radius:16px;"></div>`).join('')}</div>
            </div>`;
    } else {
        document.getElementById('q-content-area').innerHTML = `<div class="quiz-grid">${[1,2,3].map(()=>`<div class="skeleton" style="height:180px;border-radius:16px;"></div>`).join('')}</div>`;
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const node  = findNode(TREE_DATA, catId);
    const subs  = node ? (node.children || []) : [];

    let quizzes = [];
    let questionsData = null;

    try {
        const res = await fetch(`/api/admin/categories/${catId}/quizzes`,
            { headers: { Authorization: 'Bearer ' + token } });
        if (res.ok) quizzes = await res.json();
    } catch (_) {}

    try {
        let qUrl = `/api/admin/categories/${catId}/questions?page=${currentQuestionPage}&size=${currentQuestionSize}`;
        if (keyword) qUrl += `&keyword=${encodeURIComponent(keyword)}`;
        if (type) qUrl += `&type=${type}`;
        if (level) qUrl += `&level=${level}`;

        const qRes = await fetch(qUrl, { headers: { Authorization: 'Bearer ' + token } });
        if (qRes.ok) questionsData = await qRes.json();
    } catch (_) {}

    renderFolderContent(document.getElementById('q-content-area'), subs, quizzes, questionsData, catId);
}

let qDebounceTimer;
function debounceQFetch() {
    clearTimeout(qDebounceTimer);
    qDebounceTimer = setTimeout(() => {
        loadFolderContent(activeFolderId, 0);
    }, 500);
}

function resetQFilters() {
    document.getElementById('q-filter-keyword').value = '';
    document.getElementById('q-filter-type').value = '';
    document.getElementById('q-filter-level').value = '';
    loadFolderContent(activeFolderId, 0);
}

function renderFolderContent(container, subs, quizzes, questionsData, parentId) {
    let html = '';
    
    // Update lastTotalElements for bulk selection
    lastTotalElements = (questionsData && questionsData.totalElements) ? questionsData.totalElements : 0;

    // Quizzes
    if (quizzes.length > 0) {
        html += `<p class="section-title fw-bold" style="font-size:1.1rem;margin-top:10px;"><i class="bi bi-file-earmark-text me-1"></i> Đề thi / Quiz (${quizzes.length})</p>`;
        html += `<div class="quiz-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom:24px;">`;
        quizzes.forEach(q => { html += quizCardHtml(q); });
        html += `</div>`;
    }

    // Questions (if present)
    if (questionsData && questionsData.totalElements > 0) {
        html += `<p class="section-title fw-bold" style="font-size:1.1rem;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:20px;"><i class="bi bi-patch-check me-1"></i> Danh sách câu hỏi (${questionsData.totalElements})</p>`;
        
        // Bulk Selection Bar
        html += `
        <div id="bulk-selection-bar" class="bulk-actions-bar" style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px 16px; border-radius:12px; border:1px solid #e2e8f0; margin-bottom:16px;">
            <div class="d-flex flex-column">
                <div class="d-flex align-items-center">
                    <div class="form-check me-3">
                        <input class="form-check-input" type="checkbox" id="selectAllQuestions" onchange="toggleSelectAll(this)">
                        <label class="form-check-label fw-bold ms-2" for="selectAllQuestions">Chọn tất cả trang này</label>
                    </div>
                    <span id="selected-count-badge" class="badge bg-primary rounded-pill">0 đã chọn</span>
                </div>
                <div id="select-all-all-area" class="mt-1 small" style="display: none; padding-left: 32px; color: #1e40af;">
                    <a href="javascript:void(0)" onclick="selectAllResults()">Chọn tất cả ${questionsData.totalElements} câu hỏi</a>
                </div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-danger fw-bold px-3 py-2" style="border-radius: 10px;" onclick="confirmBulkDelete()">
                    <i class="bi bi-trash3-fill me-1"></i> Xóa nhanh
                </button>
            </div>
        </div>`;

        html += `<div class="question-list" style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">`;
        questionsData.content.forEach(q => {
            let typeLabel = q.type === 'SINGLE_CHOICE' ? 'Một đáp án' : (q.type === 'MULTIPLE_CHOICE' ? 'Nhiều đáp án' : 'Điền khuyết');
            let levelLabel = q.level === 'EASY' ? 'Dễ' : (q.level === 'MEDIUM' ? 'Trung bình' : 'Khó');

            let answersPreviewHtml = '';
            if (q.answers && q.answers.length > 0) {
                answersPreviewHtml = `
                    <div class="ans-preview" style="display:grid;grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top:12px;">
                        ${q.answers.map((a, idx) => `
                            <div class="ans-item ${a.isCorrect ? 'correct' : ''}" style="background:${a.isCorrect ? '#f0fdf4' : '#f8fafc'}; border:1px solid ${a.isCorrect ? '#bbf7d0' : '#e2e8f0'}; border-radius:12px; padding:10px 14px; font-size:0.9rem; color:${a.isCorrect ? '#15803d' : '#334155'}; font-weight:${a.isCorrect ? '600' : '400'}; display:flex; align-items:center; gap:8px;">
                                <i class="bi bi-${a.isCorrect ? 'check-circle-fill text-success' : 'circle'}"></i>
                                <span>${String.fromCharCode(65 + idx)}. ${esc(a.text)}</span>
                            </div>
                        `).join('')}
                    </div>`;
            }

            html += `
                <div class="question-card" style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 4px 12px rgba(0,0,0,0.03); transition:all 0.2s;">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div class="badge-row" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                            <div class="form-check me-2">
                                <input class="form-check-input q-checkbox" type="checkbox" value="${q.id}" onchange="toggleQuestionSelection()">
                            </div>
                            <span class="q-badge" style="background:#f1f5f9; color:#475569; border-radius:8px; padding:4px 10px; font-size:0.78rem; font-weight:600;"><i class="bi bi-patch-check"></i> ${typeLabel}</span>
                            <span class="q-badge" style="background:#f1f5f9; color:#475569; border-radius:8px; padding:4px 10px; font-size:0.78rem; font-weight:600;"><i class="bi bi-graph-up"></i> ${levelLabel}</span>
                        </div>
                        <div class="text-muted small">Người gửi: <strong>${esc(q.creatorName || 'N/A')}</strong></div>
                    </div>
                    <div class="q-text" style="font-size:1rem; font-weight:600; color:#1e293b; margin:10px 0;">${esc(q.text)}</div>
                    ${answersPreviewHtml}
                    <div class="d-flex justify-content-end gap-2 mt-3 pt-2" style="border-top:1px dashed #e2e8f0;">
                        <button class="btn btn-sm btn-outline-warning fw-semibold" style="border-radius:10px; padding:6px 14px; font-size:0.85rem;" onclick="openEditQuestionModal(${q.id})">
                            <i class="bi bi-pencil-fill"></i> Sửa câu hỏi
                        </button>
                        <button class="btn btn-sm btn-outline-primary fw-semibold" style="border-radius:10px; padding:6px 14px; font-size:0.85rem;" onclick="openMoveQuestionModal(${q.id})">
                            <i class="bi bi-folder-symlink-fill"></i> Chuyển danh mục
                        </button>
                        <button class="btn btn-sm btn-outline-danger fw-semibold" style="border-radius:10px; padding:6px 14px; font-size:0.85rem;" onclick="confirmDeleteQuestion(${q.id})">
                            <i class="bi bi-trash3-fill"></i> Xóa câu hỏi
                        </button>
                    </div>
                </div>`;
        });
        html += `</div>`;

        // Pagination for questions
        html += renderQuestionsPagination(questionsData);
    }

    // Empty
    if (quizzes.length === 0 && subs.length === 0 && (!questionsData || questionsData.totalElements === 0)) {
        html = `<div class="empty-root">
            <div class="empty-root-icon"><i class="bi bi-file-earmark-x"></i></div>
            <h3>Thư mục trống</h3>
            <p>${OWN_MODE ? 'Hãy thêm thư mục con hoặc tạo đề thi mới vào đây.' : 'Thư mục này hiện chưa có đề thi nào.'}</p>
            ${OWN_MODE ? `<div style="display:flex;gap:12px;margin-top:8px;">
                <button class="btn-tool btn-new-folder" onclick="openCatModal(${parentId})"><i class="bi bi-folder-plus"></i> Thêm thư mục con</button>
            </div>` : ''}
        </div>`;
    }

    container.innerHTML = html;
}

function renderQuestionsPagination(data) {
    if (!data || data.totalPages <= 1) return '';

    let pagesHtml = '';
    const maxVisible = 6;
    const startPage = Math.max(0, data.number - Math.floor(maxVisible / 2));
    const endPage = Math.min(data.totalPages - 1, startPage + maxVisible - 1);

    pagesHtml += `<div class="d-flex flex-column align-items-center justify-content-center gap-2 mt-4 pt-3 border-top" style="border-top: 1px solid #e2e8f0 !important;">`;
    pagesHtml += `<div class="text-muted small mb-1">Hiển thị ${data.number * data.size + 1} đến ${Math.min((data.number + 1) * data.size, data.totalElements)} trong tổng số ${data.totalElements} câu hỏi</div>`;
    
    pagesHtml += `<nav><ul class="pagination pagination-sm mb-1 gap-1">`;

    // First page
    if (startPage > 0) {
        pagesHtml += `<li class="page-item"><button class="btn btn-sm btn-outline-secondary px-3" onclick="goToQuestionsPage(0)">1</button></li>`;
        if (startPage > 1) {
            pagesHtml += `<li class="page-item disabled"><span class="btn btn-sm btn-light px-3" style="cursor:default">...</span></li>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        pagesHtml += `<li class="page-item"><button class="btn btn-sm ${i === data.number ? 'btn-primary active' : 'btn-outline-secondary'} px-3" onclick="goToQuestionsPage(${i})">${i + 1}</button></li>`;
    }

    // Last page
    if (endPage < data.totalPages - 1) {
        if (endPage < data.totalPages - 2) {
            pagesHtml += `<li class="page-item disabled"><span class="btn btn-sm btn-light px-3" style="cursor:default">...</span></li>`;
        }
        pagesHtml += `<li class="page-item"><button class="btn btn-sm btn-outline-secondary px-3" onclick="goToQuestionsPage(${data.totalPages - 1})">${data.totalPages}</button></li>`;
    }

    pagesHtml += `</ul></nav>`;

    // Page jump input
    pagesHtml += `
        <div class="d-flex align-items-center gap-2" style="font-size: 0.85rem;">
            <span class="text-muted fw-bold">Đi đến trang:</span>
            <input type="number" id="jumpToPageInput" class="form-control form-control-sm text-center" style="width:55px; height:32px; border-radius:8px;" min="1" max="${data.totalPages}" value="${data.number + 1}">
            <button class="btn btn-sm btn-secondary fw-bold" style="height:32px; border-radius:8px; padding:0 12px" onclick="jumpToQuestionsPage(${data.totalPages})">Đến</button>
        </div>`;

    pagesHtml += `</div>`;
    return pagesHtml;
}

function goToQuestionsPage(page) {
    loadFolderContent(activeFolderId, page);
}

function jumpToQuestionsPage(totalPages) {
    const input = document.getElementById('jumpToPageInput');
    let val = parseInt(input.value);
    if (isNaN(val) || val < 1 || val > totalPages) {
        showToast('Số trang nhập vào không hợp lệ!', 'err');
        return;
    }
    loadFolderContent(activeFolderId, val - 1);
}

function flattenTreeForSelect(nodes, level = 0, output = []) {
    nodes.forEach(n => {
        output.push({ id: n.id, name: ' '.repeat(level * 4).replace(/ /g, '&nbsp;') + n.name });
        if (n.children && n.children.length > 0) {
            flattenTreeForSelect(n.children, level + 1, output);
        }
    });
    return output;
}

function openMoveQuestionModal(questionId) {
    document.getElementById('moveQuestionId').value = questionId;
    document.getElementById('moveQuestionCategoryId').value = '';
    document.getElementById('moveQuestionCategoryName').textContent = '-- Chưa chọn danh mục --';
    document.getElementById('moveQuestionCategoryName').classList.add('text-muted');

    const modal = new bootstrap.Modal(document.getElementById('moveQuestionModal'));
    modal.show();
}

// 🌟 Callback cho Category Explorer
window.handleCategorySelection = function(id, name, target) {
    if (target === 'moveQuestion') {
        document.getElementById('moveQuestionCategoryId').value = id;
        document.getElementById('moveQuestionCategoryName').textContent = name;
        document.getElementById('moveQuestionCategoryName').classList.remove('text-muted');
        document.getElementById('moveQuestionCategoryName').classList.add('text-dark');
    }
}

async function doMoveQuestion() {
    const questionId = document.getElementById('moveQuestionId').value;
    const catId = document.getElementById('moveQuestionCategoryId').value;
    if (!catId) {
        showToast('Vui lòng chọn danh mục đích!', 'err');
        return;
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch(`/api/admin/questions/${questionId}/move?categoryId=${catId}`, {
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + token }
        });
        if (res.ok) {
            const modalEl = document.getElementById('moveQuestionModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            showToast('Thành công', 'Đã chuyển danh mục cho câu hỏi.', 'success');
            loadFolderContent(activeFolderId, currentQuestionPage);
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Có lỗi xảy ra khi chuyển danh mục!', 'err');
        }
    } catch (_) {
        showToast('Có lỗi kết nối!', 'err');
    }
}

let questionToDelete = null;
function confirmDeleteQuestion(questionId) {
    questionToDelete = questionId;
    const modal = new bootstrap.Modal(document.getElementById('deleteQuestionModal'));
    modal.show();
}

async function doDeleteQuestion() {
    if (!questionToDelete) return;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch(`/api/admin/questions/${questionToDelete}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token }
        });
        if (res.ok) {
            const modalEl = document.getElementById('deleteQuestionModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            showToast('Thành công', 'Đã xóa câu hỏi khỏi hệ thống.', 'success');
            loadFolderContent(activeFolderId, currentQuestionPage);
        } else {
            showToast('Có lỗi xảy ra khi xóa câu hỏi!', 'err');
        }
    } catch (_) {
        showToast('Có lỗi kết nối!', 'err');
    }
}

function quizCardHtml(q) {
    const typeBadge   = q.isExam
        ? `<span class="qbadge qbadge-exam"><i class="bi bi-mortarboard-fill"></i> Kiểm tra</span>`
        : `<span class="qbadge qbadge-quiz"><i class="bi bi-journal-check"></i> Luyện tập</span>`;

    const actions = OWN_MODE
        ? `<div class="quiz-actions">
             <a class="qact qact-edit" href="/teacher/quizzes/${q.id}/edit"><i class="bi bi-pencil-square"></i> Sửa</a>
             <a class="qact qact-view" href="/teacher/quizzes/${q.id}/preview"><i class="bi bi-eye"></i> Xem</a>
             <button class="qact qact-del" onclick="deleteQuiz('${q.id}')"><i class="bi bi-trash3"></i></button>
           </div>`
        : `<div class="quiz-actions">
             <a class="qact qact-view" style="flex:1;" href="/teacher/quizzes/${q.id}/preview"><i class="bi bi-eye"></i> Xem thử</a>
           </div>`;

    const imgUrl = q.imageUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80';

    return `<div class="quiz-card">
        <img src="${imgUrl}" alt="Cover" class="quiz-cover-img" onerror="this.src='https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80'">
        <div class="quiz-badge-row">${typeBadge}</div>
        <h3 class="quiz-title">${esc(q.title) || '(Chưa có tiêu đề)'}</h3>
        <p class="quiz-desc">${esc(q.description) || '<span style="color:#cbd5e1;font-style:italic;">Chưa có mô tả.</span>'}</p>
        <div class="quiz-chips">
            <span class="chip"><i class="bi bi-list-check text-success"></i> ${q.questionCount} câu</span>
            ${q.creatorName ? `<span class="chip"><i class="bi bi-person text-primary"></i> ${esc(q.creatorName)}</span>` : ''}
        </div>
        ${actions}
    </div>`;
}

/* ══════════════════════════════════════════════
   CATEGORY CRUD
 ══════════════════════════════════════════════ */
function openCatModal(parentId) {
    document.getElementById('catEditId').value    = '';
    document.getElementById('catParentId').value  = parentId || '';
    document.getElementById('catModalTitle').textContent = parentId ? 'Tạo thư mục con' : 'Tạo danh mục mới';
    document.getElementById('catNameInput').value = '';
    document.getElementById('catDescInput').value = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('catModal')).show();
}

function openEditCatModal(id, name, desc, parentId) {
    document.getElementById('catEditId').value    = id;
    document.getElementById('catParentId').value  = parentId || '';
    document.getElementById('catModalTitle').textContent = 'Sửa danh mục';
    document.getElementById('catNameInput').value = name;
    document.getElementById('catDescInput').value = desc || '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('catModal')).show();
}

async function submitCategory() {
    const token   = localStorage.getItem('token') || sessionStorage.getItem('token');
    const editId  = document.getElementById('catEditId').value;
    const parentId = document.getElementById('catParentId').value;
    const name    = document.getElementById('catNameInput').value.trim();
    const desc    = document.getElementById('catDescInput').value.trim();
    const isPublic = true;

    if (!name) { showToast('Vui lòng nhập tên danh mục!', 'err'); return; }

    const isEdit = !!editId;
    const url    = isEdit ? `/api/admin/categories/${editId}` : '/api/admin/categories';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: desc, parentId: parentId ? parseInt(parentId) : null, isPublic })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Lỗi'); }

        const modalEl = document.getElementById('catModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
        if (modalInstance) modalInstance.hide();
        showToast(isEdit ? 'Đã cập nhật danh mục!' : 'Tạo danh mục thành công!', 'ok');

        // 🌟 Tự động ghi nhớ phải xổ thư mục cha ra
        if (parentId) {
            expandedNodes.add(parseInt(parentId));
        }

        await loadTree();
        restoreTreeState();

        // 🌟 Điều hướng ngay lập tức vào thư mục cha để nội dung bên phải được Refresh,
        // cho phép bạn thấy ngay thư mục con vừa tạo y hệt Windows Explorer.
        if (parentId) {
            const parentNode = findNode(TREE_DATA, parseInt(parentId));
            if (parentNode) navigateTo(parentNode.id, parentNode.name);
        } else if (navStack.length > 0) {
            loadFolderContent(navStack[navStack.length-1].id);
        } else {
             navigateToRoot();
        }
    } catch (e) { showToast(e.message, 'err'); }
}

function openDelCatModal(id) {
    document.getElementById('delCatId').value = id;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('delCatModal')).show();
}

async function confirmDelCat() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const id    = document.getElementById('delCatId').value;
    try {
        const res = await fetch(`/api/admin/categories/${id}`, {
            method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Lỗi'); }
        const modalEl = document.getElementById('delCatModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
        if (modalInstance) modalInstance.hide();
        showToast('Đã xóa danh mục!', 'ok');
        const curId = navStack.length > 0 ? navStack[navStack.length-1].id : null;
        if (String(curId) === String(id)) navigateFromBreadcrumb(navStack.length - 2);
        await loadTree();
        restoreTreeState();
    } catch (e) { showToast(e.message, 'err'); }
}

/* ══════════════════════════════════════════════
   DRAG & DROP
 ══════════════════════════════════════════════ */
let draggedNodeId = null;

function handleDragStart(e, id) {
    if (!OWN_MODE) return;
    draggedNodeId = id;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0);
}

function handleDragOver(e) {
    if (!OWN_MODE) return;
    e.preventDefault(); // Cho phép drop
    e.currentTarget.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'move';
}

function handleDragLeave(e) {
    if (!OWN_MODE) return;
    e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e, targetParentId) {
    if (!OWN_MODE) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const el = document.querySelector('.tree-row.dragging');
    if(el) el.classList.remove('dragging');

    if (!draggedNodeId || draggedNodeId === targetParentId) return;

    // Validate: Không được thả vào chính con/cháu của nó
    const draggedNode = findNode(TREE_DATA, draggedNodeId);
    if (!draggedNode) return;

    if (targetParentId && isDescendant(draggedNode, targetParentId)) {
        showToast('Không thể di chuyển danh mục vào bên trong thư mục con của nó!', 'err');
        return;
    }

    // Gọi API update parentId
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const payload = {
            name: draggedNode.name,
            description: draggedNode.description || '',
            parentId: targetParentId,
            isPublic: true
        };
        const res = await fetch(`/api/admin/categories/${draggedNodeId}`, {
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Lỗi di chuyển danh mục');

        showToast('Đã di chuyển danh mục!', 'ok');
        if (targetParentId) expandedNodes.add(targetParentId);
        await loadTree();
        restoreTreeState();

        // Điều hướng lại
        if (targetParentId) {
            const parentNode = findNode(TREE_DATA, targetParentId);
            if (parentNode) navigateTo(parentNode.id, parentNode.name);
        } else {
            navigateToRoot();
        }
    } catch (err) {
        showToast(err.message, 'err');
    } finally {
        draggedNodeId = null;
    }
}

function isDescendant(parent, childId) {
    if (parent.id === childId) return true;
    if (!parent.children) return false;
    for (const child of parent.children) {
        if (isDescendant(child, childId)) return true;
    }
    return false;
}

/* ══════════════════════════════════════════════
   QUIZ ACTIONS
 ══════════════════════════════════════════════ */
function openQuizCreate(catId) {
    window.location.href = `/teacher/quizzes/create${catId ? '?categoryId='+catId : ''}`;
}

function deleteQuiz(id) {
    document.getElementById('delQuizId').value = id;
    const modal = new bootstrap.Modal(document.getElementById('delQuizModal'));
    modal.show();
}

async function doDeleteQuiz() {
    const id = document.getElementById('delQuizId').value;
    if (!id) return;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch(`/api/teacher/quizzes/${id}`, {
            method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('Lỗi xóa');
        
        const modalEl = document.getElementById('delQuizModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
        showToast('Đã xóa đề thi!', 'ok');
        if (navStack.length > 0) loadFolderContent(navStack[navStack.length-1].id);
    } catch (e) { showToast(e.message, 'err'); }
}

/* ══════════════════════════════════════════════
   EDIT QUESTION PUBLIC
 ══════════════════════════════════════════════ */
async function openEditQuestionModal(id) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch(`/api/admin/questions/${id}`, { headers: { Authorization: 'Bearer ' + token } });
        if (!res.ok) throw new Error('Không thể tải thông tin câu hỏi');
        const q = await res.json();
        
        document.getElementById('editQuestionId').value = q.id;
        document.getElementById('editQuestionCategoryId').value = q.categoryId || '';
        document.getElementById('editQuestionText').value = q.text || '';
        document.getElementById('editQuestionType').value = q.type || 'SINGLE_CHOICE';
        document.getElementById('editQuestionLevel').value = q.level || 'MEDIUM';
        
        renderEditAnswers(q.answers || [], q.type);
        
        const modal = new bootstrap.Modal(document.getElementById('editQuestionModal'));
        modal.show();
    } catch (err) {
        showToast(err.message, 'err');
    }
}

function renderEditAnswers(answers, type) {
    const list = document.getElementById('editAnswerList');
    list.innerHTML = '';
    if (answers.length === 0) {
        if (type !== 'FILL_IN_BLANK') {
            for(let i=0; i<4; i++) list.appendChild(createEditAnswerNode('', i===0));
        } else {
            list.appendChild(createEditAnswerNode('', true));
        }
    } else {
        answers.forEach(a => {
            list.appendChild(createEditAnswerNode(a.text, a.isCorrect));
        });
    }
    onEditTypeChange();
}

function createEditAnswerNode(text, isCorrect) {
    const div = document.createElement('div');
    div.className = 'edit-ans-item d-flex gap-2 align-items-center';
    div.innerHTML = `
        <div class="form-check" style="margin-bottom:0;">
            <input class="form-check-input edit-ans-correct" type="checkbox" ${isCorrect ? 'checked' : ''} style="transform: scale(1.3); margin-top:0.6rem; cursor:pointer;">
        </div>
        <textarea class="form-control edit-ans-text" rows="1" placeholder="Nhập đáp án..." style="border-radius:10px;"></textarea>
        <button class="btn btn-light text-danger" onclick="removeEditAnswer(this)" style="border-radius:10px;"><i class="bi bi-trash"></i></button>
    `;
    div.querySelector('textarea').value = text;
    return div;
}

function addEditAnswer() {
    const list = document.getElementById('editAnswerList');
    list.appendChild(createEditAnswerNode('', false));
    onEditTypeChange();
}

function removeEditAnswer(btn) {
    btn.parentElement.remove();
    onEditTypeChange();
}

function onEditTypeChange() {
    const type = document.getElementById('editQuestionType').value;
    const cbs = document.querySelectorAll('.edit-ans-correct');
    const hint = document.getElementById('editAnswerHint');
    
    if (type === 'SINGLE_CHOICE') {
        cbs.forEach(cb => {
            cb.type = 'radio';
            cb.name = 'edit-ans-radio';
            cb.disabled = false;
        });
        hint.innerHTML = '<i>* Trắc nghiệm 1 đáp án: Chỉ được chọn 1 đáp án đúng.</i>';
        hint.style.display = 'block';
    } else if (type === 'MULTIPLE_CHOICE') {
        cbs.forEach(cb => {
            cb.type = 'checkbox';
            cb.removeAttribute('name');
            cb.disabled = false;
        });
        hint.innerHTML = '<i>* Trắc nghiệm nhiều đáp án: Có thể chọn nhiều đáp án đúng.</i>';
        hint.style.display = 'block';
    } else if (type === 'FILL_IN_BLANK') {
        cbs.forEach(cb => {
            cb.type = 'checkbox';
            cb.removeAttribute('name');
            cb.checked = true;
            cb.disabled = true;
        });
        hint.innerHTML = '<i>* Điền khuyết: Mọi đáp án thêm vào đều được coi là phương án đúng để so khớp.</i>';
        hint.style.display = 'block';
    }
}

async function submitEditQuestion() {
    const id = document.getElementById('editQuestionId').value;
    const categoryId = document.getElementById('editQuestionCategoryId').value;
    const text = document.getElementById('editQuestionText').value.trim();
    const type = document.getElementById('editQuestionType').value;
    const level = document.getElementById('editQuestionLevel').value;
    
    if (!text) {
        showToast('Nội dung câu hỏi không được để trống!', 'err');
        return;
    }
    
    const answerItems = document.querySelectorAll('.edit-ans-item');
    const answers = [];
    let correctCount = 0;
    
    for (let item of answerItems) {
        const aText = item.querySelector('.edit-ans-text').value.trim();
        const aCorrect = item.querySelector('.edit-ans-correct').checked;
        if (!aText) {
            showToast('Nội dung đáp án không được để trống!', 'err');
            return;
        }
        if (aCorrect) correctCount++;
        answers.push({ text: aText, correct: aCorrect });
    }
    
    if (answers.length < 1) {
        showToast('Phải có ít nhất 1 đáp án!', 'err');
        return;
    }
    
    if (type === 'SINGLE_CHOICE' && correctCount !== 1) {
        showToast('Trắc nghiệm 1 đáp án phải có ĐÚNG 1 đáp án đúng!', 'err');
        return;
    }
    if (type === 'MULTIPLE_CHOICE' && correctCount < 2) {
        showToast('Trắc nghiệm nhiều đáp án phải có ÍT NHẤT 2 đáp án đúng!', 'err');
        return;
    }
    if (type === 'FILL_IN_BLANK' && correctCount < 1) {
        showToast('Điền khuyết phải có ít nhất 1 đáp án đúng!', 'err');
        return;
    }
    
    const payload = {
        categoryId: categoryId ? parseInt(categoryId) : null,
        text: text,
        type: type,
        level: level,
        answers: answers
    };
    
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const btn = document.getElementById('btnSaveEditQuestion');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang lưu...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`/api/admin/questions/${id}/edit`, {
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const err = await res.json().catch(()=>({}));
            throw new Error(err.message || 'Lỗi khi lưu câu hỏi');
        }
        
        showToast('Sửa câu hỏi thành công!', 'ok');
        const modalEl = document.getElementById('editQuestionModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
        loadFolderContent(activeFolderId, currentQuestionPage);
    } catch (e) {
        showToast(e.message, 'err');
    } finally {
        btn.innerHTML = oldHtml;
        btn.disabled = false;
    }
}

/* ══════════════════════════════════════════════
   UTILS
 ══════════════════════════════════════════════ */
function findNode(nodes, id) {
    for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) { const f = findNode(n.children, id); if (f) return f; }
    }
    return null;
}
function esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }
function escJs(s) { return s ? s.replace(/'/g, "\\'").replace(/"/g, '\\"') : ''; }

function initResize() {
    const handle = document.getElementById('resizeHandle');
    const panel  = document.getElementById('treePanel');
    let dragging=false, startX, startW;
    handle.addEventListener('mousedown', e => {
        dragging=true; startX=e.clientX; startW=panel.offsetWidth;
        document.body.style.cursor='col-resize'; document.body.style.userSelect='none';
    });
    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        panel.style.width = Math.max(160, Math.min(420, startW + e.clientX - startX)) + 'px';
    });
    document.addEventListener('mouseup', () => {
        dragging=false; document.body.style.cursor=''; document.body.style.userSelect='';
    });
}

function showToast(msg, type = 'ok') {
    if (type === 'err' || type === 'error') toast.error(msg);
    else if (type === 'warn' || type === 'warning') toast.warning(msg);
    else toast.success(msg);
}

// ==========================================
// BULK DELETE LOGIC
// ==========================================

let selectedIds = [];
let isSelectAllResults = false;
let lastTotalElements = 0;

function toggleQuestionSelection() {
    isSelectAllResults = false;
    document.getElementById('select-all-all-area').style.display = 'none';

    const checkboxes = document.querySelectorAll('.q-checkbox');
    const selectAllCheckbox = document.getElementById('selectAllQuestions');
    let allChecked = true;
    let anyChecked = false;

    checkboxes.forEach(cb => {
        const id = parseInt(cb.value);
        if (cb.checked) {
            if (!selectedIds.includes(id)) selectedIds.push(id);
            anyChecked = true;
        } else {
            selectedIds = selectedIds.filter(v => v !== id);
            allChecked = false;
        }
    });

    if (checkboxes.length > 0) {
        selectAllCheckbox.checked = allChecked;
    }

    updateSelectedCount();
    updateBulkActionBar();
}

function toggleSelectAll(source) {
    const checkboxes = document.querySelectorAll('.q-checkbox');
    isSelectAllResults = false;

    checkboxes.forEach(cb => {
        cb.checked = source.checked;
        const id = parseInt(cb.value);
        if (source.checked) {
            if (!selectedIds.includes(id)) selectedIds.push(id);
        } else {
            selectedIds = selectedIds.filter(v => v !== id);
        }
    });

    const selectAllArea = document.getElementById('select-all-all-area');
    if (source.checked && checkboxes.length > 0) {
        if (lastTotalElements > checkboxes.length) {
            selectAllArea.style.display = 'block';
        }
    } else {
        selectAllArea.style.display = 'none';
    }

    updateSelectedCount();
    updateBulkActionBar();
}

window.selectAllResults = function() {
    isSelectAllResults = true;
    const selectAllArea = document.getElementById('select-all-all-area');
    selectAllArea.innerHTML = `<span class="fw-bold"><i class="bi bi-check-all"></i> Đã chọn tất cả ${lastTotalElements} câu hỏi.</span> <a href="javascript:void(0)" onclick="clearSelection()" class="text-danger ms-2">Bỏ chọn</a>`;
    updateSelectedCount();
};

window.clearSelection = function() {
    selectedIds = [];
    isSelectAllResults = false;
    
    document.querySelectorAll('.q-checkbox').forEach(cb => cb.checked = false);
    const selectAllCheckbox = document.getElementById('selectAllQuestions');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    
    const selectAllArea = document.getElementById('select-all-all-area');
    if (selectAllArea) {
        selectAllArea.style.display = 'none';
        selectAllArea.innerHTML = `<a href="javascript:void(0)" onclick="selectAllResults()">Chọn tất cả ${lastTotalElements} câu hỏi</a>`;
    }
    
    updateSelectedCount();
    updateBulkActionBar();
};

function updateSelectedCount() {
    const badge = document.getElementById('selected-count-badge');
    if (!badge) return;
    if (isSelectAllResults) {
        badge.innerText = `${lastTotalElements} đã chọn`;
    } else {
        badge.innerText = `${selectedIds.length} đã chọn`;
    }
}

function updateBulkActionBar() {
    // Luôn hiện thanh
}

function confirmBulkDelete() {
    if (!isSelectAllResults && selectedIds.length === 0) {
        Swal.fire('Lỗi', 'Vui lòng chọn ít nhất một câu hỏi để xóa.', 'warning');
        return;
    }

    const count = isSelectAllResults ? lastTotalElements : selectedIds.length;
    
    Swal.fire({
        title: 'Xác nhận xóa hàng loạt',
        text: `Bạn có chắc chắn muốn xóa ${count} câu hỏi đã chọn? Thao tác này không thể hoàn tác.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Đồng ý xóa',
        cancelButtonText: 'Hủy bỏ'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                let url;
                let options = {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    }
                };

                const keyword = document.getElementById('q-filter-keyword')?.value || '';
                const type = document.getElementById('q-filter-type')?.value || '';
                const level = document.getElementById('q-filter-level')?.value || '';

                if (isSelectAllResults) {
                    url = `/api/admin/questions/bulk-delete-all?categoryId=${activeFolderId}`;
                    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
                    if (type) url += `&type=${type}`;
                    if (level) url += `&level=${level}`;
                    options.method = 'PUT';
                } else {
                    url = '/api/admin/questions/bulk-delete';
                    options.method = 'PUT';
                    options.body = JSON.stringify(selectedIds);
                }

                const res = await fetch(url, options);

                if (res.ok) {
                    Swal.fire('Thành công!', `Đã xóa ${count} câu hỏi.`, 'success');
                    clearSelection();
                    loadFolderContent(activeFolderId, 0); // Reload data
                    await loadTree();
                    restoreTreeState();
                } else {
                    const err = await res.json().catch(() => ({}));
                    Swal.fire('Lỗi', err.message || 'Không thể xóa câu hỏi', 'error');
                }
            } catch (error) {
                console.error(error);
                Swal.fire('Lỗi', 'Đã xảy ra lỗi khi thực hiện thao tác', 'error');
            }
        }
    });
}

/* ══════════════════════════════════════════════
   ADMIN: TẠO CÂU HỎI THỦ CÔNG
 ══════════════════════════════════════════════ */
function openCreateQuestionModal() {
    const catId = (navStack.length > 0) ? navStack[navStack.length - 1].id : null;
    document.getElementById('createQuestionCategoryId').value = catId || '';
    document.getElementById('createQuestionText').value = '';
    document.getElementById('createQuestionType').value = 'SINGLE_CHOICE';
    document.getElementById('createQuestionLevel').value = 'MEDIUM';

    const list = document.getElementById('createAnswerList');
    list.innerHTML = '';
    for (let i = 0; i < 4; i++) list.appendChild(createCreateAnswerNode('', i === 0));
    onCreateTypeChange();

    bootstrap.Modal.getOrCreateInstance(document.getElementById('createQuestionModal')).show();
}

function createCreateAnswerNode(text, isCorrect) {
    const div = document.createElement('div');
    div.className = 'edit-ans-item d-flex gap-2 align-items-center';
    div.innerHTML = `
        <div class="form-check" style="margin-bottom:0;">
            <input class="form-check-input create-ans-correct" type="checkbox" ${isCorrect ? 'checked' : ''}
                   style="transform:scale(1.3);margin-top:0.6rem;cursor:pointer;">
        </div>
        <textarea class="form-control create-ans-text" rows="1" placeholder="Nhập đáp án..."
                  style="border-radius:10px;"></textarea>
        <button class="btn btn-light text-danger" onclick="removeCreateAnswer(this)" style="border-radius:10px;">
            <i class="bi bi-trash"></i>
        </button>`;
    div.querySelector('textarea').value = text;
    return div;
}

function addCreateAnswer() {
    document.getElementById('createAnswerList').appendChild(createCreateAnswerNode('', false));
    onCreateTypeChange();
}

function removeCreateAnswer(btn) {
    btn.parentElement.remove();
    onCreateTypeChange();
}

function onCreateTypeChange() {
    const type = document.getElementById('createQuestionType').value;
    const cbs  = document.querySelectorAll('.create-ans-correct');
    const hint = document.getElementById('createAnswerHint');
    if (type === 'SINGLE_CHOICE') {
        cbs.forEach(cb => { cb.type = 'radio'; cb.name = 'create-ans-radio'; cb.disabled = false; });
        hint.innerHTML = '<i>* Trắc nghiệm 1 đáp án: Chỉ được chọn 1 đáp án đúng.</i>';
        hint.style.display = 'block';
    } else if (type === 'MULTIPLE_CHOICE') {
        cbs.forEach(cb => { cb.type = 'checkbox'; cb.removeAttribute('name'); cb.disabled = false; });
        hint.innerHTML = '<i>* Trắc nghiệm nhiều đáp án: Có thể chọn nhiều đáp án đúng.</i>';
        hint.style.display = 'block';
    } else {
        cbs.forEach(cb => { cb.type = 'checkbox'; cb.removeAttribute('name'); cb.checked = true; cb.disabled = true; });
        hint.innerHTML = '<i>* Điền khuyết: Mọi đáp án thêm vào đều là phương án đúng để so khớp.</i>';
        hint.style.display = 'block';
    }
}

async function submitCreateQuestion() {
    const categoryId = document.getElementById('createQuestionCategoryId').value;
    const text       = document.getElementById('createQuestionText').value.trim();
    const type       = document.getElementById('createQuestionType').value;
    const level      = document.getElementById('createQuestionLevel').value;

    if (!text) { showToast('Nội dung câu hỏi không được để trống!', 'err'); return; }

    const answerItems = document.querySelectorAll('#createAnswerList .edit-ans-item');
    const answers = [];
    let correctCount = 0;
    for (let item of answerItems) {
        const aText    = item.querySelector('.create-ans-text').value.trim();
        const aCorrect = item.querySelector('.create-ans-correct').checked;
        if (!aText) { showToast('Nội dung đáp án không được để trống!', 'err'); return; }
        if (aCorrect) correctCount++;
        answers.push({ text: aText, correct: aCorrect });
    }
    if (answers.length < 1) { showToast('Phải có ít nhất 1 đáp án!', 'err'); return; }
    if (type === 'SINGLE_CHOICE'  && correctCount !== 1) { showToast('Trắc nghiệm 1 đáp án phải có ĐÚNG 1 đáp án đúng!',     'err'); return; }
    if (type === 'MULTIPLE_CHOICE'&& correctCount < 2)   { showToast('Trắc nghiệm nhiều đáp án phải có ÍT NHẤT 2 đáp án đúng!','err'); return; }
    if (type === 'FILL_IN_BLANK'  && correctCount < 1)   { showToast('Điền khuyết phải có ít nhất 1 đáp án!',                  'err'); return; }

    const payload = { categoryId: categoryId ? parseInt(categoryId) : null, text, type, level, answers };

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const btn   = document.getElementById('btnSaveCreateQuestion');
    const old   = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Đang lưu...';
    btn.disabled  = true;

    try {
        const res = await fetch('/api/admin/questions', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Lỗi khi lưu'); }

        showToast('✅ Tạo câu hỏi công khai thành công!', 'ok');
        bootstrap.Modal.getInstance(document.getElementById('createQuestionModal'))?.hide();
        if (navStack.length > 0) loadFolderContent(navStack[navStack.length - 1].id);
    } catch (e) {
        showToast(e.message, 'err');
    } finally {
        btn.innerHTML = old;
        btn.disabled  = false;
    }
}

/* ══════════════════════════════════════════════
   ADMIN: IMPORT EXCEL
 ══════════════════════════════════════════════ */
function openImportExcelModal() {
    const catId = (navStack.length > 0) ? navStack[navStack.length - 1].id : null;
    document.getElementById('importExcelCategoryId').value = catId || '';
    document.getElementById('importExcelFile').value = '';
    document.getElementById('importExcelResult').style.display = 'none';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('importExcelModal')).show();
}

async function doImportExcel() {
    const fileInput = document.getElementById('importExcelFile');
    const catId     = document.getElementById('importExcelCategoryId').value;
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('Vui lòng chọn file Excel!', 'err'); return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    if (catId) formData.append('categoryId', catId);

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const btn   = document.getElementById('btnDoImportExcel');
    const old   = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang import...';
    btn.disabled  = true;

    try {
        const res = await fetch('/api/admin/questions/import', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token },
            body: formData
        });
        const data = await res.json().catch(() => ({}));
        const resultBox = document.getElementById('importExcelResult');
        resultBox.style.display = 'block';

        if (res.ok) {
            const sc = data.successCount || 0;
            const ec = data.errorCount   || 0;
            const errs = (data.errors || []).map(e => `<li>${esc(e)}</li>`).join('');
            resultBox.innerHTML = `
                <div class="alert ${ec === 0 ? 'alert-success' : 'alert-warning'}" style="border-radius:12px;font-size:0.85rem;">
                    <strong><i class="bi bi-${ec===0?'check-circle-fill text-success':'exclamation-triangle-fill text-warning'} me-1"></i>
                    Kết quả:</strong> Thành công <strong>${sc}</strong> câu, lỗi <strong>${ec}</strong> câu.
                    ${errs ? `<ul class="mb-0 mt-2 ps-3" style="font-size:0.8rem;">${errs}</ul>` : ''}
                </div>`;
            if (sc > 0) {
                showToast(`✅ Import thành công ${sc} câu hỏi PUBLIC!`, 'ok');
                if (navStack.length > 0) loadFolderContent(navStack[navStack.length - 1].id);
                await loadTree(); restoreTreeState();
            }
        } else {
            resultBox.innerHTML = `<div class="alert alert-danger" style="border-radius:12px;font-size:0.85rem;">❌ ${esc(data.message || 'Import thất bại')}</div>`;
        }
    } catch (e) {
        showToast('Lỗi kết nối khi import!', 'err');
    } finally {
        btn.innerHTML = old;
        btn.disabled  = false;
    }
}

/* ══════════════════════════════════════════════
   ADMIN: TẠO BẰNG AI
 ══════════════════════════════════════════════ */
let adminAiGeneratedQuestions = [];
let adminAiIsPreviewMode = false;
let _adminAiModalInstance = null;

function openAdminAiModal() {
    const catId = (navStack.length > 0) ? navStack[navStack.length - 1].id : null;
    document.getElementById('adminAiCategoryId').value = catId || '';
    adminAiGeneratedQuestions = [];
    adminAiIsPreviewMode = false;
    _showAdminAiStep('input');
    document.getElementById('admin-ai-input-text').value = '';
    document.getElementById('admin-ai-num-questions').value = '5';
    document.getElementById('admin-ai-level').value = 'MEDIUM';
    _adminAiModalInstance = bootstrap.Modal.getOrCreateInstance(document.getElementById('adminAiModal'));
    _adminAiModalInstance.show();
}

function closeAdminAiModal() {
    if (adminAiIsPreviewMode && adminAiGeneratedQuestions.length > 0) {
        if (!confirm('⚠️ Bạn chưa lưu câu hỏi. Đóng sẽ mất kết quả. Tiếp tục?')) return;
    }
    _adminAiModalInstance?.hide();
}

function _showAdminAiStep(step) {
    document.getElementById('admin-ai-step-input').style.display   = step === 'input'   ? 'block' : 'none';
    document.getElementById('admin-ai-step-preview').style.display = step === 'preview' ? 'block' : 'none';
    document.getElementById('admin-ai-loading').style.display      = step === 'loading' ? 'block' : 'none';
    document.getElementById('admin-ai-footer-input').style.display   = step === 'input'   ? 'flex' : 'none';
    document.getElementById('admin-ai-footer-preview').style.display = step === 'preview' ? 'flex' : 'none';
    adminAiIsPreviewMode = (step === 'preview');
}

function backToAdminAiInput() {
    if (!confirm('Bạn muốn tạo lại? Kết quả hiện tại sẽ bị xóa.')) return;
    adminAiGeneratedQuestions = [];
    _showAdminAiStep('input');
}

async function submitAdminAiGenerate() {
    const text              = document.getElementById('admin-ai-input-text').value.trim();
    const numberOfQuestions = parseInt(document.getElementById('admin-ai-num-questions').value);
    const level             = document.getElementById('admin-ai-level').value;
    const categoryId        = document.getElementById('adminAiCategoryId').value || null;

    if (!text) { showToast('Vui lòng nhập nội dung bài giảng hoặc chủ đề.', 'warn'); return; }
    if (!numberOfQuestions || numberOfQuestions < 1 || numberOfQuestions > 50) {
        showToast('Số câu hỏi phải từ 1 đến 50.', 'warn'); return;
    }

    _showAdminAiStep('loading');
    try {
        const res = await fetch('/api/v1/ai/generate-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, numberOfQuestions, level, categoryId: categoryId ? parseInt(categoryId) : null })
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `Lỗi HTTP ${res.status}`); }
        const data = await res.json();
        adminAiGeneratedQuestions = data.result || [];
        if (adminAiGeneratedQuestions.length === 0) throw new Error('AI không trả về câu hỏi nào. Vui lòng thử lại.');

        _renderAdminAiPreview(adminAiGeneratedQuestions);
        _showAdminAiStep('preview');
        document.getElementById('admin-ai-preview-count').textContent = adminAiGeneratedQuestions.length;
        showToast(`✅ AI đã tạo ${adminAiGeneratedQuestions.length} câu hỏi!`, 'ok');
    } catch (err) {
        _showAdminAiStep('input');
        showToast('❌ ' + err.message, 'err');
    }
}

function _renderAdminAiPreview(questions) {
    const container = document.getElementById('admin-ai-preview-container');
    container.innerHTML = '';
    const levelColor = { EASY: '#22c55e', MEDIUM: '#f59e0b', HARD: '#ef4444' };
    const levelLabel = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' };

    questions.forEach((q, qIdx) => {
        const lvl = q.level || 'MEDIUM';
        const card = document.createElement('div');
        card.style.cssText = 'background:#fff;border-radius:14px;padding:16px 20px;margin-bottom:12px;border:1.5px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.04);position:relative;';
        card.innerHTML = `
            <button onclick="adminDeleteAiQ(${qIdx})" style="position:absolute;top:12px;right:12px;background:none;border:none;color:#ef4444;cursor:pointer;padding:4px;" title="Xóa câu hỏi này">
                <i class="bi bi-trash3-fill"></i>
            </button>
            <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;padding-right:24px;">
                <span style="min-width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-size:0.78rem;font-weight:700;display:flex;align-items:center;justify-content:center;">${qIdx+1}</span>
                <div style="flex:1;">
                    <div style="font-weight:600;color:#1e293b;font-size:0.93rem;outline:none;" contenteditable="true" onblur="adminSyncQText(${qIdx}, this)">${escAi(q.text)}</div>
                    <span style="font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:20px;color:#fff;background-color:${levelColor[lvl]};display:inline-block;margin-top:4px;">${levelLabel[lvl]}</span>
                </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;padding-left:36px;">
                ${(q.answers || []).map((a, aIdx) => {
                    const correct = a.correct === true || a.isCorrect === true;
                    return `<div onclick="adminToggleCorrect(${qIdx}, ${aIdx})" style="cursor:pointer;padding:7px 12px;border-radius:9px;border:1.5px solid ${correct?'#bbf7d0':'#f1f5f9'};background:${correct?'#f0fdf4':'#fff'};font-size:0.87rem;color:${correct?'#15803d':'#334155'};display:flex;gap:8px;align-items:center;transition:all 0.2s;">
                        <i class="bi bi-${correct?'check-circle-fill text-success':'circle text-muted'}"></i>
                        <span style="font-weight:600;">${String.fromCharCode(65+aIdx)}.</span>
                        <span style="flex:1;outline:none;" contenteditable="true" onclick="event.stopPropagation()" onblur="adminSyncAText(${qIdx}, ${aIdx}, this)">${escAi(a.text)}</span>
                    </div>`;
                }).join('')}
            </div>`;
        container.appendChild(card);
    });
}

function adminSyncQText(qIdx, el) {
    if (adminAiGeneratedQuestions[qIdx]) {
        adminAiGeneratedQuestions[qIdx].text = el.innerText.trim();
    }
}

function adminSyncAText(qIdx, aIdx, el) {
    if (adminAiGeneratedQuestions[qIdx] && adminAiGeneratedQuestions[qIdx].answers[aIdx]) {
        adminAiGeneratedQuestions[qIdx].answers[aIdx].text = el.innerText.trim();
    }
}

function adminToggleCorrect(qIdx, aIdx) {
    const q = adminAiGeneratedQuestions[qIdx];
    if (!q) return;
    if (q.type === 'SINGLE_CHOICE' || q.type === 'FILL_IN_BLANK') {
        q.answers.forEach((ans, idx) => {
            ans.isCorrect = (idx === aIdx);
            ans.correct = (idx === aIdx);
        });
    } else if (q.type === 'MULTIPLE_CHOICE') {
        const isC = (q.answers[aIdx].isCorrect === true || q.answers[aIdx].correct === true);
        q.answers[aIdx].isCorrect = !isC;
        q.answers[aIdx].correct = !isC;
    }
    _renderAdminAiPreview(adminAiGeneratedQuestions);
}

function adminDeleteAiQ(qIdx) {
    if (confirm(`Bạn có chắc muốn xóa câu số ${qIdx + 1}?`)) {
        adminAiGeneratedQuestions.splice(qIdx, 1);
        _renderAdminAiPreview(adminAiGeneratedQuestions);
        document.getElementById('admin-ai-preview-count').textContent = adminAiGeneratedQuestions.length;
    }
}


async function saveAdminAiQuestions() {
    if (!adminAiGeneratedQuestions || adminAiGeneratedQuestions.length === 0) return;
    const catId = document.getElementById('adminAiCategoryId').value;

    const payload = adminAiGeneratedQuestions.map(q => ({
        text:       q.text,
        type:       q.type  || 'SINGLE_CHOICE',
        level:      q.level || 'MEDIUM',
        categoryId: catId ? parseInt(catId) : null,
        answers: (q.answers || []).map(a => ({
            text:    a.text,
            correct: a.correct === true || a.isCorrect === true
        }))
    }));

    const btn = document.getElementById('btn-admin-ai-save');
    const old = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Đang lưu...';
    btn.disabled  = true;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch('/api/admin/questions/ai-save', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            const sc = data.success || 0;
            const fc = data.fail   || 0;
            if (fc === 0) {
                showToast(`✅ Đã lưu ${sc} câu hỏi vào kho công khai!`, 'ok');
                adminAiIsPreviewMode = false;
                _adminAiModalInstance?.hide();
                if (navStack.length > 0) loadFolderContent(navStack[navStack.length - 1].id);
                await loadTree(); restoreTreeState();
            } else {
                showToast(`⚠️ Lưu được ${sc} câu, thất bại ${fc} câu.`, 'warn');
            }
        } else {
            throw new Error(data.message || 'Lưu thất bại');
        }
    } catch (e) {
        showToast('❌ ' + e.message, 'err');
    } finally {
        btn.innerHTML = old;
        btn.disabled  = false;
    }
}

function escAi(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
