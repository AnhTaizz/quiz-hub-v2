function openTopicDetailsModal(topicId, topicName) {
    document.getElementById('topicModalTitle').innerText = 'Chủ đề: ' + topicName;
    const container = document.getElementById('topicModalBody');
    container.innerHTML = '';

    const matches = document.querySelectorAll(`.assigned-card[data-topic-id="${topicId}"]`);
    if (matches.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-folder-x fs-2 text-muted d-block mb-2"></i> Chưa có đề thi nào trong chủ đề này.</div>';
    } else {
        let html = '<div class="d-flex flex-column gap-3">';
        matches.forEach((el, idx) => {
            const titleEl = el.querySelector('.assigned-title');
            const titleText = titleEl ? titleEl.textContent : 'Đề thi';
            const id = `quizCollapse_${idx}`;

            const originalActionButtons = el.querySelector('.assigned-actions')?.innerHTML || '';
            const metaEl = el.querySelector('.assigned-meta')?.innerHTML || '';
            const badgeEl = el.querySelector('.badge-status')?.innerHTML || '';
            const topicBadgeEl = el.querySelector('.badge.bg-light')?.outerHTML || '';

            // Since we are in JS, we can't easily use Thymeleaf here, 
            // but we already updated the originalActionButtons in the DOM above.
            // The el.querySelector('.assigned-actions') will contain the updated button logic (either disabled button or link).

            html += `
            <div class="card border rounded-3 bg-white p-3 shadow-sm mb-2" style="border-color:#e2e8f0 !important;">
                <div class="d-flex justify-content-between align-items-center" style="cursor:pointer;" data-bs-toggle="collapse" data-bs-target="#${id}">
                    <div>
                        <span class="badge bg-primary bg-opacity-10 text-primary px-2 py-1 me-2 rounded" style="font-size:11px; font-weight:700;">${badgeEl || 'Đề thi'}</span>
                        ${topicBadgeEl}
                        <span class="fw-bold" style="font-size: 1.1rem; color:#1e1b4b;">${titleText}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-chevron-down fs-5 text-muted transition-all" style="transition: transform 0.3s;" id="chevron_${id}"></i>
                    </div>
                </div>
                <div id="${id}" class="collapse mt-3 pt-3 border-top" style="border-top:1px solid #f1f5f9 !important;">
                    <div class="mb-3" style="font-size:13px; color:#475569;">
                        ${metaEl}
                    </div>
                    <div class="d-flex gap-2">
                        ${originalActionButtons}
                    </div>
                </div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;

        matches.forEach((el, idx) => {
            const id = `quizCollapse_${idx}`;
            const collapseEl = document.getElementById(id);
            if (collapseEl) {
                collapseEl.addEventListener('show.bs.collapse', () => {
                    document.getElementById(`chevron_${id}`).style.transform = 'rotate(180deg)';
                });
                collapseEl.addEventListener('hide.bs.collapse', () => {
                    document.getElementById(`chevron_${id}`).style.transform = 'rotate(0deg)';
                });
            }
        });
    }

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('viewTopicQuizzesModal'));
    modal.show();
}
