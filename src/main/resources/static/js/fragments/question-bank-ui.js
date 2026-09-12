(function() {
    // Configuration Binding via Global Config
    const USER_TYPE = (window.QUESTION_BANK_CONFIG && window.QUESTION_BANK_CONFIG.userType) 
        ? window.QUESTION_BANK_CONFIG.userType 
        : 'teacher';
    const PUBLIC_BANK_ENABLED = (window.QUESTION_BANK_CONFIG && typeof window.QUESTION_BANK_CONFIG.publicBankEnabled !== 'undefined') 
        ? window.QUESTION_BANK_CONFIG.publicBankEnabled 
        : false;
    const BASE_API = (window.QUESTION_BANK_CONFIG && window.QUESTION_BANK_CONFIG.baseApi) 
        ? window.QUESTION_BANK_CONFIG.baseApi 
        : ('/api/' + USER_TYPE + '/questions');

    // Local State Variables
    let currentTab = 'mine';
    let page = 0, size = 50, sortBy = 'id', sortDir = 'desc';
    let lastTotalElements = 0;
    let selectedIds = [], isSelectAllResults = false;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    // --- Helper Functions ---
    function escapeHTML(str) {
        if (!str) return "";
        return String(str).replace(/[&<>"']/g, function(s) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s];
        });
    }
    function escapeJS(str) {
        if (!str) return "";
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }


    // --- Expose functions to global window context for direct HTML event bindings ---
    
    window.categorySelectTarget = 'filter';

    // Using unified openCategoryExplorer from shared scripts
    window.openModalCategorySelector = function() { 
        const source = (currentTab === 'public') ? 'public' : 'private';
        if (typeof openCategoryExplorer === 'function') {
            openCategoryExplorer('filter', source); 
        }
    };

    window.clearCategorySelection = function() {
        const catIn = document.getElementById('filter-category');
        const dispIn = document.getElementById('filter-category-display');
        const btn = document.getElementById('clear-cat-btn');
        if (catIn) catIn.value = '';
        if (dispIn) dispIn.value = '';
        if (btn) btn.style.display = 'none';
        window.triggerSearch();
    };

    window.clearQuestionCategorySelection = function() {
        const qCat = document.getElementById('q-category');
        const qCatDisp = document.getElementById('q-category-display');
        const clearBtn = document.getElementById('clear-q-cat-btn');
        if (qCat) qCat.value = '';
        if (qCatDisp) qCatDisp.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
    };

    // --- Fetching & Rendering ---
    window.switchTab = function(tab) {
        if (currentTab === tab) return;
        currentTab = tab;
        document.querySelectorAll('.tab-item').forEach(function(el) { el.classList.remove('active'); });
        var tabEl = document.getElementById('tab-' + tab);
        if (tabEl) tabEl.classList.add('active');
        
        // Ẩn/Hiện động các nút hành động Thêm mới/Nhập Excel dựa trên tab hoạt động
        const excelGroup = document.getElementById('excel-import-container');
        const createBtn = document.getElementById('btn-create-question');
        const aiGenerateContainer = document.getElementById('ai-generate-container');
        
        if (tab === 'public') {
            if (excelGroup) excelGroup.style.setProperty('display', 'none', 'important');
            if (createBtn) createBtn.style.setProperty('display', 'none', 'important');
            if (aiGenerateContainer) aiGenerateContainer.style.setProperty('display', 'none', 'important');
        } else {
            if (excelGroup) excelGroup.style.setProperty('display', 'flex', 'important');
            if (createBtn) createBtn.style.setProperty('display', 'inline-flex', 'important');
            if (aiGenerateContainer) aiGenerateContainer.style.setProperty('display', 'block', 'important');
        }

        // Reset category filter when switching tabs to avoid ID mismatch
        const catIn = document.getElementById('filter-category');
        const dispIn = document.getElementById('filter-category-display');
        const btn = document.getElementById('clear-cat-btn');
        if (catIn) catIn.value = '';
        if (dispIn) dispIn.value = 'Tất cả danh mục';
        if (btn) btn.style.display = 'none';

        page = 0; 
        window.fetchQuestions();
    };

    window.triggerSearch = function() { 
        page = 0; 
        window.clearSelection(); 
        window.fetchQuestions(); 
    };

    window.fetchCategories = async function() {
        try {
            const baseUrl = '/api/' + USER_TYPE + '/categories';
            const [m, p] = await Promise.all([
                fetch(baseUrl + '/mine', { headers: { Authorization: 'Bearer ' + token } }),
                fetch(baseUrl + '/public', { headers: { Authorization: 'Bearer ' + token } })
            ]);
            if (m.ok) window.myCategories = await m.json();
            if (p.ok) window.publicCategories = await p.json();
        } catch (e) { console.error('Failed to refresh categories', e); }
    };

    window.fetchQuestions = async function() {
        var container = document.getElementById('questions-container');
        if (!container) return;

        container.innerHTML = '<div class="text-center my-5 py-5"><div class="spinner-border text-primary"></div><p class="text-muted mt-2">Đang tải...</p></div>';
        
        var kwIn = document.getElementById('filter-keyword');
        var catIn = document.getElementById('filter-category');
        var typeIn = document.getElementById('filter-type');
        var lvIn = document.getElementById('filter-level');

        var keyword = kwIn ? kwIn.value.trim() : '';
        var categoryId = catIn ? catIn.value : '';
        var type = typeIn ? typeIn.value : '';
        var level = lvIn ? lvIn.value : '';

        var url = BASE_API + '?isPublicTab=' + (currentTab === 'public') + '&page=' + page + '&size=' + size + '&sortBy=' + sortBy + '&sortDir=' + sortDir;
        if (keyword) url += '&keyword=' + encodeURIComponent(keyword);
        if (categoryId) url += '&categoryId=' + categoryId;
        if (type) url += '&type=' + type;
        if (level) url += '&level=' + level;

        try {
            var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) throw new Error('Lỗi tải danh sách');
            var data = await res.json();
            lastTotalElements = data.totalElements;
            renderQuestions(data.content);
            renderPagination(data);
            updateBulkUI();
        } catch (err) {
            showToast(err.message, 'error');
            container.innerHTML = '<div class="text-center my-5 py-5 text-danger"><h4 class="mt-2">Lỗi tải dữ liệu</h4><p>' + err.message + '</p></div>';
        }
    };

    function renderQuestions(items) {
        var container = document.getElementById('questions-container');
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="empty-block"><div class="empty-icon"><i class="bi bi-folder-x"></i></div><h3>Trống</h3><p>Không tìm thấy câu hỏi nào.</p></div>';
            return;
        }
        container.innerHTML = items.map(function(q) {
            var typeLbl = q.type === 'SINGLE_CHOICE' ? 'Một đáp án' : (q.type === 'MULTIPLE_CHOICE' ? 'Nhiều đáp án' : 'Điền khuyết');
            var levelLbl = q.level === 'EASY' ? 'Dễ' : (q.level === 'MEDIUM' ? 'Trung bình' : 'Khó');
            var isChecked = selectedIds.includes(q.id) || isSelectAllResults;

            var statusBadge = q.questionStatus === 'PRIVATE' ? '<span class="q-badge q-badge-status-private">Cá nhân</span>' : (q.questionStatus === 'PENDING' ? '<span class="q-badge q-badge-status-pending">Đang duyệt</span>' : '<span class="q-badge q-badge-status-public">Công khai</span>');

            return '<div class="question-card ' + (isChecked ? 'selected' : '') + '">' +
                    '<div class="card-top d-flex justify-content-between align-items-center">' +
                        '<div class="d-flex align-items-center gap-3">' +
                            (currentTab === 'mine' ? '<input class="form-check-input question-checkbox" type="checkbox" data-id="' + q.id + '" ' + (isChecked ? 'checked' : '') + ' onchange="toggleSelect(' + q.id + ', this)">' : '') +
                            '<div class="badge-row">' +
                                '<span class="q-badge q-badge-type">' + typeLbl + '</span>' +
                                '<span class="q-badge q-badge-level">' + levelLbl + '</span>' +
                                '<span class="q-badge q-badge-cat">' + (q.categoryName || 'Chưa phân mục') + '</span>' +
                                statusBadge +
                            '</div>' +
                        '</div>' +
                        '<div class="text-muted small">ID: #' + q.id + '</div>' +
                    '</div>' +
                    '<div class="q-text" onclick="this.parentElement.querySelector(\'.question-checkbox\')?.click()">' + escapeHTML(q.text) + '</div>' +
                    '<div class="ans-preview">' +
                        q.answers.map(function(a, idx) { return '<div class="ans-item ' + (a.isCorrect ? 'correct' : '') + '"><i class="bi bi-' + (a.isCorrect ? 'check-circle-fill' : 'circle') + '"></i> <span>' + String.fromCharCode(65 + idx) + '. ' + escapeHTML(a.text) + '</span></div>'; }).join('') +
                    '</div>' +
                    '<div class="card-actions">' +
                        (currentTab === 'mine' ? 
                            '<button class="btn-action btn-act-edit" onclick="viewDetail(' + q.id + ', true)"><i class="bi bi-pencil-square"></i> Sửa</button>' +
                            (USER_TYPE === 'teacher' && q.questionStatus === 'PRIVATE' ? '<button class="btn-action btn-act-share" onclick="requestShare(' + q.id + ')"><i class="bi bi-share-fill"></i> Chia sẻ</button>' : '') +
                            '<button class="btn-action btn-act-del" onclick="deleteQuestion(' + q.id + ')"><i class="bi bi-trash-fill"></i> Xóa</button>'
                         : '<button class="btn-action btn-act-edit" style="background:#f1f5f9; color:#475569;" onclick="viewDetail(' + q.id + ', false)"><i class="bi bi-eye-fill"></i> Chi tiết</button>') +
                    '</div>' +
                '</div>';
        }).join('');
    }

    function renderPagination(data) {
        var shell = document.getElementById('pagination-shell');
        if (!shell) return;
        if (!data || data.totalPages <= 1) { shell.style.setProperty('display', 'none', 'important'); return; }
        
        shell.style.setProperty('display', 'flex', 'important');
        
        var pagesHtml = '';
        var current = data.number;
        var total = data.totalPages;
        
        // Previous
        pagesHtml += `<div class="page-link-up ${data.first ? 'disabled' : ''}" onclick="${data.first ? '' : `goToPage(${current - 1})`}"><i class="bi bi-chevron-left"></i></div>`;
        
        // Pages
        var start = Math.max(0, current - 2);
        var end = Math.min(total - 1, start + 4);
        if (end - start < 4) start = Math.max(0, end - 4);
        
        for (var i = start; i <= end; i++) {
            pagesHtml += `<div class="page-link-up ${i === current ? 'active' : ''}" onclick="goToPage(${i})">${i + 1}</div>`;
        }
        
        // Next
        pagesHtml += `<div class="page-link-up ${data.last ? 'disabled' : ''}" onclick="${data.last ? '' : `goToPage(${current + 1})`}"><i class="bi bi-chevron-right"></i></div>`;

        shell.innerHTML = `
            <div class="text-muted small fw-bold">
                <span class="text-dark">Trang ${current + 1}</span> / ${total} 
                <span class="mx-2 text-slate-300">•</span> 
                ${data.totalElements} câu hỏi
            </div>
            <div class="d-flex gap-2">
                ${pagesHtml}
            </div>
        `;
    }
    window.goToPage = function(p) { page = p; window.fetchQuestions(); };

    // --- Selection Logic ---
    window.toggleSelectAll = function(el) {
        var cbs = document.querySelectorAll('.question-checkbox');
        cbs.forEach(function(cb) {
            cb.checked = el.checked;
            var id = parseInt(cb.dataset.id);
            if (el.checked) { if(!selectedIds.includes(id)) selectedIds.push(id); }
            else { selectedIds = selectedIds.filter(function(sid) { return sid !== id; }); }
        });
        updateBulkUI();
    };

    window.selectAllResults = function() {
        isSelectAllResults = true;
        updateBulkUI();
    };

    window.toggleSelect = function(id, el) {
        if (isSelectAllResults && !el.checked) {
            isSelectAllResults = false;
            selectedIds = Array.from(document.querySelectorAll('.question-checkbox:checked')).map(function(cb) { return parseInt(cb.dataset.id); });
        } else if (el.checked) { if(!selectedIds.includes(id)) selectedIds.push(id); }
        else { selectedIds = selectedIds.filter(function(sid) { return sid !== id; }); }
        updateBulkUI();
    };

    function updateBulkUI() {
        var cbs = document.querySelectorAll('.question-checkbox');
        var totalOnPage = cbs.length;
        var allCheckedOnPage = totalOnPage > 0 && Array.from(cbs).every(function(cb) { return cb.checked; });

        // Sync header checkbox
        var headerCB = document.getElementById('selectAllQuestions');
        if (headerCB) headerCB.checked = allCheckedOnPage || isSelectAllResults;

        var count = isSelectAllResults ? lastTotalElements : selectedIds.length;
        var countBadge = document.getElementById('selected-count-badge');
        if (countBadge) countBadge.innerText = count + ' đã chọn';

        // Sync banner (select-all-all-area)
        var area = document.getElementById('select-all-all-area');
        if (area) {
            if (isSelectAllResults) {
                area.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i> Đã chọn tất cả ' + lastTotalElements + '. <a href="javascript:void(0)" onclick="clearSelection()" class="text-danger ms-2">Hủy</a>';
                area.style.display = 'block';
            } else if (count > 0 && lastTotalElements > totalOnPage) {
                area.innerHTML = 'Đã chọn ' + count + '. <a href="javascript:void(0)" onclick="selectAllResults()" class="fw-bold">Chọn tất cả ' + lastTotalElements + '?</a>';
                area.style.display = 'block';
            } else {
                area.style.display = 'none';
            }
        }

        var bulkBar = document.getElementById('bulk-selection-bar');
        if (bulkBar) bulkBar.classList.toggle('active', count > 0 && currentTab === 'mine');

        document.querySelectorAll('.question-card').forEach(function(card) {
            var cb = card.querySelector('.question-checkbox');
            if (cb) {
                var isChecked = isSelectAllResults || selectedIds.includes(parseInt(cb.dataset.id));
                cb.checked = isChecked;
                card.classList.toggle('selected', isChecked);
            }
        });
    }

    window.clearSelection = function() { 
        selectedIds = []; 
        isSelectAllResults = false; 
        const selectAllCB = document.getElementById('selectAllQuestions');
        if (selectAllCB) selectAllCB.checked = false; 
        updateBulkUI(); 
    };

    // --- Individual Actions ---
    window.deleteQuestion = function(id) {
        const confirmMsg = document.getElementById('delete-confirm-msg');
        if (confirmMsg) confirmMsg.innerText = "Hành động này không thể hoàn tác.";
        
        var btn = document.getElementById('btnConfirmDelete');
        if (!btn) return;

        btn.onclick = async function() {
            try {
                var res = await fetch(BASE_API + '/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
                if(!res.ok) throw new Error('Xóa thất bại');
                showToast('Đã xóa thành công!');
                var mEl = document.getElementById('deleteConfirmModal');
                if (mEl) {
                    var m = bootstrap.Modal.getInstance(mEl);
                    if(m) m.hide();
                }
                window.fetchQuestions();
            } catch(e) { showToast(e.message, 'error'); }
        };
        
        const modalEl = document.getElementById('deleteConfirmModal');
        if (modalEl) {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    };

    window.requestShare = function(id) {
        if (USER_TYPE !== 'teacher') return;
        var btn = document.getElementById('btnConfirmShare');
        if (!btn) return;

        btn.onclick = async function() {
            try {
                var res = await fetch(BASE_API + '/' + id + '/share', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } });
                if(!res.ok) throw new Error('Chia sẻ thất bại');
                showToast('Gửi yêu cầu thành công!');
                var mEl = document.getElementById('shareConfirmModal');
                if (mEl) {
                    var m = bootstrap.Modal.getInstance(mEl);
                    if(m) m.hide();
                }
                window.fetchQuestions();
            } catch(e) { showToast(e.message, 'error'); }
        };

        const modalEl = document.getElementById('shareConfirmModal');
        if (modalEl) {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    };

    window.viewDetail = async function(id, canEdit) {
        try {
            const res = await fetch(BASE_API + '/' + id, { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) throw new Error('Không thể tải câu hỏi');
            const q = await res.json();
            if (canEdit) {
                if (typeof openQuestionEditor === 'function') {
                    openQuestionEditor(q);
                }
            } else {
                var detailBody = document.getElementById('detail-body');
                if (detailBody) {
                    detailBody.innerHTML = '<h5>' + escapeHTML(q.text) + '</h5><hr>' + q.answers.map(function(a) { return '<div class="p-2 mb-1 rounded ' + (a.isCorrect ? 'bg-success-subtle' : 'bg-light') + '">' + (a.isCorrect ? '<i class="bi bi-check-circle-fill text-success"></i> ' : '') + escapeHTML(a.text) + '</div>'; }).join('');
                }
                const modalEl = document.getElementById('viewDetailModal');
                if (modalEl) {
                    bootstrap.Modal.getOrCreateInstance(modalEl).show();
                }
            }
        } catch (e) { showToast('Lỗi tải chi tiết', 'error'); }
    };

    // --- Bulk Actions ---
    window.confirmBulkDelete = function() {
        var count = isSelectAllResults ? lastTotalElements : selectedIds.length;
        var confirmMsg = document.getElementById('delete-confirm-msg');
        if (confirmMsg) confirmMsg.innerText = 'Xác nhận xóa hàng loạt ' + count + ' câu hỏi?';
        
        var btn = document.getElementById('btnConfirmDelete');
        if (!btn) return;

        btn.onclick = async function() {
            try {
                var url = BASE_API + '/bulk-delete', body = JSON.stringify(selectedIds);
                if (isSelectAllResults) {
                    var kw = document.getElementById('filter-keyword').value;
                    var cat = document.getElementById('filter-category').value;
                    var type = document.getElementById('filter-type').value;
                    url = BASE_API + '/bulk-delete-all?isPublicTab=false';
                    if(kw) url += '&keyword=' + encodeURIComponent(kw);
                    if(cat) url += '&categoryId=' + cat;
                    if(type) url += '&type=' + type;
                    body = null;
                }
                var res = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: body });
                if(!res.ok) throw new Error('Xóa hàng loạt thất bại');
                showToast('Đã xóa ' + count + ' câu hỏi!');
                var mEl = document.getElementById('deleteConfirmModal');
                if (mEl) {
                    var m = bootstrap.Modal.getInstance(mEl);
                    if(m) m.hide();
                }
                window.clearSelection(); 
                window.fetchQuestions();
            } catch(e) { showToast(e.message, 'error'); }
        };

        var modalEl = document.getElementById('deleteConfirmModal');
        if (modalEl) {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    };

    window.confirmBulkShare = function() {
        var count = isSelectAllResults ? lastTotalElements : selectedIds.length;
        if (count === 0) return;
        
        var countEl = document.getElementById('bulk-share-count');
        if (countEl) countEl.innerText = count;
        
        const modalEl = document.getElementById('bulkShareConfirmModal');
        if (modalEl) {
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    };

    window.executeBulkShare = async function() {
        if (USER_TYPE !== 'teacher') return;
        var count = isSelectAllResults ? lastTotalElements : selectedIds.length;
        try {
            var url = BASE_API + '/bulk-share', body = JSON.stringify(selectedIds);
            if (isSelectAllResults) {
                var kw = document.getElementById('filter-keyword').value;
                var cat = document.getElementById('filter-category').value;
                var type = document.getElementById('filter-type').value;
                url = BASE_API + '/bulk-share-all?isPublicTab=false';
                if(kw) url += '&keyword=' + encodeURIComponent(kw);
                if(cat) url += '&categoryId=' + cat;
                if(type) url += '&type=' + type;
                body = null;
            }
            var res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: body });
            if(!res.ok) throw new Error('Chia sẻ thất bại');
            showToast('Đã gửi yêu cầu chia sẻ!');
            var mEl = document.getElementById('bulkShareConfirmModal');
            if (mEl) {
                var m = bootstrap.Modal.getInstance(mEl);
                if(m) m.hide();
            }
            window.clearSelection(); 
            window.fetchQuestions();
        } catch(e) { showToast(e.message, 'error'); }
    };

    // --- Form Management ---
    window.showCreateModal = function() {
        if (typeof openQuestionEditor === 'function') {
            openQuestionEditor();
        }
    };

    window.handleExcelImport = async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Chặn trước trên UI nếu cố tình nhập khi ở Tab hệ thống
        if (currentTab === 'public') {
            showToast('Bạn không thể nhập Excel trực tiếp vào kho chung hệ thống!', 'error');
            event.target.value = '';
            return;
        }

        // Reset input value to allow re-importing the same file
        event.target.value = '';

        const catIn = document.getElementById('filter-category');
        const categoryId = catIn ? catIn.value : '';

        const formData = new FormData();
        formData.append('file', file);
        if (categoryId) formData.append('categoryId', categoryId);

        showToast('Đang xử lý file Excel...', 'success');

        try {
            const response = await fetch(BASE_API + '/import', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData
            });

            if (!response.ok) throw new Error('Import thất bại.');

            const result = await response.json();
            const success = result.successCount || 0;
            const error = result.errorCount || 0;

            if (error === 0) {
                showToast(`Thành công! Đã nhập ${success} câu hỏi.`, 'success');
            } else {
                showToast(`Hoàn tất! ${success} thành công, ${error} dòng lỗi.`, 'error');
                console.error('Excel Import Errors:', result.errors);
                if (result.errors && result.errors.length > 0) {
                    showToast('Chi tiết lỗi nhập file:\n' + result.errors.slice(0, 5).join('\n') + (result.errors.length > 5 ? '\n...' : ''), 'error');
                }
            }
            window.fetchQuestions(); // Reload list
        } catch (e) {
            showToast('Lỗi hệ thống khi nhập file: ' + e.message, 'error');
        }
    };

    // --- Initializer ---
    document.addEventListener('DOMContentLoaded', function() {
        // Only init if we are on a page that contains the question bank UI
        if (document.getElementById('questions-container')) {
            window.fetchQuestions();
            window.fetchCategories();
            
            // Dest Badge Sync Engine
            setInterval(function() {
                const badge = document.getElementById('q-import-dest-badge');
                if (!badge) return;
                const input = document.getElementById('filter-category-display');
                const currentVal = input ? input.value : '';
                const name = (currentVal && currentVal !== 'Tất cả danh mục') ? currentVal : 'Mặc định';
                const expectedHtml = `<i class="bi bi-box-arrow-in-down me-1"></i>Lưu vào: ${name}`;
                if (badge.innerHTML !== expectedHtml) {
                    badge.innerHTML = expectedHtml;
                    badge.title = "Lưu vào: " + name; // Hover tooltip for long category names
                }
            }, 600);
        }
    });
})();

function showToast(msg, type = 'ok') {
    if (type === 'err' || type === 'error') toast.error(msg);
    else if (type === 'warn' || type === 'warning') toast.warning(msg);
    else toast.success(msg);
}
