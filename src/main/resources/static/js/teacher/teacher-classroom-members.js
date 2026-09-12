(function() {
    document.addEventListener('DOMContentLoaded', function () {
        // Tab Switching Logic
        const tabs = document.querySelectorAll('.nav-tab-item');
        const panes = document.querySelectorAll('.tab-pane');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.getAttribute('data-tab');

                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                const paneEl = document.getElementById('tab-' + target);
                if (paneEl) paneEl.classList.add('active');
            });
        });

        // Initialize Popovers
        const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
        popoverTriggerList.map(function (popoverTriggerEl) {
            return new bootstrap.Popover(popoverTriggerEl);
        });
    });

    function confirmRemoveStudent(btn) {
        const studentId = btn.getAttribute('data-student-id');
        const studentName = btn.getAttribute('data-student-name');
        const classroomId = btn.getAttribute('data-classroom-id');
        const nameEl = document.getElementById('removeStudentName');
        const formEl = document.getElementById('removeStudentForm');
        
        if (nameEl) nameEl.textContent = studentName;
        if (formEl) formEl.action = `/teacher/classrooms/${classroomId}/remove/${studentId}`;
        
        const modalEl = document.getElementById('removeStudentModal');
        if (modalEl) {
            new bootstrap.Modal(modalEl).show();
        }
    }

    async function handleExcelUpload(input) {
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        const classroomId = window.classroomId || 0;
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');

        const formData = new FormData();
        formData.append('file', file);

        // Hiển thị trạng thái đang xử lý
        const btn = document.querySelector('button[onclick*="excelFileInput"]');
        let originalContent = '';
        if (btn) {
            originalContent = btn.innerHTML;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Đang xử lý...`;
            btn.disabled = true;
        }

        try {
            const response = await fetch(`/api/teacher/classrooms/${classroomId}/import-students`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData
            });

            const result = await response.json();

            // Hiển thị kết quả trong Modal
            const resultBody = document.getElementById('importResultBody');
            if (resultBody) {
                resultBody.innerHTML = `
                    <div class="text-center mb-4">
                        <div class="display-4 text-success mb-2"><i class="bi bi-check-circle"></i></div>
                        <h4 class="fw-bold">Xử lý hoàn tất!</h4>
                    </div>
                    <ul class="list-group list-group-flush mb-0">
                        <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                            <span>Thành công:</span>
                            <span class="badge bg-success rounded-pill">${result.successCount} học sinh</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                            <span>Đã có trong lớp:</span>
                            <span class="badge bg-secondary rounded-pill">${result.alreadyJoinedEmails.length} học sinh</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                            <span class="text-danger">Email không tồn tại:</span>
                            <span class="badge bg-danger rounded-pill">${result.failCount}</span>
                        </li>
                    </ul>
                `;

                if (result.failedEmails.length > 0) {
                    resultBody.innerHTML += `
                        <div class="mt-3">
                            <p class="small text-muted mb-1">Danh sách email lỗi:</p>
                            <div class="p-2 bg-light rounded small" style="max-height: 100px; overflow-y: auto;">
                                ${result.failedEmails.join(', ')}
                            </div>
                        </div>
                    `;
                }
            }

            const resultModalEl = document.getElementById('importResultModal');
            if (resultModalEl) {
                const resultModal = new bootstrap.Modal(resultModalEl);
                resultModal.show();

                // Reload trang khi đóng modal nếu có thành công
                if (result.successCount > 0) {
                    resultModalEl.addEventListener('hidden.bs.modal', () => {
                        location.reload();
                    }, { once: true });
                }
            }

        } catch (error) {
            if (typeof showToast === 'function') {
                showToast('Có lỗi xảy ra trong quá trình tải file. Vui lòng kiểm tra lại định dạng file!', 'error');
            } else {
                console.error('Có lỗi xảy ra trong quá trình tải file. Vui lòng kiểm tra lại định dạng file!');
            }
            console.error(error);
        } finally {
            if (btn) {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
            input.value = ''; // Reset input
        }
    }

    // Expose handlers globally
    window.confirmRemoveStudent = confirmRemoveStudent;
    window.handleExcelUpload = handleExcelUpload;
})();
