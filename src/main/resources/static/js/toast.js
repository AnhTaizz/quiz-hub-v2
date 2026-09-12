/**
 * QuizHub Toast Notification System
 * Usage: 
 * toast({ title: 'Thành công!', message: 'Dữ liệu đã được lưu.', type: 'success' });
 * toast.success('Đã lưu thành công');
 * toast.error('Có lỗi xảy ra');
 */

const toast = (() => {
    // Create container if not exists
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-exclamation-triangle-fill',
        warning: 'bi-exclamation-circle-fill',
        info: 'bi-info-circle-fill'
    };

    const show = ({ title = '', message = '', type = 'info', duration = 4000 }) => {
        const toastItem = document.createElement('div');
        toastItem.className = `toast-item toast-${type}`;
        
        // Auto remove after duration
        const autoCloseTimeout = setTimeout(() => {
            removeToast(toastItem);
        }, duration);

        const iconClass = icons[type] || icons.info;
        
        toastItem.innerHTML = `
            <div class="toast-icon">
                <i class="bi ${iconClass}"></i>
            </div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            <div class="toast-close">
                <i class="bi bi-x"></i>
            </div>
            <div class="toast-progress">
                <div class="toast-progress-bar" style="animation: progress ${duration}ms linear forwards; color: inherit;"></div>
            </div>
        `;

        // Close button click
        toastItem.querySelector('.toast-close').onclick = () => {
            clearTimeout(autoCloseTimeout);
            removeToast(toastItem);
        };

        container.appendChild(toastItem);

        // Trigger animation
        requestAnimationFrame(() => {
            toastItem.classList.add('show');
        });
    };

    const removeToast = (el) => {
        el.classList.add('hide');
        el.addEventListener('transitionend', () => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }, { once: true });
    };

    // Shorthand methods
    const api = (options) => show(options);
    api.success = (msg, title = 'Thành công') => show({ message: msg, title, type: 'success' });
    api.error = (msg, title = 'Lỗi') => show({ message: msg, title, type: 'error' });
    api.warning = (msg, title = 'Cảnh báo') => show({ message: msg, title, type: 'warning' });
    api.info = (msg, title = 'Thông báo') => show({ message: msg, title, type: 'info' });

    return api;
})();

// Export to window
window.toast = toast;

// Override alert to use the custom toast system
window.alert = (msg) => {
    // Determine type based on common error patterns in messages
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('lỗi') || lowerMsg.includes('error') || lowerMsg.includes('không thành công') || lowerMsg.includes('thất bại')) {
        toast.error(msg);
    } else if (lowerMsg.includes('thành công') || lowerMsg.includes('success') || lowerMsg.includes('đã lưu')) {
        toast.success(msg);
    } else if (lowerMsg.includes('cảnh báo') || lowerMsg.includes('warning') || lowerMsg.includes('vui lòng')) {
        toast.warning(msg);
    } else {
        toast.info(msg);
    }
};
