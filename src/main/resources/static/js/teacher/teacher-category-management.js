/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let MODE = 'mine';   // 'mine' | 'public'
let TREE_DATA = [];
let navStack = [];       // [{id, name}]
let OWN_MODE = true;     // can edit in mine mode
let expandedNodes = new Set(); // Lưu trữ ID các thư mục đang được xổ ra
let searchTerm = '';      // Từ khóa tìm kiếm cây danh mục

function showConfirmModal(title, message, onConfirm) {
    let modalEl = document.getElementById('customConfirmModal');
    if (!modalEl) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal fade" id="customConfirmModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered modal-sm">
                    <div class="modal-content text-center p-4" style="border-radius:20px; border:none; box-shadow:0 10px 30px rgba(0,0,0,0.1);">
                        <div class="text-warning mb-2" style="font-size: 2.5rem;"><i class="bi bi-exclamation-triangle-fill"></i></div>
                        <h6 class="fw-bold mb-1" id="customConfirmTitle" style="font-size:1.1rem; color:#1e293b;"></h6>
                        <p class="text-muted small mb-3" id="customConfirmMsg"></p>
                        <div class="d-flex gap-2">
                            <button class="btn btn-light w-50" data-bs-dismiss="modal" style="border-radius:12px;font-weight:600;height:42px;">Hủy</button>
                            <button class="btn btn-danger w-50 fw-bold" id="customConfirmBtn" style="border-radius:12px;height:42px;">Xác nhận</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        modalEl = document.getElementById('customConfirmModal');
    }
    document.getElementById('customConfirmTitle').textContent = title;
    document.getElementById('customConfirmMsg').textContent = message;
    const btn = document.getElementById('customConfirmBtn');
    btn.onclick = () => {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        onConfirm();
    };
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

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

    const catType = document.getElementById('categoryTypeInput').value || 'mine';
    initMode(catType);

    const searchInput = document.getElementById('treeSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            searchTerm = e.target.value.trim().toLowerCase();
            const treeActions = document.getElementById('treeGlobalActions');
            if (treeActions) {
                treeActions.style.display = (searchTerm === '' && OWN_MODE) ? 'flex' : 'none';
            }
            renderTree(TREE_DATA);
            restoreTreeState();
        });
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.bc-dropdown').forEach(d => d.classList.remove('show'));
    });

    // Flatpickr initialization
    if (typeof flatpickr !== 'undefined') {
        document.querySelectorAll('.flatpickr-datetime').forEach(el => {
            const modal = el.closest('.modal');
            flatpickr(el, {
                enableTime: true,
                altInput: true,
                altFormat: "d/m/Y H:i",
                dateFormat: "Y-m-dTH:i",
                time_24hr: true,
                locale: "vn",
                allowInput: true,
                minDate: "today",
                position: "bottom",
                appendTo: modal ? modal : document.body
            });
        });
    }

    const classroomSelect = document.getElementById('classroomIdSelect');
    if (classroomSelect) {
        classroomSelect.addEventListener('change', async function () {
            const classId = this.value;
            const topicContainer = document.getElementById('topicDropdownContainer');
            const topicSelect = document.getElementById('assignTopicId');

            topicSelect.innerHTML = '<option value="" selected>-- Không chọn chủ đề --</option>';
            topicContainer.style.display = 'none';

            if (!classId) return;

            try {
                const topics = await apiClient.get('/api/teacher/class-topics/classroom/' + classId);
                if (topics && topics.length > 0) {
                    topics.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.id;
                        opt.textContent = t.name;
                        topicSelect.appendChild(opt);
                    });
                    topicContainer.style.display = 'block';
                }
            } catch (e) {
                console.error('Lỗi khi tải danh sách chủ đề:', e);
            }
        });
    }
});

/* ══════════════════════════════════════════════
   MODE INIT
══════════════════════════════════════════════ */
function initMode(m) {
    MODE = m; OWN_MODE = (m === 'mine');

    document.getElementById('treeLabel').textContent = m === 'mine' ? 'Danh mục của tôi' : 'Danh mục công khai';
    document.getElementById('rootHint').textContent = m === 'mine'
        ? 'Chọn thư mục bên trái hoặc tạo danh mục mới để bắt đầu.'
        : 'Chọn thư mục bên trái để xem các đề thi.';

    // Show/hide create buttons per mode
    const tf = document.getElementById('toolbarActions');
    tf.style.display = 'flex';
    document.getElementById('btnNewFolder').style.display = OWN_MODE ? 'flex' : 'none';
    const dropdownWrap = document.getElementById('dropdownQuizWrap');
    if (dropdownWrap) dropdownWrap.style.display = OWN_MODE ? 'block' : 'none';
    const treeGlobal = document.getElementById('treeGlobalActions');
    if (treeGlobal) treeGlobal.style.display = OWN_MODE ? 'flex' : 'none';

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
    const api = MODE === 'mine' ? '/api/teacher/categories/mine' : '/api/teacher/categories/public';
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
    wrap.innerHTML = `<div style="padding:6px;">${nodes.map(n => treeNodeHtml(n, false)).join('')}</div>`;
}

function treeNodeHtml(node, forceShow = false) {
    const isDirectMatch = searchTerm === '' || node.name.toLowerCase().includes(searchTerm);
    const match = forceShow || isDirectMatch;
    
    let childrenHtml = '';
    let hasMatchingChild = false;

    if (node.children && node.children.length > 0) {
        // Nếu nút hiện tại khớp, toàn bộ con của nó được forceShow = true
        const childHtmls = node.children.map(c => treeNodeHtml(c, match)).filter(h => h !== '');
        if (childHtmls.length > 0) {
            hasMatchingChild = true;
            childrenHtml = childHtmls.join('');
        }
    }

    if (searchTerm !== '' && !match && !hasMatchingChild) {
        return '';
    }

    // Tự động xổ ra nếu node con có chứa kết quả tìm kiếm, để người dùng thấy được node khớp.
    // Nhưng nếu node này khớp trực tiếp, không ép buộc mở toàn bộ con sâu dưới (để tự click mở sau).
    const isForceOpen = searchTerm !== '' && hasMatchingChild && !isDirectMatch;
    const isNodeOpen = isForceOpen || expandedNodes.has(node.id);

    const hasKids = node.children && node.children.length > 0;
    // Chỉ hiện mũi tên nếu thực tế node đó có con được kết xuất
    const arrow = (hasKids && childrenHtml !== '')
        ? `<i class="bi bi-chevron-right tree-arrow ${isNodeOpen ? 'open' : ''}" id="arr-${node.id}"></i>`
        : `<span style="width:12px;display:inline-block;"></span>`;

    const kids = childrenHtml !== ''
        ? `<div class="tree-children ${isNodeOpen ? 'open' : ''}" id="kids-${node.id}">${childrenHtml}</div>`
        : '';

    // Inline action buttons — chỉ hiện trong chế độ Own
    const actions = OWN_MODE ? `
<span class="tree-row-actions" onclick="event.stopPropagation()">
    <button class="tree-act-btn" title="Thêm thư mục con"
        onclick="openCatModal(${node.id})">
        <i class="bi bi-folder-plus"></i>
    </button>
    <button class="tree-act-btn" title="Sửa thư mục"
        onclick="openEditCatModal(${node.id},${JSON.stringify(node.name).replace(/"/g, '&quot;')},${JSON.stringify(node.description || '').replace(/"/g, '&quot;')},${node.parentId || null})">
        <i class="bi bi-pencil"></i>
    </button>
    <button class="tree-act-btn" title="Xóa thư mục"
        onclick="openDelCatModal(${node.id})">
        <i class="bi bi-trash"></i>
    </button>
</span>` : '';

    let displayName = esc(node.name);
    if (searchTerm !== '' && isDirectMatch) {
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
    onclick="treeClick(${node.id},${JSON.stringify(node.name).replace(/"/g, '&quot;')},event)">
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
    const arr = document.getElementById('arr-' + id);
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
        const arr = document.getElementById('arr-' + id);
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
    document.getElementById('rootLanding').style.display = 'flex';
    document.querySelectorAll('.tree-row').forEach(r => r.classList.remove('active'));

    // Reset toolbar buttons to no category context
    document.getElementById('btnNewFolder').onclick = () => openCatModal(null);
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

    document.getElementById('rootLanding').style.display = 'none';
    document.getElementById('dynamicContent').style.display = 'block';

    // Cập nhật toolbars tạo mới
    document.getElementById('btnNewFolder').onclick = () => openCatModal(id);

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
async function loadFolderContent(catId) {
    const dc = document.getElementById('dynamicContent');
    dc.innerHTML = `<div class="quiz-grid">${[1, 2, 3].map(() => `<div class="skeleton" style="height:180px;border-radius:16px;"></div>`).join('')}</div>`;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const node = findNode(TREE_DATA, catId);
    const subs = node ? (node.children || []) : [];

    let quizzes = [];
    try {
        const suffix = MODE === 'mine' ? '/quizzes/mine' : '/quizzes/public';
        const res = await fetch(`/api/teacher/categories/${catId}${suffix}`,
            { headers: { Authorization: 'Bearer ' + token } });
        if (res.ok) quizzes = await res.json();
    } catch (_) { }

    renderFolderContent(dc, subs, quizzes, catId);
}

function renderFolderContent(container, subs, quizzes, parentId) {
    let html = '';

    // Quizzes
    if (quizzes.length > 0) {
        html += `<p class="section-title"><i class="bi bi-file-earmark-text me-1"></i> Đề thi / Quiz (${quizzes.length})</p>`;
        html += `<div class="quiz-grid">`;
        quizzes.forEach(q => { html += quizCardHtml(q); });
        html += `</div>`;
    }

    // Empty
    if (quizzes.length === 0 && subs.length === 0) {
        html = `<div class="empty-root">
    <div class="empty-root-icon"><i class="bi bi-file-earmark-x"></i></div>
    <h3>Thư mục trống</h3>
    <p>${OWN_MODE ? 'Hãy thêm thư mục con hoặc tạo đề thi mới vào đây.' : 'Thư mục này hiện chưa có đề thi nào.'}</p>
    ${OWN_MODE ? `<div style="display:flex;gap:12px;margin-top:8px;">
        <button class="btn-tool btn-new-folder" onclick="openCatModal(${parentId})"><i class="bi bi-folder-plus"></i> Thêm thư mục con</button>
        <div class="dropdown">
            <button class="btn-tool btn-new-quiz dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="bi bi-file-earmark-plus-fill"></i> Tạo đề thi
            </button>
            <ul class="dropdown-menu shadow border-0 rounded-4 mt-2 p-2" style="width: 260px; animation: fadeIn 0.2s ease;">
                <li>
                    <a class="dropdown-item p-3 rounded-3 d-flex align-items-center gap-3 mb-1" href="javascript:void(0)" onclick="goCreate('manual')">
                        <div style="background:#eff6ff; color:#3b82f6; width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1rem;"><i class="bi bi-pencil-square"></i></div>
                        <div>
                            <div class="fw-bold text-dark" style="font-size:0.8rem;">Soạn thủ công</div>
                            <div class="text-muted" style="font-size:0.65rem;">Chọn câu hỏi từng bước</div>
                        </div>
                    </a>
                </li>
                <li>
                    <a class="dropdown-item p-3 rounded-3 d-flex align-items-center gap-3 mb-1" href="javascript:void(0)" onclick="goCreate('quick')">
                        <div style="background:#f0fdf4; color:#16a34a; width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1rem;"><i class="bi bi-magic"></i></div>
                        <div>
                            <div class="fw-bold text-dark" style="font-size:0.8rem;">Tạo nhanh (Magic)</div>
                            <div class="text-muted" style="font-size:0.65rem;">Visual Designer: Excel/JSON</div>
                        </div>
                    </a>
                </li>
                <li>
                    <a class="dropdown-item p-3 rounded-3 d-flex align-items-center gap-3" href="javascript:void(0)" onclick="goCreate('ai')">
                        <div style="background:#faf5ff; color:#7c3aed; width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1rem;"><i class="bi bi-robot"></i></div>
                        <div>
                            <div class="fw-bold text-dark" style="font-size:0.8rem;">Tạo bằng AI (Gemini)</div>
                            <div class="text-muted" style="font-size:0.65rem;">Soạn đề tự động từ tài liệu</div>
                        </div>
                    </a>
                </li>
            </ul>
        </div>
    </div>` : ''}
</div>`;
    }

    container.innerHTML = html;
}

function quizCardHtml(q) {
    const typeBadge = q.isExam
        ? `<span class="qbadge qbadge-exam"><i class="bi bi-mortarboard-fill"></i> Kiểm tra</span>`
        : `<span class="qbadge qbadge-quiz"><i class="bi bi-journal-check"></i> Luyện tập</span>`;

    const actions = OWN_MODE
        ? `<div class="quiz-actions">
              <a class="qact qact-edit" href="/teacher/quizzes/${q.id}/edit"><i class="bi bi-pencil-square"></i> Sửa</a>
              <button class="qact qact-view" onclick="openQuizPreviewModal('${q.id}', event)"><i class="bi bi-eye"></i> Xem</button>
              <button class="qact qact-del" onclick="deleteQuiz('${q.id}', event)"><i class="bi bi-trash3"></i> Xóa</button>
              <button class="qact qact-assign" onclick="openAssignModal('${q.id}', '${escJs(q.title)}', event)"><i class="bi bi-send-fill"></i> Giao bài</button>
           </div>`
        : `<div class="quiz-actions">
              <button class="qact qact-view" style="flex:1;" onclick="openQuizPreviewModal('${q.id}', event)"><i class="bi bi-eye"></i> Xem thử</button>
              <button class="qact qact-assign" onclick="openAssignModal('${q.id}', '${escJs(q.title)}', event)"><i class="bi bi-send-fill"></i> Giao bài</button>
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
    document.getElementById('catEditId').value = '';
    document.getElementById('catParentId').value = parentId || '';
    document.getElementById('catModalTitle').textContent = parentId ? 'Tạo thư mục con' : 'Tạo danh mục mới';
    document.getElementById('catNameInput').value = '';
    document.getElementById('catDescInput').value = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('catModal')).show();
}

function openEditCatModal(id, name, desc, parentId) {
    document.getElementById('catEditId').value = id;
    document.getElementById('catParentId').value = parentId || '';
    document.getElementById('catModalTitle').textContent = 'Sửa danh mục';
    document.getElementById('catNameInput').value = name;
    document.getElementById('catDescInput').value = desc || '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('catModal')).show();
}

async function submitCategory() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const editId = document.getElementById('catEditId').value;
    const parentId = document.getElementById('catParentId').value;
    const name = document.getElementById('catNameInput').value.trim();
    const desc = document.getElementById('catDescInput').value.trim();
    const isPublic = false; // Teacher cannot set isPublic

    if (!name) { showToast('Vui lòng nhập tên danh mục!', 'err'); return; }

    const isEdit = !!editId;
    const url = isEdit ? `/api/teacher/categories/${editId}` : '/api/teacher/categories';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: desc, parentId: parentId ? parseInt(parentId) : null, isPublic })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Lỗi'); }

        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('catModal'));
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
            loadFolderContent(navStack[navStack.length - 1].id);
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
    const id = document.getElementById('delCatId').value;
    try {
        const res = await fetch(`/api/teacher/categories/${id}`, {
            method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Lỗi'); }
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('delCatModal'));
        if (modalInstance) modalInstance.hide();
        showToast('Đã xóa danh mục!', 'ok');
        const curId = navStack.length > 0 ? navStack[navStack.length - 1].id : null;
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
    if (el) el.classList.remove('dragging');

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
            isPublic: false
        };
        const res = await fetch(`/api/teacher/categories/${draggedNodeId}`, {
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
function goCreate(mode) {
    const catId = (navStack.length > 0) ? navStack[navStack.length - 1].id : '';
    const suffix = catId ? `?categoryId=${catId}` : '';
    if (mode === 'manual') {
        window.location.href = `/teacher/quizzes/create${suffix}`;
    } else if (mode === 'quick') {
        window.location.href = `/teacher/quizzes/quick-create${suffix}`;
    } else if (mode === 'ai') {
        window.location.href = `/teacher/quizzes/ai-create${suffix}`;
    }
}

function deleteQuiz(id, e) {
    if (e) e.stopPropagation();
    showConfirmModal('Xóa đề thi?', 'Đề thi sẽ bị ẩn khỏi danh sách. Các lớp đã được giao bài vẫn có thể tiếp tục làm bình thường. Bạn có chắc chắn muốn xóa?', async () => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        try {
            const res = await fetch(`/api/teacher/quizzes/${id}`, {
                method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
            });
            if (!res.ok) throw new Error('Lỗi xóa');
            showToast('Đã xóa đề thi!', 'ok');
            if (navStack.length > 0) loadFolderContent(navStack[navStack.length - 1].id);
        } catch (e) { showToast(e.message, 'err'); }
    });
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
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function escJs(s) { return s ? s.replace(/'/g, "\\'").replace(/"/g, '\\"') : ''; }

async function openQuizPreviewModal(id, event) {
    if (event) event.preventDefault();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch(`/api/teacher/quizzes/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const q = await res.json();
            document.getElementById('preview-quiz-title').textContent = q.title || 'Chưa có tiêu đề';
            document.getElementById('preview-quiz-desc').textContent = q.description || 'Chưa có mô tả.';

            const container = document.getElementById('preview-quiz-questions');
            container.innerHTML = '';

            const list = q.questions || [];
            document.getElementById('preview-quiz-count').textContent = list.length;

            if (list.length === 0) {
                container.innerHTML = `<div class="text-center text-muted py-4">Chưa có câu hỏi nào trong đề.</div>`;
            } else {
                container.innerHTML = list.map((item, idx) => {
                    const levelClass = item.level === 'EASY' 
                        ? 'modal-q-badge-easy'
                        : item.level === 'MEDIUM'
                        ? 'modal-q-badge-medium'
                        : 'modal-q-badge-hard';
                    
                    const levelLabel = item.level === 'EASY' ? 'Dễ' : item.level === 'MEDIUM' ? 'Trung bình' : 'Khó';
                    const levelBadge = `<span class="modal-q-badge ${levelClass}">${levelLabel}</span>`;

                    const typeLabel = item.type === 'SINGLE_CHOICE'
                        ? 'Trắc nghiệm 1 đáp án'
                        : item.type === 'MULTIPLE_CHOICE'
                        ? 'Trắc nghiệm nhiều đáp án'
                        : 'Điền khuyết';

                    let ansHtml = '';
                    if (item.answers && item.answers.length > 0) {
                        ansHtml = item.answers.map((a, i) => {
                            const correctClass = a.isCorrect ? 'correct' : 'incorrect';
                            const checkIcon = a.isCorrect ? '<i class="bi bi-check-circle-fill modal-ans-icon"></i>' : '';
                            return `
                                <div class="modal-ans-row ${correctClass}">
                                    <span class="ans-letter">${String.fromCharCode(65 + i)}.</span>
                                    <span>${esc(a.text || '')}</span>
                                    ${checkIcon}
                                </div>`;
                        }).join('');
                    } else {
                        ansHtml = `<p class="text-muted small">Không có đáp án.</p>`;
                    }

                    return `
                    <div class="modal-q-card mb-3">
                        <div class="d-flex align-items-center justify-content-between mb-3">
                            <span class="fw-bold" style="font-size: 0.82rem; color: #4338ca;">Câu hỏi ${idx + 1} (${typeLabel})</span>
                            ${levelBadge}
                        </div>
                        <div class="fw-bold text-dark mb-2" style="font-size: 0.98rem; line-height: 1.5;">${esc(item.text || '')}</div>
                        <div>${ansHtml}</div>
                    </div>`;
                }).join('');
            }

            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('previewQuizModal'));
            modal.show();
        }
    } catch (err) {
        console.error('Lỗi tải đề thi', err);
    }
}


function initResize() {
    const handle = document.getElementById('resizeHandle');
    const panel = document.getElementById('treePanel');
    if (!handle || !panel) return;
    let dragging = false, startX, startW;
    handle.addEventListener('mousedown', e => {
        dragging = true; startX = e.clientX; startW = panel.offsetWidth;
        document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        panel.style.width = Math.max(160, Math.min(420, startW + e.clientX - startX)) + 'px';
    });
    document.addEventListener('mouseup', () => {
        dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = '';
    });
}

function showToast(msg, type = 'ok') {
    if (type === 'err' || type === 'error') toast.error(msg);
    else if (type === 'warn' || type === 'warning') toast.warning(msg);
    else toast.success(msg);
}

async function openAssignModal(id, title, event) {
    if (event) event.preventDefault();
    document.getElementById('assignForm').reset();
    document.getElementById('assignQuizId').value = id;
    document.getElementById('assignQuizTitle').value = title;

    document.getElementById('assignTopicId').innerHTML = '<option value="" selected>-- Không chọn chủ đề --</option>';
    document.getElementById('topicDropdownContainer').style.display = 'none';

    // Set default dates
    const now = new Date();
    const due = new Date();
    due.setDate(now.getDate() + 7);
    due.setHours(23, 59, 0, 0);

    // Update Flatpickr values
    const startPicker = document.querySelector("#assignStartDate")._flatpickr;
    const duePicker = document.querySelector("#assignDueDate")._flatpickr;
    if (startPicker) startPicker.setDate(now);
    if (duePicker) duePicker.setDate(due);

    // Fetch classrooms
    const select = document.getElementById('classroomIdSelect');
    select.innerHTML = '<option value="" disabled selected>-- Chọn lớp học --</option>';

    try {
        const classrooms = await apiClient.get('/api/teacher/classrooms');
        classrooms.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name} (${c.code})`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error(err);
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('assignModal')).show();
}

window.onClassroomChange = async function () {
    const classId = document.getElementById('classroomIdSelect').value;
    const topicContainer = document.getElementById('topicDropdownContainer');
    const topicSelect = document.getElementById('assignTopicId');

    topicSelect.innerHTML = '<option value="" selected>-- Không chọn chủ đề --</option>';
    topicContainer.style.display = 'none';

    const customTargetRadio = document.getElementById('assignTargetCustomCM');
    if (customTargetRadio && customTargetRadio.checked) {
        window.toggleStudentSelection(true);
    }

    if (!classId) return;

    try {
        const topics = await apiClient.get('/api/teacher/class-topics/classroom/' + classId);
        if (topics && topics.length > 0) {
            topics.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name;
                topicSelect.appendChild(opt);
            });
            topicContainer.style.display = 'block';
        }
    } catch (e) {
        console.error('Lỗi khi tải danh sách chủ đề:', e);
    }
};

window.selectAllStudents = function(checked) {
    const checkboxes = document.querySelectorAll('#studentCheckboxesList .student-assign-cb');
    checkboxes.forEach(cb => {
        if (cb.closest('.form-check').style.display !== 'none') {
            cb.checked = checked;
        }
    });
};

window.filterStudentList = function() {
    const input = document.getElementById('studentSearchInput');
    if (!input) return;
    const filter = input.value.toLowerCase();
    const items = document.querySelectorAll('#studentCheckboxesList .form-check');
    
    items.forEach(item => {
        const label = item.querySelector('label');
        if (label && label.textContent.toLowerCase().includes(filter)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
};

window.toggleStudentSelection = async function (show) {
    const container = document.getElementById('studentSelectionContainer');
    if (!container) return;
    
    if (show) {
        container.style.display = 'flex';
        const listEl = document.getElementById('studentCheckboxesList');
        const classId = document.getElementById('classroomIdSelect').value;
        
        if (!classId) {
            listEl.innerHTML = '<div class="text-center py-2 text-muted small text-danger">Vui lòng chọn lớp học trước!</div>';
            return;
        }

        listEl.innerHTML = '<div class="text-center py-2 text-muted small"><span class="spinner-border spinner-border-sm me-2"></span> Đang tải...</div>';
        try {
            const res = await apiClient.get(`/api/teacher/classrooms/${classId}/students`);
            if (!res || res.length === 0) {
                listEl.innerHTML = '<div class="text-center py-2 text-muted small text-danger"><i class="bi bi-exclamation-triangle me-1"></i> Lớp học chưa có học sinh nào!</div>';
                return;
            }
            listEl.innerHTML = res.map(s => `
                <div class="form-check mb-1">
                    <input class="form-check-input student-assign-cb" type="checkbox" value="${s.studentId}" id="cb_student_${s.studentId}">
                    <label class="form-check-label small fw-semibold text-dark cursor-pointer" for="cb_student_${s.studentId}">
                        ${esc(s.fullName)} (${esc(s.email)})
                    </label>
                </div>
            `).join('');
        } catch (e) {
            listEl.innerHTML = '<div class="text-center py-2 text-muted small text-danger">Lỗi kết nối hoặc không thể tải học sinh.</div>';
        }
    } else {
        container.style.display = 'none';
    }
};

window.promptExcelColumn = function(colDataSamples, callback) {
    let existing = document.getElementById('excelColSelectModal');
    if (existing) existing.remove();

    let optionsHtml = colDataSamples.map(c => {
        let label = `Cột ${c.letter}`;
        if (c.sample) {
            let shortSample = c.sample.toString().substring(0, 30);
            label += ` (VD: ${esc(shortSample)})`;
        }
        return `<option value="${c.index}">${label}</option>`;
    }).join('');
    
    let modalHtml = `
    <div class="modal fade" id="excelColSelectModal" tabindex="-1" style="z-index: 1060;">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content" style="border-radius:16px;">
          <div class="modal-header border-0 pb-0 pt-3 px-3">
            <h6 class="modal-title fw-bold text-primary">Chọn cột Email</h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body px-3 py-3">
            <p class="small text-muted mb-2">Chọn cột (A, B, C...) chứa Email học sinh trong file Excel:</p>
            <select id="excelColSelect" class="form-select form-select-sm rounded-3">
                ${optionsHtml}
            </select>
          </div>
          <div class="modal-footer border-0 pt-0 px-3 pb-3">
            <button type="button" class="btn btn-light btn-sm rounded-3 fw-bold" data-bs-dismiss="modal">Hủy</button>
            <button type="button" class="btn btn-primary btn-sm rounded-3 fw-bold px-3" id="btnConfirmExcelCol">Xác nhận</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    let modalEl = document.getElementById('excelColSelectModal');
    let modal = new bootstrap.Modal(modalEl);
    
    document.getElementById('btnConfirmExcelCol').onclick = function() {
        let colIdx = parseInt(document.getElementById('excelColSelect').value);
        modal.hide();
        callback(colIdx);
    };
    
    modal.show();
};

window.importStudentsFromExcel = function(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ""});
            
            if (json.length === 0) {
                showToast("File Excel rỗng!", "warning");
                return;
            }
            
            let maxCols = 0;
            json.forEach(row => { if(row.length > maxCols) maxCols = row.length; });
            
            if (maxCols === 0) {
                showToast("File Excel không có dữ liệu!", "warning");
                return;
            }

            const getColLetter = (colIndex) => {
                let letter = "";
                let temp = colIndex;
                while (temp >= 0) {
                    letter = String.fromCharCode((temp % 26) + 65) + letter;
                    temp = Math.floor(temp / 26) - 1;
                }
                return letter;
            };

            let colDataSamples = [];
            for(let c = 0; c < maxCols; c++) {
                let sample = "";
                for(let r = 0; r < Math.min(json.length, 10); r++) {
                    if (json[r] && json[r][c] && json[r][c].toString().trim() !== "") {
                        sample = json[r][c];
                        break;
                    }
                }
                colDataSamples.push({
                    index: c,
                    letter: getColLetter(c),
                    sample: sample
                });
            }

            promptExcelColumn(colDataSamples, function(colIdx) {
                let emails = [];
                for (let i = 0; i < json.length; i++) {
                    let val = json[i][colIdx];
                    if (val && typeof val === 'string' && val.includes('@')) {
                        emails.push(val.trim().toLowerCase());
                    }
                }

                if (emails.length === 0) {
                    showToast("Không tìm thấy email hợp lệ nào ở cột đã chọn!", "warning");
                    return;
                }

                let matchCount = 0;
                const checkboxes = document.querySelectorAll('#studentCheckboxesList .form-check');
                checkboxes.forEach(item => {
                    const label = item.querySelector('label');
                    const cb = item.querySelector('input[type="checkbox"]');
                    if (label && cb) {
                        const text = label.textContent.toLowerCase();
                        const matched = emails.some(email => text.includes(`(${email})`));
                        if (matched) {
                            cb.checked = true;
                            matchCount++;
                        }
                    }
                });

                if (matchCount > 0) {
                    showToast(`Đã chọn ${matchCount} học sinh từ file Excel!`, "ok");
                } else {
                    showToast(`Đã tải ${emails.length} email, nhưng không có học sinh nào khớp trong lớp!`, "warning");
                }
            });
            
        } catch (err) {
            console.error(err);
            showToast("Lỗi khi đọc file Excel!", "error");
        } finally {
            input.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
};

async function confirmAssign() {
    try {
        const form = document.getElementById('assignForm');
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            if (key === 'questionShuffled' || key === 'answerShuffled' || key === 'showAnswer') {
                data[key] = true;
            } else {
                data[key] = value;
            }
        });

        if (!data.questionShuffled) data.questionShuffled = false;
        if (!data.answerShuffled) data.answerShuffled = false;
        if (!data.showAnswer) data.showAnswer = false;

        const assignTarget = form.querySelector('input[name="assignTarget"]:checked')?.value || 'ALL';
        if (assignTarget === 'CUSTOM') {
            const checkedBoxes = form.querySelectorAll('#studentCheckboxesList input[type="checkbox"]:checked');
            if (checkedBoxes.length === 0) {
                showToast('Vui lòng chọn ít nhất 1 học sinh để giao đề!', 'warning');
                return;
            }
            data.assignedStudentIds = Array.from(checkedBoxes).map(cb => cb.value).join(',');
        } else {
            data.assignedStudentIds = '';
        }

        // Validation
        if (!data.classroomId) {
            showToast('Vui lòng chọn lớp học!', 'warning');
            return;
        }
        if (!data.durationInMins || parseInt(data.durationInMins) < 1) {
            showToast('Thời gian làm bài không hợp lệ!', 'warning');
            return;
        }
        if (!data.maxAttempt || parseInt(data.maxAttempt) < 1) {
            showToast('Số lần làm tối đa không hợp lệ!', 'warning');
            return;
        }
        if (!data.startDate || !data.dueDate) {
            showToast('Vui lòng chọn đầy đủ ngày mở đề và hạn chót!', 'warning');
            return;
        }

        const start = new Date(data.startDate);
        const due = new Date(data.dueDate);
        const duration = parseInt(data.durationInMins);

        if (due <= start) {
            showToast('Thời gian kết thúc phải sau thời gian bắt đầu!', 'error');
            return;
        }

        const windowMins = (due - start) / (1000 * 60);
        if (duration > windowMins) {
            showToast(`Thời gian làm bài (${duration} phút) không được vượt quá khoảng thời gian mở đề (${Math.floor(windowMins)} phút)!`, 'error');
            return;
        }

        try {
            await apiClient.post('/api/teacher/quiz-assigning', data);
            bootstrap.Modal.getInstance(document.getElementById('assignModal')).hide();
            showToast('Giao đề thi thành công!', 'ok');
        } catch (err) {
            if (!err.__handled) {
                showToast(err.message || 'Lỗi khi giao đề thi. Hãy thử lại!', 'error');
            }
        }
    } catch (unexpectedErr) {
        console.error("Unexpected error in confirmAssign:", unexpectedErr);
        showToast("Đã xảy ra lỗi không xác định trên trình duyệt.", "error");
    }
}
