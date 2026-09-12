document.addEventListener('DOMContentLoaded', async () => {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch('/api/admin/dashboard/reports', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            const data = await response.json();
            
            renderUserChart(data);
            renderQuestionChart(data);
            renderScoreChart(data);
            renderRecentAttempts(data.recentAttempts);
        }
    } catch (error) {
        console.error("Lỗi khi tải báo cáo:", error);
    }
});

function renderUserChart(data) {
    const ctx = document.getElementById('userChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                'Học sinh (' + data.studentCount + ')', 
                'Giáo viên (' + data.teacherCount + ')', 
                'Admin (' + data.adminCount + ')'
            ],
            datasets: [{
                data: [data.studentCount, data.teacherCount, data.adminCount],
                backgroundColor: ['#2563eb', '#28a745', '#7c3aed'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 20, font: { family: 'Inter', weight: 600 } } }
            },
            cutout: '70%'
        }
    });
}

function renderQuestionChart(data) {
    const ctx = document.getElementById('questionChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                'Đã duyệt (' + data.approvedQuestions + ')', 
                'Chờ duyệt (' + data.pendingQuestions + ')', 
                'Riêng tư (' + data.privateQuestions + ')'
            ],
            datasets: [{
                data: [data.approvedQuestions, data.pendingQuestions, data.privateQuestions],
                backgroundColor: ['#28a745', '#fd7e14', '#94a3b8'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 20, font: { family: 'Inter', weight: 600 } } }
            },
            cutout: '70%'
        }
    });
}

// Render Score Chart
function renderScoreChart(data) {
    const ctx = document.getElementById('scoreChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [
                'Yếu/TB (<5) : ' + data.scoreLow, 
                'Khá (5-8) : ' + data.scoreMedium, 
                'Giỏi (>=8) : ' + data.scoreHigh
            ],
            datasets: [{
                label: 'Số lượt làm bài',
                data: [data.scoreLow, data.scoreMedium, data.scoreHigh],
                backgroundColor: ['#dc3545', '#fd7e14', '#28a745'],
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderRecentAttempts(attempts) {
    const tbody = document.getElementById('recentAttemptsTable');
    if (!attempts || attempts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Chưa có lượt làm bài nào.</td></tr>';
        return;
    }

    tbody.innerHTML = attempts.map(att => {
        const score = att.score || 0;
        let scoreClass = 'score-low';
        if (score >= 8) scoreClass = 'score-high';
        else if (score >= 5) scoreClass = 'score-medium';

        const date = new Date(att.startedAt);
        const timeStr = date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        const isPractice = att.type === 'PRACTICE';
        const typeLabel = isPractice ? 'Luyện tập' : 'Bài thi';
        const typeClass = isPractice ? 'type-practice' : 'type-quiz';

        return `
            <tr>
                <td><span class="badge-type ${typeClass}">${typeLabel}</span></td>
                <td>
                    <div class="user-info">
                        <div class="avatar">${att.studentName.charAt(0)}</div>
                        <strong>${att.studentName}</strong>
                    </div>
                </td>
                <td>${att.quizTitle}</td>
                <td><span class="badge-score ${scoreClass}">${score.toFixed(1)}</span></td>
                <td class="text-muted">${timeStr}</td>
            </tr>
        `;
    }).join('');
}
