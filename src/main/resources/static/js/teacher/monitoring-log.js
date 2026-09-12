(function() {
    document.addEventListener("DOMContentLoaded", function () {
        // 1. Calculate Statistics
        calculateStats();

        // 3. Auto Refresh Logic
        const autoRefreshEl = document.getElementById('autoRefresh');
        if (autoRefreshEl) {
            let refreshInterval = setInterval(() => {
                if (autoRefreshEl.checked) {
                    location.reload();
                }
            }, 10000); // 10 seconds

            autoRefreshEl.onchange = function () {
                const status = document.getElementById('liveStatus');
                if (status) {
                    if (this.checked) {
                        status.textContent = "Đang bật";
                        status.className = "small text-success fw-bold";
                    } else {
                        status.textContent = "Đã tắt";
                        status.className = "small text-muted fw-bold";
                    }
                }
            };
        }
    });

    window.calculateStats = function() {
        const rows = document.querySelectorAll('.log-table tbody tr');
        const studentCounts = {};
        const typeCounts = {};
        let highRisk = 0;

        rows.forEach(row => {
            const emailEl = row.querySelector('.text-muted.small');
            const typeEl = row.querySelector('.v-type-badge');
            if (emailEl && typeEl) {
                const email = emailEl.textContent;
                studentCounts[email] = (studentCounts[email] || 0) + 1;

                const type = typeEl.textContent.trim();
                typeCounts[type] = (typeCounts[type] || 0) + 1;
            }
        });

        // Count high risk (> 3 violations)
        for (let email in studentCounts) {
            if (studentCounts[email] >= 3) {
                highRisk++;
                // Highlight rows for high risk students
                rows.forEach(row => {
                    const emailEl = row.querySelector('.text-muted.small');
                    if (emailEl && emailEl.textContent === email) {
                        row.classList.add('high-risk-row');
                    }
                });
            }
        }

        // Find most common violation
        let maxType = "---";
        let maxVal = 0;
        for (let type in typeCounts) {
            if (typeCounts[type] > maxVal) {
                maxVal = typeCounts[type];
                maxType = type;
            }
        }

        const highRiskCountEl = document.getElementById('highRiskCount');
        const mostCommonLvlEl = document.getElementById('mostCommonLvl');
        if (highRiskCountEl) highRiskCountEl.textContent = highRisk;
        if (mostCommonLvlEl) mostCommonLvlEl.textContent = maxType;

        // NEW: Render Violator Summary
        renderViolatorSummary(studentCounts);
    };

    window.renderViolatorSummary = function(counts) {
        const body = document.getElementById('violatorSummaryBody');
        if (!body) return;
        body.innerHTML = '';

        // Convert to array and sort by count descending
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
            body.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">Chưa có dữ liệu</td></tr>';
            return;
        }

        sorted.forEach(([email, count]) => {
            // Find student info from the main table
            const row = Array.from(document.querySelectorAll('.log-table tbody tr')).find(r => {
                const emailEl = r.querySelector('.text-muted.small');
                return emailEl && emailEl.textContent === email;
            });
            if (!row) return;

            const nameEl = row.querySelector('.fw-bold');
            const avatarEl = row.querySelector('img');
            const name = nameEl ? nameEl.textContent : 'Học sinh';
            const avatar = avatarEl ? avatarEl.src : 'https://ui-avatars.com/api/?name=' + name;

            const riskLevel = count >= 5 ? '<span class="badge bg-danger">Nghiêm trọng</span>' :
                (count >= 3 ? '<span class="badge bg-warning text-dark">Cảnh báo</span>' :
                    '<span class="badge bg-info text-white">Nhẹ</span>');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <img src="${avatar}" style="width:30px; height:30px; border-radius:50%;">
                        <div>
                            <div class="fw-bold small">${name}</div>
                            <div class="text-muted" style="font-size:0.7rem;">${email}</div>
                        </div>
                    </div>
                </td>
                <td class="text-center"><span class="badge rounded-pill bg-light text-dark border px-3">${count} lỗi</span></td>
                <td>${riskLevel}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary rounded-pill px-3" style="font-size:0.75rem;"
                        onclick="quickFilter('${email}')">Xem chi tiết</button>
                </td>
            `;
            body.appendChild(tr);
        });
    };

    window.quickFilter = function(email) {
        const input = document.getElementById('studentSearchInput');
        if (input) input.value = email;
        filterByStudent();
        // Scroll to detail table
        const card = document.querySelector('.violation-card');
        if (card) card.scrollIntoView({ behavior: 'smooth' });
    };

    window.resetFilter = function() {
        const input = document.getElementById('studentSearchInput');
        if (input) input.value = '';
        filterByStudent();
    };

    window.filterByStudent = function() {
        const input = document.getElementById('studentSearchInput');
        if (!input) return;
        const filter = input.value.toLowerCase().trim();
        const rows = document.querySelectorAll('.log-table tbody tr');

        rows.forEach(row => {
            const nameEl = row.querySelector('.fw-bold');
            const emailEl = row.querySelector('.text-muted.small');
            if (nameEl && emailEl) {
                const name = nameEl.textContent.toLowerCase();
                const email = emailEl.textContent.toLowerCase();

                if (name.includes(filter) || email.includes(filter)) {
                    row.style.display = "";
                } else {
                    row.style.display = "none";
                }
            }
        });
    };
})();
