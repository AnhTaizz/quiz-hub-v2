async function resumePractice(practiceId, isRandom, practiceLimit, practiceOffset, categoryId, categoryName) {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        let data = null;
        sessionStorage.removeItem('practice_user_answers');
        sessionStorage.removeItem('practice_answered_correctly');
        sessionStorage.removeItem('practice_confirmed_answers');
        sessionStorage.removeItem('practice_current_index');
        sessionStorage.removeItem('practice_is_shuffled');
        sessionStorage.removeItem('practice_questions');

        if (isRandom) {
            const res = await fetch(`/api/student/practice/history/detail?id=${practiceId}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) throw new Error('Không thể tải bài luyện tập');
            data = await res.json();
            const questions = data.details.map(d => ({
                id: d.questionId,
                text: d.questionText,
                type: d.questionType,
                level: d.questionLevel,
                answers: d.answers,
                selectedAnswerIds: d.selectedAnswerIds || null,
                selectedText: d.selectedText || null,
                isCorrect: d.isCorrect !== undefined ? d.isCorrect : null
            }));
            sessionStorage.setItem('practice_questions', JSON.stringify(questions));
            sessionStorage.setItem('practice_id', practiceId);
            sessionStorage.removeItem(`practice_is_shuffled_${practiceId}`);
        } else {
            const limit = practiceLimit || 10;
            const offset = practiceOffset || 0;
            const payload = { categoryId: categoryId, limit, offset, isRandom: false, forceNew: false, practiceId: practiceId };
            const res = await fetch('/api/student/practice/start', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Không thể tải bài luyện tập');
            data = await res.json();
            sessionStorage.setItem('practice_questions', JSON.stringify(data.questions));
            sessionStorage.setItem('practice_id', data.practiceId);
            sessionStorage.removeItem(`practice_is_shuffled_${data.practiceId}`);
        }

        sessionStorage.setItem('practice_category_id', categoryId);
        sessionStorage.setItem('practice_category_name', categoryName);
        
        const finalId = (data && data.practiceId) ? data.practiceId : practiceId;
        let currentSettings = JSON.parse(sessionStorage.getItem(`practice_settings_${finalId}`) || 'null');
        if (!currentSettings) {
            currentSettings = JSON.parse(sessionStorage.getItem('practice_settings') || 'null');
        }
        if (!currentSettings) {
            currentSettings = { showAnswer: true, shuffle: false, displayMode: 'sequential' };
        }
        sessionStorage.setItem('practice_settings', JSON.stringify(currentSettings));
        sessionStorage.setItem(`practice_settings_${finalId}`, JSON.stringify(currentSettings));
        
        if (typeof showToast === 'function') {
            showToast('Tiếp tục bài luyện tập, hãy cố lên! 💪', 'ok');
            setTimeout(() => { window.location.href = '/student/practice/play'; }, 800);
        } else {
            window.location.href = '/student/practice/play';
        }
    } catch (e) {
        if (typeof showToast === 'function') {
            showToast(e.message, 'err');
        } else {
            showToast(e.message, 'error');
        }
    }
}
