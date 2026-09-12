let allQuizzes = [];
let currentViewMode = localStorage.getItem('quizViewMode') || 'grid';

document.addEventListener('DOMContentLoaded', () => {
    loadQuizzes();
    fetchCategories();
    
    // Initialize view mode UI state
    setViewMode(currentViewMode, false);

    document.querySelectorAll('.flatpickr-datetime').forEach(el => {
        flatpickr(el, {
            enableTime: true,
            altInput: true,
            altFormat: "d/m/Y H:i",
            dateFormat: "Y-m-dTH:i",
            time_24hr: true,
            locale: "vn",
            allowInput: true,
            minDate: "today",
            static: true
        });
    });
});

function setViewMode(mode, shouldRender = true) {
    currentViewMode = mode;
    localStorage.setItem('quizViewMode', mode);

    const btnGrid = document.getElementById('btn-grid-view');
    const btnList = document.getElementById('btn-list-view');
    const wrapper = document.getElementById('quizzesWrapper');

    if (btnGrid && btnList) {
        if (mode === 'grid') {
            btnGrid.classList.add('active-toggle');
            btnGrid.classList.remove('text-muted');
            btnList.classList.remove('active-toggle');
            btnList.classList.add('text-muted');
            if (wrapper) wrapper.classList.remove('list-view-mode');
        } else {
            btnList.classList.add('active-toggle');
            btnList.classList.remove('text-muted');
            btnGrid.classList.remove('active-toggle');
            btnGrid.classList.add('text-muted');
            if (wrapper) wrapper.classList.add('list-view-mode');
        }
    }

    if (shouldRender) {
        filterQuizzes();
    }
}

async function fetchCategories() {
    try {
        window.myCategories = await apiClient.get('/api/teacher/categories/mine');
    } catch (e) {
        console.error('Failed to load categories', e);
    }
}

async function loadQuizzes() {
    const wrapper = document.getElementById('quizzesWrapper');
    try {
        allQuizzes = await apiClient.get('/api/teacher/quizzes/mine');
        filterQuizzes();
    } catch (e) {
        wrapper.innerHTML = `
            <div class="text-center py-5" style="grid-column:1/-1;">
                <i class="bi bi-wifi-off text-muted d-block mb-3" style="font-size: 2.8rem;"></i>
                <h5 class="text-muted fw-bold">Không thể tải đề thi</h5>
                <p class="text-muted small">${e.message || 'Lỗi tải danh sách đề thi'}</p>
            </div>`;
    }
}

function filterQuizzes() {
    const search = document.getElementById('searchInput').value.trim().toLowerCase();
    const categoryId = document.getElementById('filter-category').value;

    // Get all descendant category IDs for recursive filtering
    let targetCategoryIds = [];
    if (categoryId) {
        targetCategoryIds = [parseInt(categoryId)];
        const descendants = getDescendantIds(window.myCategories || [], parseInt(categoryId));
        targetCategoryIds = targetCategoryIds.concat(descendants);
    }

    const filtered = allQuizzes.filter(q => {
        const matchSearch = !search || (q.title && q.title.toLowerCase().includes(search));
        const matchCategory = !categoryId || targetCategoryIds.includes(q.categoryId);
        return matchSearch && matchCategory;
    });

    // Sorting logic
    const sortVal = document.getElementById('sortSelect') ? document.getElementById('sortSelect').value : 'newest';
    filtered.sort((a, b) => {
        if (sortVal === 'newest') {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
        } else if (sortVal === 'oldest') {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeA - timeB;
        } else if (sortVal === 'name-asc') {
            const titleA = a.title ? a.title.toLowerCase() : '';
            const titleB = b.title ? b.title.toLowerCase() : '';
            return titleA.localeCompare(titleB, 'vi');
        } else if (sortVal === 'name-desc') {
            const titleA = a.title ? a.title.toLowerCase() : '';
            const titleB = b.title ? b.title.toLowerCase() : '';
            return titleB.localeCompare(titleA, 'vi');
        } else if (sortVal === 'questions-desc') {
            return (b.questionCount || 0) - (a.questionCount || 0);
        } else if (sortVal === 'questions-asc') {
            return (a.questionCount || 0) - (b.questionCount || 0);
        }
        return 0;
    });

    renderQuizzes(filtered);
}

// Helper to find all children IDs recursively
function getDescendantIds(nodes, parentId) {
    let ids = [];
    for (const node of nodes) {
        if (node.id === parentId) {
            collectChildIds(node.children || [], ids);
            return ids;
        }
        if (node.children) {
            const found = getDescendantIds(node.children, parentId);
            if (found.length > 0) return found;
        }
    }
    return ids;
}

function collectChildIds(children, ids) {
    for (const child of children) {
        ids.push(child.id);
        if (child.children) collectChildIds(child.children, ids);
    }
}

function clearCategoryFilter() {
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-category-display').value = 'Tất cả danh mục';
    document.getElementById('clear-cat-btn').style.display = 'none';
    filterQuizzes();
}

// Global callback for category selection
window.triggerSearch = function () {
    const catId = document.getElementById('filter-category').value;
    document.getElementById('clear-cat-btn').style.display = catId ? 'inline-block' : 'none';
    filterQuizzes();
};

function renderQuizzes(list) {
    const wrapper = document.getElementById('quizzesWrapper');
    if (!list || list.length === 0) {
        wrapper.innerHTML = `
            <div class="text-center py-5" style="grid-column: 1/-1;">
                <i class="bi bi-file-earmark-x text-muted d-block mb-3" style="font-size: 3rem; color: #cbd5e1 !important;"></i>
                <h5 style="color:#475569; font-weight:700;">Không tìm thấy đề thi nào</h5>
                <p style="font-size:.85rem; color:#94a3b8; margin-bottom:0;">Vui lòng đổi bộ lọc hoặc soạn đề thi mới.</p>
            </div>`;
        return;
    }

    if (currentViewMode === 'grid') {
        wrapper.innerHTML = list.map(q => {
            const typeBadge = q.isExam
                ? `<span class="qbadge qbadge-exam"><i class="bi bi-mortarboard-fill"></i> Kiểm tra</span>`
                : `<span class="qbadge qbadge-quiz"><i class="bi bi-journal-check"></i> Luyện tập</span>`;

            const imgUrl = q.imageUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80';

            return `
            <div class="quiz-card">
                <img src="${imgUrl}" alt="Cover" class="quiz-cover-img" onerror="this.src='https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80'">
                <div class="quiz-badge-row">${typeBadge}</div>
                <h3 class="quiz-title" title="${esc(q.title)}">${esc(q.title) || '(Chưa có tiêu đề)'}</h3>
                <p class="quiz-desc" title="${esc(q.description)}">${esc(q.description) || '<span style="color:#cbd5e1; font-style:italic;">Chưa có mô tả.</span>'}</p>
                <div class="quiz-chips">
                    <span class="chip"><i class="bi bi-list-check text-success"></i> ${q.questionCount} câu</span>
                    <span class="chip"><i class="bi bi-folder text-primary"></i> ${esc(q.categoryName) || 'Kho chung'}</span>
                </div>
                <div class="quiz-actions">
                    <a class="qact qact-edit" href="/teacher/quizzes/${q.id}/edit" title="Sửa đề thi"><i class="bi bi-pencil-square"></i> Sửa</a>
                    <button class="qact qact-view" onclick="openPreviewModal('${q.id}', '${esc(q.title)}')" title="Xem chi tiết"><i class="bi bi-eye"></i> Xem</button>
                    <button class="qact qact-del" onclick="openDeleteModal('${q.id}')" title="Xóa đề thi"><i class="bi bi-trash3"></i> Xóa</button>
                    <button class="qact qact-assign" onclick="openAssignModal('${q.id}', '${esc(q.title)}')" title="Giao bài"><i class="bi bi-send-fill"></i> Giao</button>
                    <button class="qact qact-export" onclick="exportQuizToExcel('${q.id}', '${esc(q.title)}')" title="Xuất ra Excel"><i class="bi bi-file-earmark-excel"></i> Xuất</button>
                </div>
            </div>`;
        }).join('');
    } else {
        // Table layout for List View
        const tableHeader = `
            <div class="quiz-list-header d-none d-md-flex">
                <div class="col-title">Đề thi</div>
                <div class="col-type">Phân loại</div>
                <div class="col-questions">Số câu</div>
                <div class="col-category">Danh mục</div>
                <div class="col-date">Ngày tạo</div>
                <div class="col-actions">Thao tác</div>
            </div>
        `;

        const rows = list.map(q => {
            const typeBadge = q.isExam
                ? `<span class="qbadge qbadge-exam"><i class="bi bi-mortarboard-fill"></i> Kiểm tra</span>`
                : `<span class="qbadge qbadge-quiz"><i class="bi bi-journal-check"></i> Luyện tập</span>`;

            const imgUrl = q.imageUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80';
            
            let formattedDate = '---';
            if (q.createdAt) {
                try {
                    const date = new Date(q.createdAt);
                    formattedDate = date.toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                } catch (err) {}
            }

            return `
            <div class="quiz-list-row">
                <div class="col-title">
                    <img src="${imgUrl}" alt="Cover" class="quiz-row-img" onerror="this.src='https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80'">
                    <div class="quiz-row-info">
                        <div class="quiz-row-title" title="${esc(q.title)}">${esc(q.title) || '(Chưa có tiêu đề)'}</div>
                        <div class="quiz-row-desc text-muted" title="${esc(q.description)}">${esc(q.description) || 'Chưa có mô tả.'}</div>
                    </div>
                </div>
                <div class="col-type">
                    ${typeBadge}
                </div>
                <div class="col-questions">
                    <span class="quiz-row-text"><i class="bi bi-list-check text-success"></i> ${q.questionCount} câu</span>
                </div>
                <div class="col-category">
                    <span class="quiz-row-text"><i class="bi bi-folder text-primary"></i> ${esc(q.categoryName) || 'Kho chung'}</span>
                </div>
                <div class="col-date">
                    <span class="quiz-row-text text-muted">${formattedDate}</span>
                </div>
                <div class="col-actions">
                    <div class="quiz-row-actions">
                        <a class="qact-btn qact-btn-edit" href="/teacher/quizzes/${q.id}/edit" title="Sửa đề thi"><i class="bi bi-pencil-square"></i> Sửa</a>
                        <button class="qact-btn qact-btn-view" onclick="openPreviewModal('${q.id}', '${esc(q.title)}')" title="Xem chi tiết"><i class="bi bi-eye"></i> Xem</button>
                        <button class="qact-btn qact-btn-del" onclick="openDeleteModal('${q.id}')" title="Xóa đề thi"><i class="bi bi-trash3"></i> Xóa</button>
                        <button class="qact-btn qact-btn-assign" onclick="openAssignModal('${q.id}', '${esc(q.title)}')" title="Giao bài"><i class="bi bi-send-fill"></i> Giao bài</button>
                        <button class="qact-btn qact-btn-export" onclick="exportQuizToExcel('${q.id}', '${esc(q.title)}')" title="Xuất ra Excel"><i class="bi bi-file-earmark-excel"></i> Xuất Excel</button>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        wrapper.innerHTML = `<div class="quiz-list-table">${tableHeader}${rows}</div>`;
    }
}

function normalizeQuizTitle(title) {
    return title ? title.replace(/\(ban sao\)/gi, '(bản sao)') : title;
}



function openDeleteModal(id) {
    document.getElementById('delQuizId').value = id;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteModal')).show();
}

async function confirmDelete() {
    const id = document.getElementById('delQuizId').value;
    try {
        await apiClient.delete(`/api/teacher/quizzes/${id}`);
        bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
        showToast('Đã xóa đề thi thành công!', 'ok');
        loadQuizzes();
    } catch (e) {
        showToast(e.message || 'Lỗi khi xóa đề thi', 'err');
    }
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function showToast(msg, type = 'ok') {
    if (type === 'err' || type === 'error') toast.error(msg);
    else if (type === 'warn' || type === 'warning') toast.warning(msg);
    else toast.success(msg);
}

document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('classroomIdSelect');
    if (select) {
        select.addEventListener('change', async function () {
            const classId = this.value;
            const topicContainer = document.getElementById('topicDropdownContainer');
            const topicSelect = document.getElementById('assignTopicId');

            topicSelect.innerHTML = '<option value="" selected>-- Không chọn chủ đề --</option>';
            topicContainer.style.display = 'none';

            // Nếu đang chọn chế độ chỉ định học sinh, phải load lại danh sách học sinh
            const customTargetRadio = document.getElementById('assignTargetCustomQZ');
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
        });
    }
});

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

async function openAssignModal(id, title) {
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

async function openPreviewModal(id, title) {
    document.getElementById('preview-quiz-title').textContent = title;
    document.getElementById('preview-quiz-desc').textContent = 'Đang tải thông tin đề thi...';
    document.getElementById('preview-quiz-count').textContent = '0';
    document.getElementById('preview-quiz-questions').innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>`;

    bootstrap.Modal.getOrCreateInstance(document.getElementById('previewQuizModal')).show();

    try {
        const quiz = await apiClient.get(`/api/teacher/quizzes/${id}`);
        document.getElementById('preview-quiz-title').textContent = quiz.title || '(Chưa có tiêu đề)';
        document.getElementById('preview-quiz-desc').textContent = quiz.description || 'Chưa có mô tả.';
        document.getElementById('preview-quiz-count').textContent = quiz.questions ? quiz.questions.length : 0;

        if (!quiz.questions || quiz.questions.length === 0) {
            document.getElementById('preview-quiz-questions').innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-file-earmark-x d-block mb-2" style="font-size: 2rem;"></i>
                    Đề thi này chưa có câu hỏi nào.
                </div>`;
            return;
        }

        document.getElementById('preview-quiz-questions').innerHTML = quiz.questions.map((q, idx) => {
            const levelClass = q.level === 'EASY' 
                ? 'modal-q-badge-easy'
                : q.level === 'MEDIUM'
                ? 'modal-q-badge-medium'
                : 'modal-q-badge-hard';
            
            const levelLabel = q.level === 'EASY' ? 'Dễ' : q.level === 'MEDIUM' ? 'Trung bình' : 'Khó';
            const levelBadge = `<span class="modal-q-badge ${levelClass}">${levelLabel}</span>`;

            const typeLabel = q.type === 'SINGLE_CHOICE'
                ? 'Trắc nghiệm 1 đáp án'
                : q.type === 'MULTIPLE_CHOICE'
                ? 'Trắc nghiệm nhiều đáp án'
                : 'Điền khuyết';

            const answersHtml = q.answers && q.answers.length > 0
                ? `<div class="mt-3 d-flex flex-column gap-2">
                    ${q.answers.map((ans, i) => {
                        const correctClass = ans.isCorrect ? 'correct' : 'incorrect';
                        const checkIcon = ans.isCorrect ? '<i class="bi bi-check-circle-fill modal-ans-icon"></i>' : '';
                        return `<div class="modal-ans-row ${correctClass}">
                            <span class="ans-letter">${String.fromCharCode(65 + i)}.</span>
                            <span>${esc(ans.text)}</span>
                            ${checkIcon}
                        </div>`;
                    }).join('')}
                   </div>`
                : '';

            return `
            <div class="modal-q-card mb-3">
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <span class="fw-bold" style="font-size: 0.82rem; color: #4338ca;">Câu hỏi ${idx + 1} (${typeLabel})</span>
                    ${levelBadge}
                </div>
                <div class="fw-bold text-dark mb-2" style="font-size: 0.98rem; line-height: 1.5;">${esc(q.text)}</div>
                ${answersHtml}
            </div>`;
        }).join('');

    } catch (e) {
        document.getElementById('preview-quiz-desc').textContent = 'Có lỗi xảy ra khi tải dữ liệu.';
        document.getElementById('preview-quiz-questions').innerHTML = `
            <div class="text-center py-4 text-danger">
                <i class="bi bi-exclamation-circle-fill d-block mb-2" style="font-size: 2rem;"></i>
                Không thể tải câu hỏi của đề thi. Vui lòng thử lại!
            </div>`;
    }
}

// Global Category Selection Callback
window.handleCategorySelection = function(id, name, currentTarget) {
    if (currentTarget === 'filter') {
        const idInput = document.getElementById('filter-category');
        const nameInput = document.getElementById('filter-category-display');
        if (idInput) idInput.value = (id === null || id === -1) ? '' : id;
        if (nameInput) {
            nameInput.value = (id === null || id === -1) ? 'Tất cả danh mục' : name;
        }
        const clearBtn = document.getElementById('clear-cat-btn');
        if (clearBtn) clearBtn.style.display = (id === -1 || id === null || !id) ? 'none' : 'inline-block';
        filterQuizzes();
    }
};

// ─── Export Quiz to Excel ───────────────────────────────────────────────────
async function exportQuizToExcel(quizId, quizTitle) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    try {
        showToast('Đang xuất file Excel...', 'ok');

        const response = await fetch(`/api/teacher/quizzes/${quizId}/export-excel`, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Không thể xuất file Excel');
        }

        // Lấy tên file từ header Content-Disposition, fallback về tên quiz
        let filename = (quizTitle ? quizTitle.trim() : 'de_thi') + '.xlsx';
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.includes('filename=')) {
            const parts = disposition.split('filename=');
            if (parts[1]) {
                filename = parts[1].replace(/['"]/g, '').trim();
            }
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(`✅ Đã xuất file "${filename}" thành công!`, 'ok');
    } catch (e) {
        showToast(e.message || 'Lỗi khi xuất file Excel', 'err');
    }
}
