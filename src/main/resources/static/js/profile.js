const token = localStorage.getItem('token') || sessionStorage.getItem('token');
if (!token) window.location.replace('/login');

let userRole = null;

async function loadProfile() {
    try {
        const res = await fetch('/api/users/my-profile', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.replace('/login');
            return;
        }

        if (!res.ok) throw new Error('Lỗi tải thông tin');

        const d = await res.json();

        document.getElementById('fullName').value  = d.fullName  || '';
        document.getElementById('email').value     = d.email     || '';
        document.getElementById('phone').value     = d.phone     || '';
        document.getElementById('avatarUrl').value = d.avatarUrl || '';

        document.getElementById('disp-name').textContent  = d.fullName || '—';
        document.getElementById('disp-email').textContent = d.email    || '—';

        userRole = d.role;
        const badge = document.getElementById('role-badge');
        if (d.role === 'ADMIN') {
            badge.textContent = 'Administrator';
            badge.className = 'role-badge role-admin';
        } else if (d.role === 'TEACHER') {
            badge.textContent = 'Giáo viên';
            badge.className = 'role-badge role-teacher';
        } else {
            badge.textContent = 'Học sinh';
            badge.className = 'role-badge role-student';
        }
        badge.style.visibility = 'visible';

        // Cập nhật logo + link topbar theo role
        updateBrandForRole(d.role);

        renderAvatar(d.avatarUrl, d.fullName);
    } catch (e) {
        showToast(e.message || 'Có lỗi xảy ra', 'error');
    }
}

async function updateProfile(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang lưu...';
    btn.disabled = true;

    try {
        const fullName = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const avatarUrl = document.getElementById('avatarUrl').value.trim();

        let finalAvatarUrl = avatarUrl;
        const urlTabActive = document.getElementById('avatarPanelUrl').style.display !== 'none';
        const urlInputValue = document.getElementById('avatarUrlInput').value.trim();
        if (urlTabActive && urlInputValue) {
            finalAvatarUrl = urlInputValue; // Lấy luôn URL do người dùng nhập bất kể preview lỗi hay không
        }

        const res = await fetch('/api/users/my-profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                fullName:  fullName,
                phone:     phone,
                avatarUrl: finalAvatarUrl
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Cập nhật thất bại');
        }

        const d = await res.json();

        // Cập nhật sidebar display
        document.getElementById('disp-name').textContent  = d.fullName || '—';
        renderAvatar(d.avatarUrl, d.fullName);

        // Cập nhật localStorage
        const sess = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
        sess.fullName  = d.fullName;
        sess.avatarUrl = d.avatarUrl;
        localStorage.setItem('user', JSON.stringify(sess));

        showToast('Hồ sơ đã được lưu thành công!', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.innerHTML = '<i class="bi bi-check2-circle"></i> Lưu thay đổi';
        btn.disabled  = false;
    }
}

function renderAvatar(url, name) {
    const el = document.getElementById('avatar-container');
    if (url) {
        el.innerHTML = `<img src="${url}" alt="Avatar" onerror="fallbackAvatar('${name}')">`;
    } else {
        fallbackAvatar(name);
    }
}

function fallbackAvatar(name) {
    const el = document.getElementById('avatar-container');
    const role = userRole || (JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}').role);
    let bgColor = '10b981'; // default student green
    if (role === 'ADMIN') {
        bgColor = 'dc3545';
    } else if (role === 'TEACHER') {
        bgColor = '28a745';
    }
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=${bgColor}&color=fff`;
    el.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
}

async function handleAvatarFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    // Client-side validation
    if (!file.type.startsWith('image/')) {
        showToast('Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP)!', 'error');
        input.value = '';
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('File ảnh không được vượt quá 5MB!', 'error');
        input.value = '';
        return;
    }

    // Hiển thị tên file + spinner
    document.getElementById('upload-file-name').textContent = file.name;
    const progressEl = document.getElementById('upload-progress');
    progressEl.style.display = 'flex';

    try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/users/upload-avatar', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Tải ảnh thất bại');
        }

        // Điền URL vào input và cập nhật preview
        const urlInput = document.getElementById('avatarUrl');
        urlInput.value = data.url;
        renderAvatar(data.url, document.getElementById('fullName').value);
        showToast('Tải ảnh lên thành công!', 'success');
    } catch (err) {
        showToast(err.message || 'Có lỗi khi tải ảnh lên', 'error');
        document.getElementById('upload-file-name').textContent = '';
        input.value = '';
    } finally {
        progressEl.style.display = 'none';
    }
}

function updateAvatarPreview() {
    renderAvatar(
        document.getElementById('avatarUrl').value.trim(),
        document.getElementById('fullName').value.trim()
    );
}

function updateBrandForRole(role) {
    const icon = document.getElementById('brand-icon');
    const link = document.getElementById('topbar-brand-link');
    if (!icon || !link) return;

    const hubSpan = link.querySelector('.hub');

    if (role === 'ADMIN') {
        icon.className = 'bi bi-shield-fill-check brand-icon-admin';
        link.href = '/admin';
        if (hubSpan) hubSpan.className = 'hub hub-admin';
    } else if (role === 'TEACHER') {
        icon.className = 'bi bi-mortarboard-fill brand-icon-teacher';
        link.href = '/teacher';
        if (hubSpan) hubSpan.className = 'hub hub-teacher';
    } else {
        icon.className = 'bi bi-layers-fill brand-icon-student';
        link.href = '/student';
        if (hubSpan) hubSpan.className = 'hub hub-student';
    }
}

function goBack() {
    const role = userRole || (JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}').role);
    if (role === 'ADMIN')        window.location.href = '/admin';
    else if (role === 'TEACHER') window.location.href = '/teacher';
    else                         window.location.href = '/student';
}

function switchAvatarTab(tab) {
    const isUpload = tab === 'upload';
    document.getElementById('avatarPanelUpload').style.display = isUpload ? '' : 'none';
    document.getElementById('avatarPanelUrl').style.display = isUpload ? 'none' : '';
    document.getElementById('avatarTabUpload').className = 'btn btn-sm ' + (isUpload ? 'btn-primary' : 'btn-outline-secondary');
    document.getElementById('avatarTabUrl').className = 'btn btn-sm ' + (!isUpload ? 'btn-primary' : 'btn-outline-secondary');
    
    document.getElementById('avatarUrl').value = '';
    if (isUpload) {
        document.getElementById('upload-file-name').textContent = '';
    } else {
        document.getElementById('avatarUrlInput').value = '';
        document.getElementById('avatarUrlPreviewBox').style.display = 'none';
    }
}

function syncAvatarUrl(val) {
    document.getElementById('avatarUrl').value = '';
    const box = document.getElementById('avatarUrlPreviewBox');
    const img = document.getElementById('avatarUrlPreview');
    const urlInput = document.getElementById('avatarUrlInput');
    urlInput.classList.remove('is-valid', 'is-invalid');
    if (val.trim()) {
        box.style.display = '';
        img.onload = () => {
            document.getElementById('avatarUrl').value = val.trim();
            urlInput.classList.remove('is-invalid');
            urlInput.classList.add('is-valid');
            renderAvatar(val.trim(), document.getElementById('fullName').value);
        };
        img.onerror = () => {
            box.style.display = 'none';
            urlInput.classList.remove('is-valid');
            urlInput.classList.add('is-invalid');
        };
        img.src = val.trim();
    } else { box.style.display = 'none'; }
}

function showToast(msg, type = "success") {
    if (type === "error" || type === "err") toast.error(msg);
    else if (type === "warning" || type === "warn") toast.warning(msg);
    else toast.success(msg);
}

loadProfile();
