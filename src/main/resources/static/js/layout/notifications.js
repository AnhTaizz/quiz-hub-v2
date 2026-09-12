(function () {
    document.addEventListener('DOMContentLoaded', function () {
        updateUnreadCount();
        // Tự động cập nhật mỗi 1 phút
        setInterval(updateUnreadCount, 60000);
    });

    window.updateUnreadCount = async function () {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch('/api/notifications/unread-count', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
                const count = await res.json();
                const badge = document.getElementById('unreadCount');
                if (badge) {
                    badge.style.display = count > 0 ? 'block' : 'none';
                }
            }
        } catch (e) { }
    }

    window.loadNotifications = async function () {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const list = document.getElementById('notificationList');
        if (!list) return;

        try {
            const res = await fetch('/api/notifications', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
                const notifications = await res.json();
                if (notifications.length === 0) {
                    list.innerHTML = '<div class="p-4 text-center text-muted small">Không có thông báo nào</div>';
                    return;
                }
                list.innerHTML = notifications.map(n => `
                    <div class="notification-item p-3 border-bottom ${n.read ? '' : 'bg-light'}" onclick="handleNotificationClick(${n.id}, '${n.link || ''}')" style="cursor: pointer; transition: background 0.2s;">
                        <div class="d-flex gap-3">
                            <div class="notification-icon-sm text-primary">
                                <i class="bi ${getNotificationIcon(n.type)}"></i>
                            </div>
                            <div>
                                <h6 class="mb-1 fw-bold" style="font-size: 14px;">${escapeHTML(n.title)}</h6>
                                <p class="mb-1 text-muted small" style="line-height: 1.4;">${escapeHTML(n.message)}</p>
                                <small class="text-primary" style="font-size: 11px;">${formatTime(n.createdAt)}</small>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            list.innerHTML = '<div class="p-3 text-center text-danger small">Lỗi tải thông báo</div>';
        }
    }

    function getNotificationIcon(type) {
        switch (type) {
            case 'QUESTION_APPROVED': return 'bi-check-circle-fill text-success';
            case 'QUESTION_REJECTED': return 'bi-x-circle-fill text-danger';
            case 'JOIN_REQUEST': return 'bi-person-plus-fill text-primary';
            case 'JOIN_APPROVED': return 'bi-person-check-fill text-success';
            case 'QUIZ_SUBMITTED': return 'bi-file-earmark-check-fill text-info';
            case 'QUIZ_ASSIGNED': return 'bi-journal-check text-primary';
            case 'JOIN_REJECTED': return 'bi-x-circle-fill text-danger';
            default: return 'bi-info-circle-fill';
        }
    }

    window.handleNotificationClick = async function (id, link) {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        try {
            await fetch(`/api/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token }
            });
        } catch (e) {}
        
        if (link) window.location.href = link;
        else updateUnreadCount();
    }

    window.markAllAsRead = async function () {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch('/api/notifications/read-all', {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
            updateUnreadCount();
            loadNotifications();
        }
    }

    function formatTime(dateTimeStr) {
        if (!dateTimeStr) return '--/--/----';
        const date = new Date(dateTimeStr);
        return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m];
        });
    }
})();
