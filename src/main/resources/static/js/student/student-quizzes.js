document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('quizSearch');
    const classFilter = document.getElementById('classFilter');
    const cards = document.querySelectorAll('.quiz-container');

    function applyFilters() {
        try {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const classId = classFilter.value;
            
            cards.forEach(card => {
                try {
                    const titleEl = card.querySelector('.quiz-title-link');
                    const title = titleEl ? titleEl.innerText.toLowerCase() : "";
                    const cardClassId = card.getAttribute('data-classroom-id');
                    
                    const matchesSearch = title.includes(searchTerm);
                    const matchesClass = classId === 'all' || cardClassId === classId;
                    
                    if (matchesSearch && matchesClass) {
                        card.style.display = 'block';
                        card.style.setProperty('display', 'block', 'important');
                    } else {
                        card.style.display = 'none';
                        card.style.setProperty('display', 'none', 'important');
                    }
                } catch (e) {
                    console.warn("Lỗi khi lọc thẻ bài thi:", e);
                    card.style.display = 'block'; // Hiện thị nếu lỗi để không bị mất bài
                }
            });
        } catch (err) {
            console.error('Filter error:', err);
        }
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (classFilter) classFilter.addEventListener('change', applyFilters);
    
    applyFilters();
});
