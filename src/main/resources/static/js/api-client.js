/**
 * QuizHub Unified API Client
 * Automatic Bearer Token injection, JSON handling, and global error intercepting.
 */
const apiClient = (() => {
    const showGlobalError = (message) => {
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(message);
        } else if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            console.error('QuizHub API Error:', message);
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
            t.style.borderLeft = '4px solid #ef4444';
            t.style.fontWeight = '600';
            t.style.display = 'flex';
            t.style.alignItems = 'center';
            t.style.gap = '10px';
            t.style.marginBottom = '8px';
            t.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-danger"></i> ${message}`;
            w.appendChild(t);
            setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
        }
    };

    const request = async (url, options = {}) => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        // Setup default headers
        options.headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, options);

            // Handle unauthorized / expired tokens globally
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
                showGlobalError('Phiên làm việc đã hết hạn hoặc không có quyền truy cập. Đang chuyển hướng về trang đăng nhập...');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
                return Promise.reject(new Error('Unauthorized or Forbidden access.'));
            }

            // Handle empty responses (like HTTP 204 No Content)
            if (response.status === 204) {
                return null;
            }

            const contentType = response.headers.get('content-type');
            let data = null;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                // If it's a backend ErrorResponse with a message
                const errMsg = (data && data.message) || `Đã xảy ra lỗi hệ thống (Mã lỗi: ${response.status})`;
                showGlobalError(errMsg);
                const error = data && typeof data === 'object' ? data : new Error(errMsg);
                error.__handled = true;
                return Promise.reject(error);
            }

            return data;
        } catch (error) {
            if (error && error.__handled) {
                throw error;
            }
            console.error('Fetch error:', error);
            showGlobalError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền mạng.');
            throw error;
        }
    };

    return {
        get: (url, headers = {}) => request(url, { method: 'GET', headers }),
        post: (url, data, headers = {}) => request(url, { method: 'POST', body: JSON.stringify(data), headers }),
        put: (url, data, headers = {}) => request(url, { method: 'PUT', body: JSON.stringify(data), headers }),
        delete: (url, headers = {}) => request(url, { method: 'DELETE', headers }),
        request: request
    };
})();

// Export to global scope
window.apiClient = apiClient;
