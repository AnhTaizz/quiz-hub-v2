function doLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    document.cookie = 'jwt=; path=/; max-age=0;';
    window.location.href = '/login';
}

// Robust implementation for initializing the sidebar toggle
function initSidebarToggle() {
    // 1. Restore state immediately on initialization
    if (localStorage.getItem('sidebar-collapsed') === 'true') {
        document.body.classList.add('sidebar-collapsed');
    }

    // 2. Find and bind to the toggle button
    const toggleBtn = document.getElementById('sidebarToggle') || document.querySelector('.toggle-btn');
    if (toggleBtn) {
        // Remove listener if already exists (safety precaution)
        toggleBtn.removeEventListener('click', handleSidebarToggle);
        toggleBtn.addEventListener('click', handleSidebarToggle);
    }
}

function handleSidebarToggle(e) {
    e.preventDefault();
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebar-collapsed', isCollapsed);
}

// Execute immediately if DOM is already ready, otherwise wait for event
if (document.readyState !== 'loading') {
    initSidebarToggle();
    syncHeaderProfile();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        initSidebarToggle();
        syncHeaderProfile();
    });
}

/**
 * Synchronizes the topbar user profile (name and avatar) across all dashboards
 * dynamically from the locally stored 'user' object in localStorage/sessionStorage.
 */
function syncHeaderProfile() {
    try {
        const userJson = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (!userJson) return;
        const user = JSON.parse(userJson);
        if (!user) return;

        // 1. Update all user names in header
        document.querySelectorAll('.user-header-name').forEach(el => {
            if (user.fullName) {
                el.textContent = user.fullName;
            }
        });

        // 2. Update all user avatars in header
        document.querySelectorAll('.user-header-avatar').forEach(el => {
            if (user.avatarUrl) {
                el.src = user.avatarUrl;
            } else if (user.fullName) {
                // Determine appropriate fallback background color by class
                let bgColor = '10b981'; // default student green
                if (el.classList.contains('admin-avatar')) {
                    bgColor = 'dc3545'; // admin red
                } else if (el.classList.contains('teacher-avatar')) {
                    bgColor = '28a745'; // teacher green
                }
                el.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=${bgColor}&color=fff`;
            }
        });
    } catch (e) {
        console.error("Error syncing header profile:", e);
    }
}
