/**
 * teacher-ai-generate.js
 * Logic tính năng tạo câu hỏi bằng AI (Text-to-Quiz)
 * Luồng: Mở Modal -> Nhập -> Gọi API -> Hiển thị Preview -> Giáo viên sửa -> Lưu
 */

// Trạng thái nội bộ
let aiGeneratedQuestions = [];   // Lưu danh sách câu hỏi AI trả về
let aiIsPreviewMode = false;     // Đang ở màn hình xem trước hay không?
let aiModal = null;              // Tham chiếu đến Bootstrap Modal

// =============================================
// Khởi tạo: Điền danh sách Category vào select
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    aiModal = new bootstrap.Modal(document.getElementById('aiGenerateModal'));
    populateAiCategoryDropdown();
});

function populateAiCategoryDropdown() {
    const select = document.getElementById('ai-category');
    if (!select) return;
    const categories = window.myCategories || [];
    // Xóa options cũ (giữ lại option đầu tiên "-- Không chọn --")
    while (select.options.length > 1) select.remove(1);
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        select.appendChild(opt);
    });
}

// =============================================
// Mở / Đóng Modal
// =============================================
function openAiGenerateModal() {
    resetAiModal();
    aiModal.show();
}

function closeAiModal() {
    // Nếu đang xem Preview và chưa lưu → hỏi xác nhận trước khi đóng
    if (aiIsPreviewMode && aiGeneratedQuestions.length > 0) {
        const confirmed = confirm(
            '⚠️ Bạn chưa lưu các câu hỏi này vào kho!\n\nBạn có chắc chắn muốn đóng và hủy kết quả không?'
        );
        if (!confirmed) return;
    }
    aiModal.hide();
    resetAiModal();
}

function resetAiModal() {
    aiGeneratedQuestions = [];
    aiIsPreviewMode = false;
    showAiStep('input');
    document.getElementById('ai-input-text').value = '';
    document.getElementById('ai-num-questions').value = '5';
    document.getElementById('ai-level').value = 'MEDIUM';
    document.getElementById('ai-category').value = '';
}

// =============================================
// Chuyển đổi giữa các bước (Step 1 / Step 2 / Loading)
// =============================================
function showAiStep(step) {
    document.getElementById('ai-step-input').style.display  = step === 'input'   ? 'block' : 'none';
    document.getElementById('ai-step-preview').style.display = step === 'preview' ? 'block' : 'none';
    document.getElementById('ai-loading').style.display     = step === 'loading' ? 'block' : 'none';

    document.getElementById('ai-footer-input').style.display   = step === 'input'   ? 'flex'  : 'none';
    document.getElementById('ai-footer-preview').style.display = step === 'preview' ? 'flex'  : 'none';

    if (step === 'loading') {
        document.getElementById('ai-footer-input').style.display   = 'none';
        document.getElementById('ai-footer-preview').style.display = 'none';
    }

    aiIsPreviewMode = (step === 'preview');
}

function backToAiInput() {
    const confirmed = confirm('Bạn muốn tạo lại? Kết quả hiện tại sẽ bị xóa.');
    if (!confirmed) return;
    aiGeneratedQuestions = [];
    showAiStep('input');
}

// =============================================
// Gọi Backend API để tạo câu hỏi
// =============================================
async function submitAiGenerate() {
    const text = document.getElementById('ai-input-text').value.trim();
    const numberOfQuestions = parseInt(document.getElementById('ai-num-questions').value);
    const level = document.getElementById('ai-level').value;
    const categoryId = document.getElementById('ai-category').value || null;

    // Validate đầu vào phía client
    if (!text) {
        showToast('Vui lòng nhập nội dung bài giảng hoặc chủ đề.', 'warning');
        return;
    }
    if (!numberOfQuestions || numberOfQuestions < 1 || numberOfQuestions > 50) {
        showToast('Số câu hỏi phải từ 1 đến 50.', 'warning');
        return;
    }

    showAiStep('loading');

    try {
        const payload = {
            text: text,
            numberOfQuestions: numberOfQuestions,
            level: level,
            categoryId: categoryId ? parseInt(categoryId) : null
        };

        const response = await fetch('/api/v1/ai/generate-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Lỗi HTTP ${response.status}`);
        }

        const data = await response.json();
        aiGeneratedQuestions = data.result || [];

        if (aiGeneratedQuestions.length === 0) {
            throw new Error('AI không trả về câu hỏi nào. Vui lòng thử lại với nội dung khác.');
        }

        renderAiPreview(aiGeneratedQuestions);
        showAiStep('preview');
        document.getElementById('ai-preview-count').textContent = aiGeneratedQuestions.length;
        showToast(`✅ AI đã tạo thành công ${aiGeneratedQuestions.length} câu hỏi!`, 'success');

    } catch (err) {
        showAiStep('input');
        showToast(`❌ ${err.message}`, 'error');
    }
}

// =============================================
// Render bảng Preview câu hỏi
// =============================================
function renderAiPreview(questions) {
    const container = document.getElementById('ai-preview-container');
    container.innerHTML = '';

    questions.forEach((q, qIdx) => {
        const levelBadgeColor = { EASY: '#22c55e', MEDIUM: '#f59e0b', HARD: '#ef4444' };
        const levelLabel = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' };
        const level = q.level || 'MEDIUM';

        const card = document.createElement('div');
        card.className = 'ai-question-card';
        card.style.cssText = `background: white; border-radius: 14px; padding: 18px 22px; 
                               margin-bottom: 14px; border: 1.5px solid #e2e8f0;
                               box-shadow: 0 2px 8px rgba(0,0,0,0.05);`;

        // Header câu hỏi
        const qHeader = document.createElement('div');
        qHeader.style.cssText = 'display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px;';
        qHeader.innerHTML = `
            <span style="min-width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #4f46e5);
                          color: white; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; justify-content: center;">
                ${qIdx + 1}
            </span>
            <div style="flex: 1;">
                <div contenteditable="true" 
                     data-q-idx="${qIdx}" data-field="text"
                     oninput="syncAiField(this, ${qIdx}, 'text')"
                     style="font-weight: 600; color: #1e293b; font-size: 0.95rem; 
                            min-height: 24px; outline: none; border-bottom: 1.5px dashed transparent;
                            border-radius: 4px; padding: 2px 4px;"
                     onmouseover="this.style.borderBottomColor='#7c3aed'"
                     onmouseout="this.style.borderBottomColor='transparent'"
                     onfocus="this.style.borderBottomColor='#7c3aed'; this.style.background='#faf5ff'"
                     onblur="this.style.background='transparent'"
                     >${escapeHtml(q.text)}</div>
                <span style="font-size: 0.72rem; font-weight: 700; margin-top: 4px; display: inline-block;
                              padding: 2px 8px; border-radius: 20px; color: white;
                              background-color: ${levelBadgeColor[level]};">
                    ${levelLabel[level]}
                </span>
            </div>`;
        card.appendChild(qHeader);

        // Danh sách đáp án
        const answerList = document.createElement('div');
        answerList.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding-left: 38px;';
        (q.answers || []).forEach((ans, aIdx) => {
            const isCorrect = ans.correct === true || ans.isCorrect === true;
            const row = document.createElement('div');
            row.style.cssText = `display: flex; align-items: center; gap: 10px; padding: 8px 12px; 
                                  border-radius: 10px; border: 1.5px solid ${isCorrect ? '#bbf7d0' : '#f1f5f9'};
                                  background: ${isCorrect ? '#f0fdf4' : '#ffffff'};`;
            row.innerHTML = `
                <span style="font-size: 0.8rem; font-weight: 700; width: 20px; text-align: center;
                              color: ${isCorrect ? '#16a34a' : '#94a3b8'};">
                    ${isCorrect ? '✓' : String.fromCharCode(65 + aIdx)}
                </span>
                <div contenteditable="true"
                     data-q-idx="${qIdx}" data-a-idx="${aIdx}" data-field="answer"
                     oninput="syncAiAnswerField(this, ${qIdx}, ${aIdx})"
                     style="flex: 1; font-size: 0.88rem; color: #374151; outline: none;
                            border-bottom: 1.5px dashed transparent; border-radius: 4px; padding: 1px 3px;"
                     onmouseover="this.style.borderBottomColor='#7c3aed'"
                     onmouseout="this.style.borderBottomColor='transparent'"
                     onfocus="this.style.borderBottomColor='#7c3aed'; this.style.background='#faf5ff'"
                     onblur="this.style.background='transparent'"
                     >${escapeHtml(ans.text)}</div>`;
            answerList.appendChild(row);
        });
        card.appendChild(answerList);
        container.appendChild(card);
    });
}

// =============================================
// Sync inline edits vào aiGeneratedQuestions array
// =============================================
function syncAiField(el, qIdx, field) {
    if (field === 'text') aiGeneratedQuestions[qIdx].text = el.innerText.trim();
}
function syncAiAnswerField(el, qIdx, aIdx) {
    if (aiGeneratedQuestions[qIdx] && aiGeneratedQuestions[qIdx].answers[aIdx]) {
        aiGeneratedQuestions[qIdx].answers[aIdx].text = el.innerText.trim();
    }
}

// =============================================
// Lưu tất cả câu hỏi vào kho
// =============================================
async function saveAiQuestions() {
    if (!aiGeneratedQuestions || aiGeneratedQuestions.length === 0) return;

    const btn = document.getElementById('btn-ai-save');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Đang lưu...';

    let successCount = 0;
    let failCount = 0;

    for (const q of aiGeneratedQuestions) {
        try {
            // Chuẩn hoá cấu trúc trước khi gửi lên API câu hỏi hiện có
            const payload = {
                text: q.text,
                type: q.type || 'SINGLE_CHOICE',
                level: q.level || 'MEDIUM',
                categoryId: q.categoryId || null,
                answers: (q.answers || []).map(a => ({
                    text: a.text,
                    isCorrect: a.correct === true || a.isCorrect === true
                }))
            };

            const resp = await fetch('/api/teacher/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.ok) successCount++;
            else failCount++;
        } catch {
            failCount++;
        }
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-cloud-upload-fill me-2"></i>Lưu vào kho';

    if (failCount === 0) {
        showToast(`✅ Đã lưu thành công ${successCount} câu hỏi vào kho!`, 'success');
        aiIsPreviewMode = false;   // Đánh dấu đã lưu, không cần confirm khi đóng
        aiModal.hide();
        resetAiModal();
        // Reload danh sách câu hỏi
        if (typeof triggerSearch === 'function') triggerSearch();
    } else {
        showToast(`⚠️ Lưu được ${successCount} câu, thất bại ${failCount} câu. Vui lòng thử lại.`, 'warning');
    }
}

// =============================================
// Tiện ích
// =============================================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Dùng hàm showToast đã có sẵn trong hệ thống.
// Nếu chưa tồn tại thì fallback ra console.
if (typeof showToast === 'undefined') {
    window.showToast = function(msg, type) {
        console.log(`[TOAST] [${type}] ${msg}`);
    };
}
