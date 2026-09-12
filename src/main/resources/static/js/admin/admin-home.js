document.addEventListener('DOMContentLoaded', async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch('/api/admin/dashboard/stats', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            const data = await response.json();
            const formatNumber = (num) => num.toLocaleString('en-US');
            document.getElementById('stat-users').innerText = formatNumber(data.totalUsers);
            document.getElementById('stat-categories').innerText = formatNumber(data.totalPublicCategories);
            document.getElementById('stat-pending').innerText = formatNumber(data.pendingQuestions);
            document.getElementById('stat-questions').innerText = formatNumber(data.totalQuestions);
        }
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
    }
});

// Fetch Dashboard Details (Tables & Lists)
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch('/api/admin/dashboard/details', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            const data = await response.json();

            // Render Recent Users
            const userTbody = document.getElementById('recent-users-tbody');
            userTbody.innerHTML = data.recentUsers.map(u => `
                <tr>
                    <td><div class="td-bold">${u.fullName}</div></td>
                    <td>${u.email}</td>
                    <td><span class="badge-role role-${u.role.toLowerCase()}">${u.role === 'TEACHER' ? 'Giáo viên' : u.role === 'STUDENT' ? 'Học sinh' : 'Admin'}</span></td>
                    <td>${u.createdAt}</td>
                </tr>
            `).join('');
            if (data.recentUsers.length === 0) userTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Chưa có người dùng mới.</td></tr>';

            // Render Moderation
            const modTbody = document.getElementById('moderation-tbody');
            modTbody.innerHTML = data.pendingModeration.map(q => `
                <tr>
                    <td>
                        <div class="td-bold">${q.text.length > 60 ? q.text.substring(0, 60) + '...' : q.text}</div>
                        <div class="td-sub"><i class="bi bi-question-circle me-1"></i>${q.type}</div>
                    </td>
                    <td>${q.creatorName}</td>
                    <td><strong>${q.categoryName}</strong></td>
                    <td class="text-right">
                        <button class="btn-action-sm btn-approve me-1" onclick="window.location.href='/admin/moderation'"><i class="bi bi-check-lg"></i> Duyệt</button>
                        <button class="btn-action-sm btn-reject" onclick="window.location.href='/admin/moderation'"><i class="bi bi-x-lg"></i></button>
                    </td>
                </tr>
            `).join('');
            if (data.pendingModeration.length === 0) modTbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Không có nội dung chờ duyệt.</td></tr>';

            // Render Categories
            const catList = document.getElementById('category-list');
            catList.innerHTML = data.categories.map(c => `
                <li class="cat-item">
                    <div class="cat-info">
                        <h6>${c.name}</h6>
                        <p>${c.quizCount} Đề thi · ${c.questionCount} Câu hỏi</p>
                    </div>
                    <i class="bi bi-three-dots-vertical"></i>
                </li>
            `).join('');
            if (data.categories.length === 0) catList.innerHTML = '<li class="text-center py-3 text-muted">Chưa có danh mục.</li>';
        }
    } catch (error) {
        console.error("Error fetching dashboard details:", error);
    }
});
