// Kiểm tra token JWT còn hạn không
function isTokenValid(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 > Date.now();
    } catch (e) {
        return false;
    }
}

function showLoginError(message) {
    const box = document.getElementById('loginError');
    const msg = document.getElementById('loginErrorMsg');
    const wrapper = document.getElementById('passwordWrapper');
    msg.textContent = message;
    box.style.display = 'flex';
    if (wrapper) {
        wrapper.querySelector('input').style.borderColor = 'rgba(248,113,113,0.6)';
    }
}

function clearLoginError() {
    const box = document.getElementById('loginError');
    const wrapper = document.getElementById('passwordWrapper');
    box.style.display = 'none';
    if (wrapper) {
        wrapper.querySelector('input').style.borderColor = '';
    }
}

// Reset lỗi khi user gõ lại
document.getElementById('email')?.addEventListener('input', clearLoginError);
document.getElementById('password')?.addEventListener('input', clearLoginError);

// Nếu người dùng đã đăng nhập VÀ token còn hạn, tự động chuyển về dashboard của role
(function() {
    const userJson = localStorage.getItem('user') || sessionStorage.getItem('user');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnUrl');

    if (userJson && token) {
        // Nếu có returnUrl nghĩa là backend đã TỪ CHỐI token của user (bị khóa, hoặc cookie bị mất)
        if (!isTokenValid(token) || returnUrl) {
            // Token hết hạn HOẶC không còn hợp lệ ở backend -> xóa sạch
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            document.cookie = 'jwt=; path=/; max-age=0;';
            
            if (returnUrl) {
                showLoginError("Phiên đăng nhập đã hết hạn hoặc tài khoản bị khóa. Vui lòng đăng nhập lại.");
            }
            return;
        }
        
        const user = JSON.parse(userJson);
        if (user.role === 'ADMIN') window.location.replace('/admin');
        else if (user.role === 'TEACHER') window.location.replace('/teacher');
        else window.location.replace('/student');
    }
})();

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('submitBtn');
    const submitText = submitBtn.querySelector('span');
    
    submitBtn.disabled = true;
    submitText.textContent = 'Đang xử lý...';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save user info and token to local/session storage based on Remember Me
            const rememberMe = document.getElementById('rememberMe').checked;
            const storage = rememberMe ? localStorage : sessionStorage;

            storage.setItem('token', data.token);
            storage.setItem('user', JSON.stringify({
                id: data.id,
                email: data.email,
                fullName: data.fullName,
                role: data.role,
                avatarUrl: data.avatarUrl
            }));
            // Tích hợp Cookie cho Thymeleaf (để trình duyệt tự gửi JWT Header)
            if (rememberMe) {
                document.cookie = `jwt=${data.token}; path=/; max-age=86400; samesite=strict`;
            } else {
                document.cookie = `jwt=${data.token}; path=/; samesite=strict`;
            }

            showToast('Đăng nhập thành công!', 'success');
            
            // Immediately update header navbar to show logged-in state
            if (typeof checkAuthState === 'function') {
                checkAuthState();
            }

            setTimeout(() => {
                const params = new URLSearchParams(window.location.search);
                const returnUrl = params.get('returnUrl');
                if (returnUrl) {
                    window.location.href = decodeURIComponent(returnUrl);
                } else {
                    const role = data.role;
                    if (role === 'ADMIN') window.location.href = '/admin';
                    else if (role === 'TEACHER') window.location.href = '/teacher';
                    else window.location.href = '/student';
                }
            }, 1000);
        } else {
            // Dịch message lỗi từ backend sang tiếng Việt
            let errorMsg = 'Email hoặc mật khẩu không chính xác.';
            if (data && data.message) {
                const msg = data.message.toLowerCase();
                if (msg.includes('unauthorized') || msg.includes('bad credentials')) {
                    errorMsg = 'Email hoặc mật khẩu không chính xác.';
                } else if (msg.includes('not found') || msg.includes('user')) {
                    errorMsg = 'Tài khoản không tồn tại.';
                } else if (msg.includes('disabled') || msg.includes('locked')) {
                    errorMsg = 'Tài khoản đã bị khóa.';
                } else {
                    errorMsg = data.message;
                }
            }
            showLoginError(errorMsg);
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('Đã có lỗi xảy ra. Vui lòng thử lại sau.');
    } finally {
        submitBtn.disabled = false;
        submitText.textContent = 'Đăng nhập';
    }
});

function showToast(msg, type = 'success') {
    if (type === 'error') toast.error(msg);
    else if (type === 'warning') toast.warning(msg);
    else toast.success(msg);
}
