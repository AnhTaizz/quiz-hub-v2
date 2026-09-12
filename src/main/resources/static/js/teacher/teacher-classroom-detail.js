(function () {
    // --- Configurations ---
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const getClassroomId = () => window.CLASSROOM_ID || 0;

    // --- Common Utilities ---
    function escapeJS(str) {
        if (!str) return "";
        return str.replace(/'/g, "\\'");
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g,
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
    const esc = escapeHTML;

    function showToast(msg, type = 'ok') {
        if (type === 'err' || type === 'error') toast.error(msg);
        else if (type === 'warn' || type === 'warning') toast.warning(msg);
        else toast.success(msg);
    }

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

    function getAllChildIds(catId, categories) {
        let ids = [parseInt(catId)];
        const findAndAdd = (list) => {
            for (let cat of list) {
                if (cat.id == catId) {
                    const addChildren = (children) => {
                        for (let child of children) {
                            ids.push(child.id);
                            if (child.children) addChildren(child.children);
                        }
                    };
                    if (cat.children) addChildren(cat.children);
                    return true;
                }
                if (cat.children && findAndAdd(cat.children)) return true;
            }
            return false;
        };
        findAndAdd(categories);
        return ids;
    }

    // --- Category & Assignment Management ---
    window.handleCategorySelection = function (id, name, target) {
        if (id === null) {
            document.getElementById('categoryFilterValue').value = '';
            document.getElementById('categoryFilterDisplay').value = 'Tất cả danh mục';
            const clearBtn = document.getElementById('clearCatBtn');
            if (clearBtn) clearBtn.style.display = 'none';
            window.filterQuizzesByCategory('');
            return;
        }

        if (id === -1) {
            document.getElementById('categoryFilterValue').value = -1;
            document.getElementById('categoryFilterDisplay').value = 'Chưa phân mục';
            const clearBtn = document.getElementById('clearCatBtn');
            if (clearBtn) clearBtn.style.display = 'inline-block';
            window.filterQuizzesByCategory(-1);
            return;
        }

        document.getElementById('categoryFilterValue').value = id;
        document.getElementById('categoryFilterDisplay').value = name;
        const clearBtn = document.getElementById('clearCatBtn');
        if (clearBtn) clearBtn.style.display = 'inline-block';

        window.filterQuizzesByCategory(id);
    };

    window.clearCategoryFilter = function () {
        document.getElementById('categoryFilterValue').value = '';
        document.getElementById('categoryFilterDisplay').value = '';
        const clearBtn = document.getElementById('clearCatBtn');
        if (clearBtn) clearBtn.style.display = 'none';
        window.filterQuizzesByCategory('');
    };

    window.filterQuizzesByCategory = function (catId) {
        const select = document.getElementById('quizSelect');
        if (!select) return;
        const options = select.querySelectorAll('option');

        select.value = "";

        if (catId === null || catId === undefined || catId === '') {
            options.forEach(opt => opt.style.display = 'block');
            return;
        }

        // Specialized handling for 'No category' (-1)
        if (catId === -1) {
            options.forEach(opt => {
                if (opt.value === "") {
                    opt.style.display = 'block';
                    return;
                }
                const optCatId = opt.getAttribute('data-category-id');
                if (!optCatId || optCatId.trim() === '') {
                    opt.style.display = 'block';
                } else {
                    opt.style.display = 'none';
                }
            });
            return;
        }

        // Get all child IDs recursively
        const listToCheck = [...(window.myCategories || []), ...(window.publicCategories || [])];
        const childIds = getAllChildIds(catId, listToCheck);

        options.forEach(opt => {
            if (opt.value === "") {
                opt.style.display = 'block';
                return;
            }
            const optCatIdStr = opt.getAttribute('data-category-id');
            if (!optCatIdStr || optCatIdStr.trim() === '') {
                opt.style.display = 'none';
                return;
            }

            const optCatId = parseInt(optCatIdStr);
            if (!isNaN(optCatId) && childIds.includes(optCatId)) {
                opt.style.display = 'block';
            } else {
                opt.style.display = 'none';
            }
        });
    };

    window.selectAllStudents = function(checked) {
        const checkboxes = document.querySelectorAll('#studentCheckboxesList .student-assign-cb');
        checkboxes.forEach(cb => {
            // Chỉ chọn những checkbox đang hiển thị (không bị filter ẩn đi)
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

    window.toggleStudentSelection = async function (show) {
        const container = document.getElementById('studentSelectionContainer');
        if (!container) return;
        
        if (show) {
            container.style.display = 'flex';
            const listEl = document.getElementById('studentCheckboxesList');
            if (listEl && listEl.children.length === 0) {
                listEl.innerHTML = '<div class="text-center py-2 text-muted small"><span class="spinner-border spinner-border-sm me-2"></span> Đang tải danh sách học sinh...</div>';
                try {
                    const classroomId = getClassroomId();
                    const res = await fetch(`/api/teacher/classrooms/${classroomId}/students`, {
                        headers: { Authorization: 'Bearer ' + token }
                    });
                    if (res.ok) {
                        const students = await res.json();
                        if (!students || students.length === 0) {
                            listEl.innerHTML = '<div class="text-center py-2 text-muted small text-danger"><i class="bi bi-exclamation-triangle me-1"></i> Lớp học chưa có học sinh nào!</div>';
                            return;
                        }
                        listEl.innerHTML = students.map(s => `
                            <div class="form-check mb-1">
                                <input class="form-check-input student-assign-cb" type="checkbox" value="${s.studentId}" id="cb_student_${s.studentId}">
                                <label class="form-check-label small fw-semibold text-dark cursor-pointer" for="cb_student_${s.studentId}">
                                    ${esc(s.fullName)} (${esc(s.email)})
                                </label>
                            </div>
                        `).join('');
                    } else {
                        listEl.innerHTML = '<div class="text-center py-2 text-muted small text-danger">Không thể tải học sinh.</div>';
                    }
                } catch (e) {
                    listEl.innerHTML = '<div class="text-center py-2 text-muted small text-danger">Lỗi kết nối.</div>';
                }
            }
        } else {
            container.style.display = 'none';
        }
    };

    window.submitAssignment = function () {
        const form = document.getElementById('assignQuizForm');
        if (!form) return;

        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            if (key === 'questionShuffled' || key === 'answerShuffled' || key === 'showAnswer') {
                data[key] = true;
            } else {
                data[key] = value;
            }
        });

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

        // Explicit validation checks to avoid silent HTML5 form validation blocking on hidden elements
        if (!data.classroomId) {
            showToast('Lỗi: Không tìm thấy thông tin lớp học!', 'error');
            return;
        }
        if (!data.quizId) {
            showToast('Vui lòng chọn đề thi trong kho!', 'warning');
            return;
        }
        if (!data.durationInMins || parseInt(data.durationInMins) < 1) {
            showToast('Số phút làm bài không hợp lệ (tối thiểu là 1)!', 'warning');
            return;
        }
        if (!data.startDate) {
            showToast('Vui lòng chọn ngày mở đề!', 'warning');
            return;
        }
        if (!data.dueDate) {
            showToast('Vui lòng chọn ngày hết hạn!', 'warning');
            return;
        }
        if (!data.maxAttempt || parseInt(data.maxAttempt) < 1) {
            showToast('Số lần nộp bài tối đa không hợp lệ (tối thiểu là 1)!', 'warning');
            return;
        }

        const start = new Date(data.startDate);
        const due = new Date(data.dueDate);
        const duration = parseInt(data.durationInMins);

        if (isNaN(start.getTime())) {
            showToast('Ngày mở đề không đúng định dạng!', 'error');
            return;
        }
        if (isNaN(due.getTime())) {
            showToast('Ngày hết hạn không đúng định dạng!', 'error');
            return;
        }

        if (due <= start) {
            showToast('Thời gian kết thúc phải sau thời gian bắt đầu!', 'error');
            return;
        }

        const windowMins = (due - start) / (1000 * 60);
        if (duration > windowMins) {
            showToast(`Thời gian làm bài (${duration} phút) không được vượt quá khoảng thời gian mở đề (${Math.floor(windowMins)} phút)!`, 'error');
            return;
        }

        if (!data.questionShuffled) data.questionShuffled = false;
        if (!data.answerShuffled) data.answerShuffled = false;
        if (!data.showAnswer) data.showAnswer = false;

        fetch('/api/teacher/quiz-assigning', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token
            },
            body: JSON.stringify(data)
        })
            .then(res => {
                if (res.ok) {
                    showToast('Giao đề thi thành công!', 'ok');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showToast('Đã có lỗi xảy ra. Hãy thử lại!', 'error');
                }
            })
            .catch(err => {
                console.error(err);
                showToast('Lỗi kết nối. Vui lòng kiểm tra lại!', 'error');
            });
    };

    // --- Topic CRUD Operations ---
    window.createTopic = async function () {
        const newTopicInput = document.getElementById('newTopicName');
        if (!newTopicInput) return;
        const name = newTopicInput.value.trim();
        const classroomId = getClassroomId();
        if (!name) return;

        try {
            const res = await fetch('/api/teacher/class-topics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token
                },
                body: JSON.stringify({ name, classroomId })
            });
            if (res.ok) {
                showToast('Thêm chủ đề thành công!');
                setTimeout(() => { location.reload(); }, 1200);
            } else {
                showToast('Có lỗi xảy ra khi tạo chủ đề.', 'error');
            }
        } catch (e) {
            showToast('Lỗi kết nối mạng.', 'error');
        }
    };

    window.deleteTopic = function (topicId) {
        showConfirmModal('Xóa chủ đề?', 'Bạn có chắc chắn muốn xóa chủ đề này?', async () => {
            try {
                const res = await fetch('/api/teacher/class-topics/' + topicId, {
                    method: 'DELETE',
                    headers: { Authorization: 'Bearer ' + token }
                });
                if (res.ok) {
                    showToast('Đã xóa chủ đề thành công!', 'ok');
                    setTimeout(() => { location.reload(); }, 1200);
                } else {
                    showToast('Có lỗi xảy ra khi xóa chủ đề.', 'error');
                }
            } catch (e) {
                showToast('Lỗi kết nối mạng.', 'error');
            }
        });
    };

    window.editTopic = async function (topicId, currentName) {
        const newName = prompt('Nhập tên chủ đề mới:', currentName);
        if (!newName || newName.trim() === '' || newName.trim() === currentName) return;

        const classroomId = getClassroomId();

        try {
            const res = await fetch('/api/teacher/class-topics/' + topicId, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token
                },
                body: JSON.stringify({ name: newName.trim(), classroomId })
            });
            if (res.ok) {
                showToast('Đã sửa chủ đề thành công!');
                setTimeout(() => { location.reload(); }, 1200);
            } else {
                showToast('Có lỗi xảy ra khi sửa chủ đề.', 'error');
            }
        } catch (e) {
            showToast('Lỗi kết nối mạng.', 'error');
        }
    };

    // --- Classroom Management ---
    window.updateClassroom = async function () {
        const nameEl = document.getElementById('editClassName');
        const descEl = document.getElementById('editClassDesc');
        const approveEl = document.getElementById('editRequireApproval');
        if (!nameEl) return;

        const name = nameEl.value.trim();
        const description = descEl ? descEl.value.trim() : '';
        const requireApproval = approveEl ? approveEl.checked : false;
        const classroomId = getClassroomId();

        if (!name) {
            showToast('Tên lớp học không được để trống.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/teacher/classrooms/' + classroomId, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token
                },
                body: JSON.stringify({ name, description, requireApproval })
            });

            if (res.ok) {
                showToast('Cập nhật lớp học thành công!', 'ok');
                setTimeout(() => location.reload(), 1000);
            } else {
                showToast('Đã xảy ra lỗi khi cập nhật thông tin lớp học.', 'error');
            }
        } catch (e) {
            showToast('Lỗi kết nối mạng.', 'error');
        }
    };

    window.deleteClassroom = function () {
        showConfirmModal('Xóa lớp học?', 'Bạn có chắc chắn muốn xóa lớp học này không? Hành động này không thể hoàn tác.', async () => {
            const classroomId = getClassroomId();

            try {
                const res = await fetch('/api/teacher/classrooms/' + classroomId, {
                    method: 'DELETE',
                    headers: { Authorization: 'Bearer ' + token }
                });

                if (res.ok) {
                    showToast('Đã xóa lớp học thành công!', 'ok');
                    setTimeout(() => window.location.href = '/teacher/classrooms', 1000);
                } else {
                    showToast('Đã xảy ra lỗi khi xóa lớp học.', 'error');
                }
            } catch (e) {
                showToast('Lỗi kết nối mạng.', 'error');
            }
        });
    };

    window.deleteAssignment = function (assigningId, quizTitle) {
        showConfirmModal(
            'Xóa bài thi đã giao?',
            `Bạn có chắc chắn muốn xóa bài thi "${quizTitle}" khỏi lớp này không?`,
            async () => {
                try {
                    const res = await fetch('/api/teacher/quiz-assigning/' + assigningId, {
                        method: 'DELETE',
                        headers: { Authorization: 'Bearer ' + token }
                    });

                    if (res.ok) {
                        showToast('Đã xóa bài thi thành công!', 'ok');
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        if (errData && errData.message) {
                            showToast(errData.message, 'error');
                        } else {
                            showToast('Đã xảy ra lỗi khi xóa bài thi.', 'error');
                        }
                    }
                } catch (e) {
                    showToast('Lỗi kết nối mạng.', 'error');
                }
            }
        );
    };

    window.closeAssignment = function (assigningId, quizTitle) {
        showConfirmModal(
            'Đóng bài thi ngay?',
            `Bạn có chắc chắn muốn kết thúc bài thi "${quizTitle}" ngay bây giờ không? Học sinh sẽ không thể tiếp tục làm bài.`,
            async () => {
                try {
                    const res = await fetch('/api/teacher/quiz-assigning/' + assigningId + '/close', {
                        method: 'PATCH',
                        headers: { Authorization: 'Bearer ' + token }
                    });

                    if (res.ok) {
                        showToast('Đã đóng bài thi thành công!', 'ok');
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        showToast(errData.message || 'Đã xảy ra lỗi khi đóng bài thi.', 'error');
                    }
                } catch (e) {
                    showToast('Lỗi kết nối mạng.', 'error');
                }
            }
        );
    };

    window.toggleHidden = async function (assigningId) {
        try {
            const res = await fetch('/api/teacher/quiz-assigning/' + assigningId + '/toggle-hidden', {
                method: 'PATCH',
                headers: { Authorization: 'Bearer ' + token }
            });

            if (res.ok) {
                showToast('Đã thay đổi trạng thái ẩn/hiện thành công!', 'ok');
                setTimeout(() => location.reload(), 1000);
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(errData.message || 'Đã xảy ra lỗi.', 'error');
            }
        } catch (e) {
            showToast('Lỗi kết nối mạng.', 'error');
        }
    };

    window.openEditDeadlineModal = function (assigningId, currentDue) {
        document.getElementById('editDeadlineAssigningId').value = assigningId;
        const input = document.getElementById('newDueDate');
        if (input._flatpickr) {
            if (currentDue && currentDue.trim() !== '') {
                input._flatpickr.setDate(new Date(currentDue));
            } else {
                input._flatpickr.clear();
            }
        }
        const modal = new bootstrap.Modal(document.getElementById('editDeadlineModal'));
        modal.show();
    };

    window.submitEditDeadline = async function () {
        const assigningId = document.getElementById('editDeadlineAssigningId').value;
        const newDueDate = document.getElementById('newDueDate').value;

        if (!newDueDate) {
            showToast('Vui lòng chọn hạn chót mới.', 'warning');
            return;
        }

        try {
            const res = await fetch('/api/teacher/quiz-assigning/' + assigningId + '/deadline', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token 
                },
                body: JSON.stringify({ newDueDate: newDueDate + ":00" })
            });

            if (res.ok) {
                showToast('Đã cập nhật hạn chót thành công!', 'ok');
                setTimeout(() => location.reload(), 1000);
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(errData.message || 'Đã xảy ra lỗi khi cập nhật hạn chót.', 'error');
            }
        } catch (e) {
            showToast('Lỗi kết nối mạng.', 'error');
        }
    };

    // --- Visual Actions / Modals ---
    window.openQuizPreviewModal = async function (id, event) {
        if (event) event.preventDefault();
        try {
            const res = await fetch(`/api/teacher/quizzes/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const q = await res.json();
                const titleEl = document.getElementById('preview-quiz-title');
                const descEl = document.getElementById('preview-quiz-desc');
                const countEl = document.getElementById('preview-quiz-count');
                const container = document.getElementById('preview-quiz-questions');

                if (titleEl) titleEl.textContent = q.title || 'Chưa có tiêu đề';
                if (descEl) descEl.textContent = q.description || 'Chưa có mô tả.';

                if (container) {
                    container.innerHTML = '';
                    const list = q.questions || [];
                    if (countEl) countEl.textContent = list.length;

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
                }

                const modalEl = document.getElementById('previewQuizModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                    modal.show();
                }
            }
        } catch (err) {
            console.error('Lỗi tải đề thi', err);
        }
    };

    window.openTopicDetailsModal = function (topicId, topicName) {
        const titleEl = document.getElementById('topicModalTitle');
        const container = document.getElementById('topicModalBody');
        if (titleEl) titleEl.innerText = 'Chủ đề: ' + topicName;
        if (!container) return;

        container.innerHTML = '';

        const matches = document.querySelectorAll(`.assigned-card[data-topic-id="${topicId}"]`);
        if (matches.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-folder-x fs-2 text-muted d-block mb-2"></i> Chưa có đề thi nào trong chủ đề này.</div>';
        } else {
            let html = '<div class="d-flex flex-column gap-3">';
            matches.forEach((el, idx) => {
                const titleEl = el.querySelector('.assigned-title');
                const titleText = titleEl ? titleEl.textContent : 'Đề thi';
                const id = `quizCollapse_${idx}`;

                const originalActionButtons = el.querySelector('.d-flex.gap-2')?.innerHTML || '';
                const metaEl = el.querySelector('.assigned-meta')?.innerHTML || '';
                const badgeEl = el.querySelector('.badge-status')?.innerHTML || '';
                const topicBadgeEl = el.querySelector('.badge.bg-light')?.outerHTML || '';

                html += `
                <div class="card border rounded-3 bg-white p-3 shadow-sm mb-2" style="border-color:#e2e8f0 !important;">
                    <div class="d-flex justify-content-between align-items-center" style="cursor:pointer;" data-bs-toggle="collapse" data-bs-target="#${id}">
                        <div>
                            <span class="badge bg-primary bg-opacity-10 text-primary px-2 py-1 me-2 rounded" style="font-size:11px; font-weight:700;">${badgeEl || 'Đề thi'}</span>
                            ${topicBadgeEl}
                            <span class="fw-bold" style="font-size: 1.1rem; color:#1e1b4b;">${titleText}</span>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-chevron-down fs-5 text-muted transition-all" style="transition: transform 0.3s;" id="chevron_${id}"></i>
                        </div>
                    </div>
                    <div id="${id}" class="collapse mt-3 pt-3 border-top" style="border-top:1px solid #f1f5f9 !important;">
                        <div class="mb-3" style="font-size:13px; color:#475569;">
                            ${metaEl}
                        </div>
                        <div class="d-flex gap-2">
                            ${originalActionButtons}
                        </div>
                    </div>
                </div>`;
            });
            html += '</div>';
            container.innerHTML = html;

            matches.forEach((el, idx) => {
                const id = `quizCollapse_${idx}`;
                const collapseEl = document.getElementById(id);
                if (collapseEl) {
                    collapseEl.addEventListener('show.bs.collapse', () => {
                        const chevron = document.getElementById(`chevron_${id}`);
                        if (chevron) chevron.style.transform = 'rotate(180deg)';
                    });
                    collapseEl.addEventListener('hide.bs.collapse', () => {
                        const chevron = document.getElementById(`chevron_${id}`);
                        if (chevron) chevron.style.transform = 'rotate(0deg)';
                    });
                }
            });
        }

        const modalEl = document.getElementById('viewTopicQuizzesModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
    };

    // --- Initialization ---
    document.addEventListener('DOMContentLoaded', () => {
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
                static: true
            });
        });
    });
})();
