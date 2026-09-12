let page = 0;
let size = 10;
let lastTotalElements = 0;
let selectedQuestionId = null;
let publicCategories = [];
let selectedIds = [];
let isSelectAllResults = false;
let isBulkMode = false;
let allPrivateCategories = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchCategories();
    fetchCategoriesForFilter();
    fetchPendingQuestions();
});

async function fetchCategories() {
    try {
        const res = await fetch('/api/admin/categories');
        if (res.ok) {
            window.publicCategories = await res.json();
        }
    } catch (err) {
        console.error(err);
    }
}

/**
 * Load danh mục giáo viên (private) vào dropdown filter.
 * Câu hỏi chờ duyệt chỉ đến từ danh mục của giáo viên nên
 * không cần hiển thị danh mục hệ thống (public).
 * Hiển thị fullPath (ví dụ: "Mạng Máy Tính > Chương 1") để phân biệt
 * các danh mục trùng tên ở các môn khác nhau.
 */
async function fetchCategoriesForFilter() {
    try {
        const res = await fetch('/api/admin/categories/all-flat');
        if (!res.ok) return;
        const categories = await res.json();
        allPrivateCategories = categories.filter(c => !c.isPublic && c.creatorRole === 'TEACHER');
    } catch (err) {
        console.error('Không thể tải danh sách danh mục:', err);
    }
}

window.filterCustomCategory = function(keyword) {
    const dropdown = document.getElementById('custom-category-dropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    const kw = keyword.toLowerCase().trim();
    
    const creatorFilter = document.getElementById('filter-creator').value.toLowerCase().trim();
    
    // Always add "Tất cả"
    const allOpt = document.createElement('li');
    allOpt.innerHTML = `<a class="dropdown-item fw-bold text-primary" href="javascript:void(0)" onclick="selectCustomCategory('', 'Tất cả danh mục')"><i class="bi bi-globe-americas me-2"></i>Tất cả danh mục</a>`;
    dropdown.appendChild(allOpt);
    
    let filtered = allPrivateCategories;
    
    // Lọc theo Tên Giáo Viên nếu admin có nhập
    if (creatorFilter) {
        filtered = filtered.filter(c => c.creatorName && c.creatorName.toLowerCase().includes(creatorFilter));
    }
    
    // Lọc theo Từ khóa danh mục
    if (kw) {
        filtered = filtered.filter(c => c.name.toLowerCase().includes(kw) || (c.fullPath && c.fullPath.toLowerCase().includes(kw)));
    }
    
    // Only show top 30 to keep it manageable and fast
    const top30 = filtered.slice(0, 30);
    
    if (top30.length === 0) {
        const li = document.createElement('li');
        li.innerHTML = `<span class="dropdown-item text-muted disabled">Không tìm thấy kết quả</span>`;
        dropdown.appendChild(li);
    } else {
        top30.forEach(c => {
            const li = document.createElement('li');
            const pathDisplay = c.fullPath && c.fullPath !== c.name ? c.fullPath : c.name;
            const creatorDisplay = c.creatorName ? ` <small class="text-muted ms-1">(${c.creatorName})</small>` : '';
            const titleDisplay = `${pathDisplay} ${c.creatorName ? '(' + c.creatorName + ')' : ''}`;
            
            li.innerHTML = `<a class="dropdown-item text-truncate" title="${escapeHTML(titleDisplay)}" href="javascript:void(0)" onclick="selectCustomCategory(${c.id}, '${escapeJS(pathDisplay)}')">
                <i class="bi bi-folder2 me-2 text-warning"></i>${escapeHTML(pathDisplay)}${creatorDisplay}
            </a>`;
            dropdown.appendChild(li);
        });
    }
    
    dropdown.classList.add('show');
};

window.selectCustomCategory = function(id, name) {
    document.getElementById('filter-category').value = id;
    const input = document.getElementById('filter-category-input');
    input.value = id ? name : '';
    
    // Hide the dropdown
    const dropdown = document.getElementById('custom-category-dropdown');
    if (dropdown) dropdown.classList.remove('show');
    
    page = 0;
    fetchPendingQuestions();
};

document.addEventListener('click', function(e) {
    const input = document.getElementById('filter-category-input');
    const dropdown = document.getElementById('custom-category-dropdown');
    if (input && dropdown) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    }
});


async function fetchPendingQuestions() {
    const container = document.getElementById('questions-container');
    container.innerHTML = `
        <div class="text-center my-5 py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="text-muted mt-2">Đang tải danh sách câu hỏi chờ duyệt...</p>
        </div>`;

    const keyword = document.getElementById('filter-keyword').value;
    const creator = document.getElementById('filter-creator').value;
    const type = document.getElementById('filter-type').value;
    const level = document.getElementById('filter-level').value;
    const categoryId = document.getElementById('filter-category').value;

    let url = `/api/admin/questions/pending?page=${page}&size=${size}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    if (creator) url += `&creatorName=${encodeURIComponent(creator)}`;
    if (type) url += `&type=${type}`;
    if (level) url += `&level=${level}`;
    if (categoryId) url += `&categoryId=${categoryId}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Không thể lấy danh sách câu hỏi');

        const data = await res.json();
        lastTotalElements = data.totalElements;
        // selectedIds = []; // Removed to persist selection
        renderQuestions(data.content);
        renderPagination(data);
        updateBulkUI();
    } catch (err) {
        showToast(err.message, 'error');
        container.innerHTML = `
            <div class="text-center my-5 py-5 text-danger">
                <i class="bi bi-exclamation-triangle-fill fs-2"></i>
                <h5 class="mt-2">Đã có lỗi xảy ra</h5>
                <p class="text-muted">${err.message}</p>
            </div>`;
    }
}


function renderQuestions(items) {
    const container = document.getElementById('questions-container');
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-inbox fs-1 text-muted"></i>
                <h5 class="mt-2 text-secondary fw-bold">Kho trống</h5>
                <p class="text-muted mb-0">Không có câu hỏi nào đang chờ duyệt.</p>
            </div>`;
        document.getElementById('pagination-shell').style.display = 'none';
        return;
    }

    container.innerHTML = items.map(q => {
        let typeLabel = q.type === 'SINGLE_CHOICE' ? 'Một đáp án' : (q.type === 'MULTIPLE_CHOICE' ? 'Nhiều đáp án' : 'Điền khuyết');
        let levelLabel = q.level === 'EASY' ? 'Dễ' : (q.level === 'MEDIUM' ? 'Trung bình' : 'Khó');

        let answersHtml = '';
        if (q.answers && q.answers.length > 0) {
            answersHtml = `
                <div class="ans-preview mt-2">
                    ${q.answers.map((a, idx) => `
                        <div class="ans-item ${a.isCorrect ? 'correct' : ''}">
                            <i class="bi bi-${a.isCorrect ? 'check-circle-fill' : 'circle'}"></i>
                            <span>${String.fromCharCode(65 + idx)}. ${escapeHTML(a.text)}</span>
                        </div>
                    `).join('')}
                </div>`;
        }

        const isChecked = isSelectAllResults || selectedIds.includes(q.id);
        return `
            <div class="question-card ${isChecked ? 'selected' : ''}" id="q-card-${q.id}">
                <div class="d-flex align-items-start">
                    <div class="q-selection-box mt-1">
                        <input class="form-check-input q-checkbox" type="checkbox" value="${q.id}" ${isChecked ? 'checked' : ''} onchange="toggleQuestionSelection(${q.id}, this)">
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="badge-row">
                                <span class="q-badge q-badge-type"><i class="bi bi-patch-check"></i> ${typeLabel}</span>
                                <span class="q-badge q-badge-level"><i class="bi bi-graph-up"></i> ${levelLabel}</span>
                                <span class="q-badge q-badge-status-pending"><i class="bi bi-clock-fill"></i> Đang chờ duyệt</span>
                            </div>
                            <div class="text-muted small d-flex flex-column align-items-end">
                                <div>Người gửi: <strong>${escapeHTML(q.creatorName || 'N/A')}</strong></div>
                                <div>Danh mục gốc: <strong class="text-primary">${escapeHTML(q.categoryName || 'Chưa phân mục')}</strong></div>
                            </div>
                        </div>
                        <div class="q-text" onclick="this.parentElement.parentElement.querySelector('.q-checkbox').click()">${escapeHTML(q.text)}</div>
                        ${answersHtml}
                        <div class="card-actions">
                            <button class="btn-act-premium btn-act-approve" onclick="openApproveModal(${q.id})">
                                <i class="bi bi-check-circle-fill"></i> Duyệt
                            </button>
                            <button class="btn-act-premium btn-act-reject" onclick="rejectQuestion(${q.id})">
                                <i class="bi bi-x-circle-fill"></i> Từ chối
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
    document.getElementById('pagination-shell').style.display = 'flex';
}

function renderPagination(data) {
    const shell = document.getElementById('pagination-shell');
    if (data.totalElements === 0) {
        shell.style.display = 'none';
        return;
    }
    shell.style.display = 'flex';
    document.getElementById('pagination-info').innerText = `Hiển thị ${data.numberOfElements} trong tổng số ${data.totalElements} câu hỏi`;

    let paginationHtml = '';
    // Previous btn
    paginationHtml += `<button class="page-btn" ${data.first ? 'disabled' : ''} onclick="changePage(${page - 1})"><i class="bi bi-chevron-left"></i></button>`;

    // Pages numbers
    for (let i = 0; i < data.totalPages; i++) {
        if (data.totalPages > 6) {
            if (i === 0 || i === data.totalPages - 1 || (i >= page - 1 && i <= page + 1)) {
                paginationHtml += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="changePage(${i})">${i + 1}</button>`;
            } else if (i === 1 || i === data.totalPages - 2) {
                paginationHtml += `<button class="page-btn" disabled>...</button>`;
            }
        } else {
            paginationHtml += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="changePage(${i})">${i + 1}</button>`;
        }
    }

    // Next btn
    paginationHtml += `<button class="page-btn" ${data.last ? 'disabled' : ''} onclick="changePage(${page + 1})"><i class="bi bi-chevron-right"></i></button>`;

    document.getElementById('pagination-list').innerHTML = paginationHtml;
}

function changePage(p) {
    page = p;
    fetchPendingQuestions();
}

let debounceTimer;
function debounceFetch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        page = 0;
        fetchPendingQuestions();
    }, 500);
}

window.onCreatorFilterChange = function() {
    // Xóa danh mục đang chọn vì danh mục đó có thể không phải của giáo viên mới tìm
    document.getElementById('filter-category').value = '';
    const catInput = document.getElementById('filter-category-input');
    if (catInput) catInput.value = '';
    
    debounceFetch();
};

function resetFilters() {
    document.getElementById('filter-keyword').value = '';
    document.getElementById('filter-creator').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-level').value = '';
    document.getElementById('filter-category').value = '';
    
    const catInput = document.getElementById('filter-category-input');
    if (catInput) catInput.value = '';
    
    page = 0;
    fetchPendingQuestions();
}

function toggleQuestionSelection(id, checkbox) {
    if (isSelectAllResults && !checkbox.checked) {
        isSelectAllResults = false;
        selectedIds = Array.from(document.querySelectorAll('.q-checkbox:checked')).map(cb => parseInt(cb.value));
    } else if (checkbox.checked) {
        if (!selectedIds.includes(id)) selectedIds.push(id);
    } else {
        selectedIds = selectedIds.filter(item => item !== id);
    }
    updateBulkUI();
}

function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.q-checkbox');
    
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        const id = parseInt(cb.value);
        const card = document.getElementById(`q-card-${id}`);
        if (checkbox.checked) {
            if (!selectedIds.includes(id)) selectedIds.push(id);
        } else {
            selectedIds = selectedIds.filter(sid => sid !== id);
        }
    });
    updateBulkUI();
}

function selectAllResults() {
    isSelectAllResults = true;
    document.getElementById('select-all-all-area').innerHTML = `<i class="bi bi-check-circle-fill text-success me-1"></i> Đã chọn tất cả <b>${lastTotalElements}</b> câu hỏi. <a href="javascript:void(0)" onclick="clearSelection()" class="text-danger ms-2">Bỏ chọn</a>`;
    selectedIds = [];
    updateBulkUI();
}

function updateBulkUI() {
    const bar = document.getElementById('bulk-selection-bar');
    const countBadge = document.getElementById('selected-count-badge');
    const checkboxes = document.querySelectorAll('.q-checkbox');
    const totalOnPage = checkboxes.length;
    const allCheckedOnPage = totalOnPage > 0 && Array.from(checkboxes).every(cb => cb.checked);

    // Sync header checkbox
    const headerCB = document.getElementById('selectAllQuestions');
    if (headerCB) headerCB.checked = allCheckedOnPage || isSelectAllResults;

    const count = isSelectAllResults ? lastTotalElements : selectedIds.length;
    countBadge.innerText = `${count} đã chọn`;

    // Sync banner
    const area = document.getElementById('select-all-all-area');
    if (isSelectAllResults) {
        area.innerHTML = `<i class="bi bi-check-circle-fill text-success me-1"></i> Đã chọn tất cả <b>${lastTotalElements}</b> câu hỏi. <a href="javascript:void(0)" onclick="clearSelection()" class="text-danger ms-2">Bỏ chọn</a>`;
        area.style.display = 'block';
    } else if (count > 0 && lastTotalElements > totalOnPage) {
        area.innerHTML = `Bạn đã chọn <b>${count}</b> câu hỏi. <a href="javascript:void(0)" onclick="selectAllResults()" class="fw-bold text-decoration-underline ms-1">Chọn tất cả ${lastTotalElements} câu hỏi?</a>`;
        area.style.display = 'block';
    } else {
        area.style.display = 'none';
    }

    if (count > 0) {
        bar.classList.add('active');
    } else {
        bar.classList.remove('active');
    }

    document.querySelectorAll('.question-card').forEach(card => {
        const cb = card.querySelector('.q-checkbox');
        if (isSelectAllResults) {
            if (cb) cb.checked = true;
            card.classList.add('selected');
        } else {
            const id = cb ? parseInt(cb.value) : null;
            if (id && selectedIds.includes(id)) {
                if (cb) cb.checked = true;
                card.classList.add('selected');
            } else {
                if (cb) cb.checked = false;
                card.classList.remove('selected');
            }
        }
    });
}

function clearSelection() {
    selectedIds = [];
    isSelectAllResults = false;
    document.getElementById('selectAllQuestions').checked = false;
    document.querySelectorAll('.q-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.question-card').forEach(card => card.classList.remove('selected'));
    document.getElementById('select-all-all-area').style.display = 'none';
    updateBulkUI();
}


function confirmBulkReject() {
    const count = isSelectAllResults ? lastTotalElements : selectedIds.length;
    if (count === 0) {
        showToast('Vui lòng chọn ít nhất một câu hỏi!', 'error');
        return;
    }

    const modalEl = document.getElementById('rejectModal');
    const msgEl = document.getElementById('rejectModalMsg');
    if (msgEl) msgEl.innerText = `Bạn có chắc chắn muốn từ chối ${count} câu hỏi đã chọn?`;
    
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    document.getElementById('btnConfirmReject').onclick = async function() {
        try {
            let url, options;
            if (isSelectAllResults) {
                const keyword = document.getElementById('filter-keyword').value;
                const creator = document.getElementById('filter-creator').value;
                const type = document.getElementById('filter-type').value;
                const level = document.getElementById('filter-level').value;
                const filterCategoryId = document.getElementById('filter-category').value;
                url = `/api/admin/questions/bulk-reject-all?`;
                if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
                if (creator) url += `&creatorName=${encodeURIComponent(creator)}`;
                if (type) url += `&type=${type}`;
                if (level) url += `&level=${level}`;
                if (filterCategoryId) url += `&filterCategoryId=${filterCategoryId}`;
                options = { method: 'PUT' };
            } else {
                url = '/api/admin/questions/bulk-reject';
                options = {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(selectedIds)
                };
            }

            const res = await fetch(url, options);

            if (res.ok) {
                showToast(`Đã từ chối ${count} câu hỏi thành công!`, 'success');
                modal.hide();
                clearSelection();
                fetchPendingQuestions();
            } else {
                showToast('Có lỗi xảy ra khi từ chối hàng loạt!', 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    };
    modal.show();
}

function openApproveModal(questionId) {
    selectedQuestionId = questionId;
    isBulkMode = false;
    openCategoryExplorer('moderation', 'public');
}

function openBulkApproveModal() {
    if (selectedIds.length === 0 && !isSelectAllResults) {
        showToast('Vui lòng chọn ít nhất một câu hỏi!', 'error');
        return;
    }
    isBulkMode = true;
    openCategoryExplorer('moderation', 'public');
}

window.handleCategorySelection = async function(categoryId, categoryName, target) {
    if (target !== 'moderation') return;
    
    if (!categoryId) {
        showToast('Vui lòng chọn một danh mục hệ thống!', 'error');
        return;
    }

    try {
        let url, options;
        if (isSelectAllResults) {
            const keyword = document.getElementById('filter-keyword').value;
            const creator = document.getElementById('filter-creator').value;
            const type = document.getElementById('filter-type').value;
            const level = document.getElementById('filter-level').value;
            const filterCategoryId = document.getElementById('filter-category').value;
            url = `/api/admin/questions/bulk-approve-all?categoryId=${categoryId}`;
            if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
            if (creator) url += `&creatorName=${encodeURIComponent(creator)}`;
            if (type) url += `&type=${type}`;
            if (level) url += `&level=${level}`;
            if (filterCategoryId) url += `&filterCategoryId=${filterCategoryId}`;
            options = { method: 'PUT' };
        } else if (isBulkMode) {
            url = `/api/admin/questions/bulk-approve?categoryId=${categoryId}`;
            options = {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedIds)
            };
        } else {
            url = `/api/admin/questions/${selectedQuestionId}/approve?categoryId=${categoryId}`;
            options = { method: 'PUT' };
        }

        const res = await fetch(url, options);

        if (res.ok) {
            const count = isSelectAllResults ? lastTotalElements : (isBulkMode ? selectedIds.length : 1);
            showToast(`Đã duyệt ${count} câu hỏi thành công!`, 'success');
            
            // Close the explorer modal
            const modalEl = document.getElementById('categoryExplorerPublicModal');
            if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
            
            clearSelection();
            fetchPendingQuestions();
        } else {
            showToast('Có lỗi xảy ra khi duyệt câu hỏi!', 'error');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
};

function rejectQuestion(questionId) {
    const modalEl = document.getElementById('rejectModal');
    const msgEl = document.getElementById('rejectModalMsg');
    if (msgEl) msgEl.innerText = 'Bạn có chắc chắn muốn từ chối câu hỏi này?';
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    document.getElementById('btnConfirmReject').onclick = async function() {
        try {
            const res = await fetch(`/api/admin/questions/${questionId}/reject`, {
                method: 'PUT'
            });

            if (res.ok) {
                showToast('Đã từ chối câu hỏi thành công!', 'success');
                modal.hide();
                fetchPendingQuestions();
            } else {
                showToast('Có lỗi xảy ra khi từ chối câu hỏi!', 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    };
    modal.show();
}




function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function escapeJS(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'");
}

function showToast(msg, type = 'ok') {
    if (type === 'err' || type === 'error') toast.error(msg);
    else if (type === 'warn' || type === 'warning') toast.warning(msg);
    else toast.success(msg);
}
