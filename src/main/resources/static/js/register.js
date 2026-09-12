// ── Redirect nếu đã đăng nhập ──────────────────────────
(function () {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const userJson = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (token && userJson) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.exp * 1000 > Date.now()) {
                const role = JSON.parse(userJson).role;
                if (role === 'ADMIN') window.location.replace('/admin');
                else if (role === 'TEACHER') window.location.replace('/teacher');
                else window.location.replace('/student');
            }
        } catch (_) { }
    }
})();

let selectedRole = null;
let isEmailTaken = false; // Theo dõi trạng thái email từ server
let lastCheckedEmail = ''; // Email đã được check gần nhất

// ── Chọn role ──────────────────────────────────────────
function selectRole(role) {
    selectedRole = role;
    document.getElementById('card-student').classList.toggle('selected', role === 'STUDENT');
    document.getElementById('card-teacher').classList.toggle('selected', role === 'TEACHER');
    document.getElementById('btn-next').classList.add('ready');
}

// ── Step navigation ────────────────────────────────────
function goStep2() {
    if (!selectedRole) return;
    const isTeacher = selectedRole === 'TEACHER';
    const badge = document.getElementById('role-badge');
    badge.className = 'role-back-badge ' + (isTeacher ? 'teacher' : 'student');
    document.getElementById('badge-text').textContent = isTeacher ? '👨‍🏫 Giáo Viên' : '👨‍🎓 Học Sinh';
    showStep(2);
}

function goStep1() { showStep(1); }

function showStep(n) {
    document.querySelectorAll('.reg-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-' + n).classList.add('active');
    document.querySelectorAll('.step-dot').forEach((d, i) => d.classList.toggle('active', i < n));
}

// ── Toggle password ────────────────────────────────────
function togglePw(id, btn) {
    const input = document.getElementById(id);
    const icon = btn.querySelector('i');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    icon.className = show ? 'bi bi-eye' : 'bi bi-eye-slash';
}

// ── Toast (dùng class toast-item từ style.css) ─────────
function showToast(msg, type = 'success') {
    if (type === 'error') toast.error(msg);
    else if (type === 'warning') toast.warning(msg);
    else toast.success(msg);
}

// ── Real-time Email Check ─────────────────────────────
// Reset isEmailTaken mỗi khi user bắt đầu gõ lại
document.getElementById('email')?.addEventListener('input', function() {
    if (this.value.trim() !== lastCheckedEmail) {
        isEmailTaken = false;
    }
});

document.getElementById('email')?.addEventListener('blur', async function() {
    const email = this.value.trim();
    const fieldWrapper = this.closest('.auth-input-wrapper');
    const errorDiv = document.getElementById('error-email');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        isEmailTaken = false;
        lastCheckedEmail = '';
        return;
    }

    // Không check lại nếu email không thay đổi
    if (email === lastCheckedEmail) return;

    try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
        if (!res.ok) { isEmailTaken = false; return; }
        const result = await res.json();
        // Đảm bảo chỉ nhận đúng boolean true
        isEmailTaken = result === true;
        lastCheckedEmail = email;

        if (isEmailTaken) {
            fieldWrapper.classList.add('is-invalid');
            errorDiv.textContent = 'Email này đã được sử dụng. Vui lòng dùng email khác.';
            errorDiv.style.display = 'block';
        } else {
            fieldWrapper.classList.remove('is-invalid');
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
        }
    } catch (e) {
        // Nếu check-email lỗi mạng, không block user đăng ký
        isEmailTaken = false;
        console.warn('Email check failed, skipping:', e);
    }
});

// ── Helper: Hiển thị lỗi trường ────────────────────────
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorDiv = document.getElementById('error-' + fieldId);
    if (field && errorDiv) {
        field.closest('.auth-input-wrapper').classList.add('is-invalid');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function clearErrors() {
    document.querySelectorAll('.invalid-feedback').forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });
    document.querySelectorAll('.auth-input-wrapper').forEach(el => {
        el.classList.remove('is-invalid');
    });
}

// ── Register submit ────────────────────────────────────
async function handleRegister(e) {
    e.preventDefault();
    
    // Lấy dữ liệu
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Xóa chỉ các lớp visual, giữ lại nội dung lỗi async nếu cần xử lý logic phức tạp hơn
    // Tuy nhiên ở đây ta clear sạch để build lại danh sách lỗi hiện tại
    clearErrors();

    let hasError = false;

    // 1. Kiểm tra Họ tên
    if (!fullName) { 
        showFieldError('fullName', 'Vui lòng nhập họ và tên.'); 
        hasError = true; 
    }

    // 2. Kiểm tra định dạng Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) { 
        showFieldError('email', 'Vui lòng nhập email.'); 
        hasError = true; 
    } else if (!emailRegex.test(email)) {
        showFieldError('email', 'Email không đúng định dạng.');
        hasError = true;
    } else if (isEmailTaken) {
        // Hiển thị lại lỗi email trùng từ server đã check trước đó
        showFieldError('email', 'Email này đã được sử dụng. Vui lòng dùng email khác.');
        hasError = true;
    }

    // 3. Kiểm tra Mật khẩu
    if (password.length < 6) { 
        showFieldError('password', 'Mật khẩu phải có ít nhất 6 ký tự.'); 
        hasError = true; 
    }

    // 4. Kiểm tra Xác nhận mật khẩu
    if (password !== confirmPassword) { 
        showFieldError('confirmPassword', 'Mật khẩu xác nhận không khớp.'); 
        hasError = true; 
    }
    
    // Nếu có bất kỳ lỗi nào, dừng lại và hiển thị TẤT CẢ cùng lúc
    if (hasError) return;

    const btn = document.getElementById('btn-submit');
    const spinner = document.getElementById('spinner');
    const btnText = document.getElementById('btn-text');
    const btnIcon = document.getElementById('btn-icon');
    btn.disabled = true;
    spinner.style.display = 'block';
    btnIcon.style.display = 'none';
    btnText.textContent = 'Đang đăng ký...';

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, password, confirmPassword, role: selectedRole })
        });

        const data = await res.json();

        if (!res.ok) {
            if (data.errors) {
                Object.keys(data.errors).forEach(key => {
                    showFieldError(key, data.errors[key]);
                });
            } else if (data.message) {
                const msg = data.message.toLowerCase();
                if (msg.includes('email already exists') || msg.includes('email đã tồn tại')) {
                    isEmailTaken = true; // Cập nhật lại state nếu server báo lỗi mà blur chưa kịp bắt
                    showFieldError('email', data.message);
                } else if (msg.includes('match') || msg.includes('khớp')) {
                    showFieldError('confirmPassword', data.message);
                } else {
                    showToast(data.message, 'error');
                }
            } else {
                showToast('Đăng ký thất bại. Vui lòng thử lại.', 'error');
            }
            return;
        }

        if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify({
                id: data.id, email: data.email,
                fullName: data.fullName, role: data.role
            }));
            document.cookie = `jwt=${data.token}; path=/; max-age=${7 * 24 * 3600}; samesite=strict`;
        }

        showToast('Đăng ký thành công! Đang chuyển hướng...', 'success');
        setTimeout(() => {
            if (selectedRole === 'TEACHER') window.location.replace('/teacher');
            else window.location.replace('/student');
        }, 1200);

    } catch (_) {
        showToast('Lỗi kết nối. Vui lòng thử lại.', 'error');
    } finally {
        btn.disabled = false;
        spinner.style.display = 'none';
        btnIcon.style.display = 'block';
        btnText.textContent = 'Đăng ký ngay';
    }
}
