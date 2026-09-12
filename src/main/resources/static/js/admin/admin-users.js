(function () {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) { window.location.replace('/login'); return; }

    const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
    if (user.fullName) {
        const topName = document.getElementById('topbar-name');
        const topAvatar = document.getElementById('topbar-avatar');
        if (topName) topName.textContent = user.fullName;
        if (topAvatar) {
            const avatarUrl = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=2563eb&color=fff`;
            topAvatar.src = avatarUrl;
        }
    }
})();

let currentPage = 0;
let activeUserId = null;
let activeEnableTarget = null;
let searchTimer = null;

const roleModal = new bootstrap.Modal(document.getElementById('roleModal'));
const statusModal = new bootstrap.Modal(document.getElementById('statusModal'));

function debounceSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentPage = 0; loadUsers(); }, 400);
}

async function loadUsers() {
    const keyword = document.getElementById('search-input').value.trim();
    const role = document.getElementById('filter-role').value;
    const size = document.getElementById('page-size').value;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    document.getElementById('table-body-wrap').innerHTML = '<div class="table-loading"><div class="spinner"></div>Đang tải dữ liệu...</div>';
    document.getElementById('pagination-bar').style.display = 'none';

    try {
        let url = `/api/admin/users?page=${currentPage}&size=${size}&keyword=${encodeURIComponent(keyword)}`;
        if (role) url += `&role=${role}`;

        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();

        renderTable(data.content || []);
        renderPagination(data);
    } catch (err) {
        document.getElementById('table-body-wrap').innerHTML = '<div class="table-loading text-danger"><i class="bi bi-exclamation-circle d-block mb-3" style="font-size:32px"></i> Lỗi tải dữ liệu.</div>';
    }
}

function renderTable(users) {
    if (!users.length) {
        document.getElementById('table-body-wrap').innerHTML = '<div class="table-loading"><i class="bi bi-people mb-2 d-block" style="font-size:32px"></i>Không tìm thấy người dùng nào.</div>';
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
    const currentUserEmail = currentUser.email;

    const rows = users.map(u => {
        let bgColor = '10b981'; // default student green
        if (u.role === 'ADMIN') {
            bgColor = 'dc3545'; // admin red
        } else if (u.role === 'TEACHER') {
            bgColor = '28a745'; // teacher green
        }
        const avatarUrl = u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName || 'User')}&background=${bgColor}&color=fff`;
        const avatar = `<img src="${avatarUrl}" alt="Avatar">`;
        const roleCls = { ADMIN: 'role-admin', TEACHER: 'role-teacher', STUDENT: 'role-student' }[u.role];
        const roleName = { ADMIN: 'Admin', TEACHER: 'Giáo viên', STUDENT: 'Học sinh' }[u.role];
        const isActive = u.isEnable !== false;
        const isCurrentUser = u.email === currentUserEmail;

        let actionsHtml = '';
        if (isCurrentUser) {
            actionsHtml = '<span class="badge bg-secondary" style="padding:8px 12px;border-radius:10px;">Tài khoản của bạn</span>';
        } else {
            actionsHtml = `
                ${isActive
                    ? `<button class="btn-tbl btn-lock" onclick="openStatusModal(${u.id},'${esc(u.fullName)}',false)"><i class="bi bi-lock-fill"></i> Khoá</button>`
                    : `<button class="btn-tbl btn-unlock" onclick="openStatusModal(${u.id},'${esc(u.fullName)}',true)"><i class="bi bi-unlock-fill"></i> Mở khoá</button>`
                }
                <button class="btn-tbl btn-role" onclick="openRoleModal(${u.id},'${esc(u.fullName)}')"><i class="bi bi-shield-shaded"></i> Quyền</button>
            `;
        }

        return `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-circle">${avatar}</div>
                    <div>
                        <div class="user-name-text">${esc(u.fullName)}</div>
                        <div class="user-id-text">#${u.id}</div>
                    </div>
                </div>
            </td>
            <td>${esc(u.email)}</td>
            <td><span class="badge-role ${roleCls}">${roleName}</span></td>
            <td>
                <span class="badge-status ${isActive ? 'status-active' : 'status-locked'}">
                    <i class="bi bi-record-circle-fill"></i> ${isActive ? 'Hoạt động' : 'Đã khoá'}
                </span>
            </td>
            <td>
                <div class="action-group">
                    ${actionsHtml}
                </div>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('table-body-wrap').innerHTML = `<table><thead><tr><th>Người dùng</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPagination(data) {
    const bar = document.getElementById('pagination-btns');
    const info = document.getElementById('pagination-info');
    const totalPages = data.totalPages || 0;
    const totalElements = data.totalElements || 0;
    const size = parseInt(document.getElementById('page-size').value);

    info.textContent = `Hiển thị ${Math.min(totalElements, currentPage * size + 1)}-${Math.min(totalElements, (currentPage + 1) * size)} trên tổng số ${totalElements}`;
    bar.innerHTML = '';

    if (totalPages <= 1) return;
    document.getElementById('pagination-bar').style.display = 'flex';

    const addBtn = (label, page, active = false, disabled = false) => {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (active ? ' active' : '');
        btn.disabled = disabled;
        btn.innerHTML = label;
        if (!disabled) btn.onclick = () => { currentPage = page; loadUsers(); };
        bar.appendChild(btn);
    }

    addBtn('<i class="bi bi-chevron-left"></i>', currentPage - 1, false, currentPage === 0);
    for (let i = 0; i < totalPages; i++) {
        if (i < 3 || i > totalPages - 3 || (i >= currentPage - 1 && i <= currentPage + 1)) {
            addBtn(i + 1, i, i === currentPage);
        } else if (i === 3 || i === totalPages - 3) {
            const span = document.createElement('span');
            span.textContent = '...';
            span.style.padding = '0 5px';
            bar.appendChild(span);
        }
    }
    addBtn('<i class="bi bi-chevron-right"></i>', currentPage + 1, false, currentPage === totalPages - 1);
}

function openRoleModal(id, name) {
    activeUserId = id;
    document.getElementById('modal-user-name').textContent = name;
    roleModal.show();
}

async function confirmChangeRole(role) {
    roleModal.hide();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch(`/api/admin/users/${activeUserId}/role?role=${role}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { showToast('Cập nhật vai trò thành công!', 'success'); loadUsers(); loadChips(); }
        else showToast('Cập nhật thất bại.', 'error');
    } catch (err) { showToast('Lỗi kết nối.', 'error'); }
}

function openStatusModal(id, name, enable) {
    activeUserId = id;
    activeEnableTarget = enable;
    document.getElementById('status-modal-title').textContent = enable ? 'Mở khoá tài khoản' : 'Khoá tài khoản';
    document.getElementById('status-modal-msg').innerHTML = `Xác nhận <strong>${enable ? 'mở khoá' : 'khoá'}</strong> tài khoản của <strong>${esc(name)}</strong>?`;
    const btn = document.getElementById('status-confirm-btn');
    btn.className = enable ? 'btn btn-success' : 'btn btn-danger';
    btn.textContent = enable ? 'Mở khoá' : 'Khoá';
    statusModal.show();
}

async function confirmChangeStatus() {
    statusModal.hide();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch(`/api/admin/users/${activeUserId}/status?enable=${activeEnableTarget}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { showToast(activeEnableTarget ? 'Đã mở khoá!' : 'Đã khoá!', 'success'); loadUsers(); }
        else showToast('Thao tác thất bại.', 'error');
    } catch (err) { showToast('Lỗi kết nối.', 'error'); }
}



async function loadChips() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const [rT, rS, rA, rAll] = await Promise.all([
            fetch('/api/admin/users?role=TEACHER&size=1', { headers: { Authorization: `Bearer ${token}` } }),
            fetch('/api/admin/users?role=STUDENT&size=1', { headers: { Authorization: `Bearer ${token}` } }),
            fetch('/api/admin/users?role=ADMIN&size=1', { headers: { Authorization: `Bearer ${token}` } }),
            fetch('/api/admin/users?size=1', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const [dT, dS, dA, dAll] = await Promise.all([rT.json(), rS.json(), rA.json(), rAll.json()]);
        document.getElementById('chip-total').textContent = dAll.totalElements || 0;
        document.getElementById('chip-teacher').textContent = dT.totalElements || 0;
        document.getElementById('chip-student').textContent = dS.totalElements || 0;
        document.getElementById('chip-admin').textContent = dA.totalElements || 0;
    } catch (e) { }
}

function esc(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

document.addEventListener("DOMContentLoaded", function () {
    loadUsers();
    loadChips();
});

function validateField(id) {
    const input = document.getElementById(id);
    const val = input.value.trim();
    let isValid = true;
    let errId = "";

    if (id === 'add-fullName') {
        isValid = val.length > 0;
        errId = "err-fullName";
    } else if (id === 'add-password') {
        isValid = val.length >= 6;
        errId = "err-password";
    } else if (id === 'add-confirm-password') {
        const pass = document.getElementById('add-password').value;
        isValid = val === pass;
        errId = "err-confirm-password";
    } else if (id === 'add-email') {
        errId = "err-email";
        const errDiv = document.getElementById(errId);
        if (!val) {
            isValid = false;
            if (errDiv) errDiv.textContent = 'Email không được để trống';
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = emailRegex.test(val);
            if (!isValid && errDiv) errDiv.textContent = 'Email không đúng định dạng';
        }
    }

    if (errId) {
        const errDiv = document.getElementById(errId);
        if (isValid) {
            input.classList.remove('is-invalid-custom');
            if (errDiv) errDiv.style.display = 'none';
        } else {
            input.classList.add('is-invalid-custom');
            if (errDiv) errDiv.style.display = 'block';
        }
    }
    return isValid;
}

async function submitAddUser() {
    document.querySelectorAll('.is-invalid-custom').forEach(el => el.classList.remove('is-invalid-custom'));
    document.querySelectorAll('.invalid-feedback-custom').forEach(el => el.style.display = 'none');

    const fullName = document.getElementById('add-fullName').value;
    const email = document.getElementById('add-email').value;
    const password = document.getElementById('add-password').value;
    const confirmPassword = document.getElementById('add-confirm-password').value;
    const role = document.getElementById('add-role').value;

    const v1 = validateField('add-fullName');
    const v2 = validateField('add-email');
    const v3 = validateField('add-password');
    const v4 = validateField('add-confirm-password');

    if (!v1 || !v2 || !v3 || !v4) {
        showToast("Vui lòng kiểm tra lại thông tin nhập liệu!", "error");
        return;
    }

    const emailStatus = document.getElementById('email-status');
    if (emailStatus.classList.contains('invalid')) {
        showToast("Email này đã tồn tại trên hệ thống!", "error");
        return;
    }

    const btnText = document.getElementById('add-btn-text');
    const btnSpinner = document.getElementById('add-btn-spinner');

    try {
        btnText.classList.add('d-none');
        btnSpinner.classList.remove('d-none');

        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, password, role })
        });

        if (response.ok) {
            showToast("Kích hoạt tài khoản thành công!", "success");
            bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            document.getElementById('addUserForm').reset();
            document.getElementById('email-status').className = 'email-status';
            document.getElementById('email-status').style.display = 'none';
            document.querySelectorAll('.is-invalid-custom').forEach(el => el.classList.remove('is-invalid-custom'));
            document.querySelectorAll('.invalid-feedback-custom').forEach(el => el.style.display = 'none');
            loadUsers();
            loadChips();
        } else {
            const errorText = await response.text();
            let errMsg = "Có lỗi xảy ra khi tạo tài khoản!";
            try {
                const errJson = JSON.parse(errorText);
                if (errJson.errors && Object.keys(errJson.errors).length > 0) {
                    errMsg = Object.values(errJson.errors).join(", ");
                    Object.keys(errJson.errors).forEach(key => {
                        const fieldId = 'add-' + key;
                        const input = document.getElementById(fieldId);
                        const errDiv = document.getElementById('err-' + key);
                        if (input && errDiv) {
                            input.classList.add('is-invalid-custom');
                            errDiv.textContent = errJson.errors[key];
                            errDiv.style.display = 'block';
                        }
                    });
                } else if (errJson.message) {
                    errMsg = errJson.message;
                    const lowerMsg = errMsg.toLowerCase();
                    if (errJson.code === 1013 || errJson.code === 1008 || lowerMsg.includes('email') || lowerMsg.includes('tài khoản')) {
                        const emailInput = document.getElementById('add-email');
                        const errDiv = document.getElementById('err-email');
                        if (emailInput && errDiv) {
                            emailInput.classList.add('is-invalid-custom');
                            errDiv.textContent = errMsg;
                            errDiv.style.display = 'block';
                        }
                    } else if (errJson.code === 1009 || lowerMsg.includes('mật khẩu') || lowerMsg.includes('password')) {
                        const passwordInput = document.getElementById('add-password');
                        const errDiv = document.getElementById('err-password');
                        if (passwordInput && errDiv) {
                            passwordInput.classList.add('is-invalid-custom');
                            errDiv.textContent = errMsg;
                            errDiv.style.display = 'block';
                        }
                    } else if (errJson.code === 1007 || lowerMsg.includes('họ tên') || lowerMsg.includes('blank')) {
                        const nameInput = document.getElementById('add-fullName');
                        const errDiv = document.getElementById('err-fullName');
                        if (nameInput && errDiv) {
                            nameInput.classList.add('is-invalid-custom');
                            errDiv.textContent = errMsg;
                            errDiv.style.display = 'block';
                        }
                    }
                }
            } catch (e) {
                if (errorText) {
                    errMsg = errorText;
                }
            }
            showToast(errMsg, "error");
        }
    } catch (error) {
        showToast("Lỗi kết nối server!", "error");
    } finally {
        btnText.classList.remove('d-none');
        btnSpinner.classList.add('d-none');
    }
}

let emailTimeout = null;
function handleEmailInput() {
    clearTimeout(emailTimeout);
    const emailInput = document.getElementById('add-email');
    const email = emailInput.value.trim();
    const statusDiv = document.getElementById('email-status');
    const errDiv = document.getElementById('err-email');

    statusDiv.className = 'email-status';
    statusDiv.style.display = 'none';
    errDiv.style.display = 'none';
    emailInput.classList.remove('is-invalid-custom');

    if (!email) {
        errDiv.textContent = 'Email không được để trống';
        errDiv.style.display = 'block';
        emailInput.classList.add('is-invalid-custom');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errDiv.textContent = 'Email không đúng định dạng';
        errDiv.style.display = 'block';
        emailInput.classList.add('is-invalid-custom');
        return;
    }

    emailTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`/api/admin/users/check-email?email=${encodeURIComponent(email)}`);
            const exists = await res.json();
            if (exists) {
                statusDiv.textContent = '❌ Email này đã được sử dụng';
                statusDiv.className = 'email-status invalid';
                statusDiv.style.display = 'block';
                emailInput.classList.add('is-invalid-custom');
            } else {
                statusDiv.textContent = '✅ Email hợp lệ và có thể sử dụng';
                statusDiv.className = 'email-status valid';
                statusDiv.style.display = 'block';
                emailInput.classList.remove('is-invalid-custom');
            }
        } catch (e) { console.error(e); }
    }, 500);
}

function togglePass(id, btn) {
    const input = document.getElementById(id);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
    }
}

function showToast(msg, type = 'ok') {
    if (type === 'err' || type === 'error') toast.error(msg);
    else if (type === 'warn' || type === 'warning') toast.warning(msg);
    else toast.success(msg);
}
