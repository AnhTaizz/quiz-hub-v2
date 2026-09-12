function togglePwdVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
    }
}

function showCpwAlert(msg, isSuccess) {
    if (window.toast && typeof window.toast.success === 'function') {
        if (isSuccess) window.toast.success(msg);
        else window.toast.error(msg);
    } else if (typeof showToast === 'function') {
        showToast(msg, isSuccess ? 'success' : 'error');
    } else {
        let w = document.getElementById('toastWrap') || document.getElementById('toast-wrap');
        if (!w) {
            w = document.createElement('div');
            w.id = 'toastWrap';
            w.className = 'toast-wrap';
            w.style.position = 'fixed';
            w.style.top = '24px';
            w.style.right = '24px';
            w.style.zIndex = '99999';
            document.body.appendChild(w);
        }
        const t = document.createElement('div');
        t.style.background = '#fff';
        t.style.padding = '14px 24px';
        t.style.borderRadius = '12px';
        t.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.12)';
        t.style.borderLeft = isSuccess ? '4px solid #10b981' : '4px solid #ef4444';
        t.style.fontWeight = '600';
        t.style.display = 'flex';
        t.style.alignItems = 'center';
        t.style.gap = '10px';
        t.style.marginBottom = '8px';
        t.innerHTML = `<i class="bi ${isSuccess?'bi-check-circle-fill text-success':'bi-exclamation-triangle-fill text-danger'}"></i> ${msg}`;
        w.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
    }
}

async function submitChangePassword() {
    const current = document.getElementById('cpw-current').value.trim();
    const newPwd = document.getElementById('cpw-new').value.trim();
    const confirm = document.getElementById('cpw-confirm').value.trim();

    if (!current || !newPwd || !confirm) { showCpwAlert('Vui lòng điền đầy đủ các trường!', false); return; }
    if (newPwd.length < 6) { showCpwAlert('Mật khẩu mới phải ít nhất 6 ký tự!', false); return; }
    if (newPwd !== confirm) { showCpwAlert('Mật khẩu xác nhận không khớp!', false); return; }

    const btn = document.getElementById('cpw-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang xử lý...';

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
        const res = await fetch('/api/users/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ oldPassword: current, newPassword: newPwd, confirmNewPassword: confirm })
        });
        const text = await res.text();
        if (res.ok) {
            showCpwAlert('Đổi mật khẩu thành công!', true);
            setTimeout(() => {
                document.getElementById('cpw-current').value = '';
                document.getElementById('cpw-new').value = '';
                document.getElementById('cpw-confirm').value = '';
                document.getElementById('cpw-alert').style.display = 'none';
                
                const modalEl = document.getElementById('changePasswordModal');
                if (modalEl && window.bootstrap && window.bootstrap.Modal) {
                    const modalInstance = window.bootstrap.Modal.getInstance(modalEl);
                    if (modalInstance) modalInstance.hide();
                }
            }, 1500);
        } else {
            let errorMsg = text;
            try {
                const json = JSON.parse(text);
                errorMsg = json.message || text;
            } catch (e) { }

            let msg = errorMsg || 'Có lỗi xảy ra!';
            if (errorMsg.includes('hiện tại') || errorMsg.includes('incorrect')) {
                msg = 'Mật khẩu hiện tại không đúng!';
            } else if (errorMsg.includes('same as the old password') || errorMsg.includes('PASSWORD_SAME')) {
                msg = 'Mật khẩu mới không được trùng với mật khẩu hiện tại!';
            }
            showCpwAlert(msg, false);
        }
    } catch (e) {
        showCpwAlert('Lỗi kết nối mạng!', false);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Cập nhật';
    }
}

// Reset form khi đóng modal
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
        modal.addEventListener('hidden.bs.modal', () => {
            document.getElementById('cpw-current').value = '';
            document.getElementById('cpw-new').value = '';
            document.getElementById('cpw-confirm').value = '';
            const alertEl = document.getElementById('cpw-alert');
            if (alertEl) alertEl.style.display = 'none';
        });
    }
});
