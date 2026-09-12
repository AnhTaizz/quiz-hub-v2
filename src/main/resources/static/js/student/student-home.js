(function() {
    function updateTypoClock() {
        const now = new Date();

        // Xử lý Giờ
        let hours = now.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12; // Định dạng 12 giờ

        const hourStr = String(hours).padStart(2, '0');
        const minuteStr = String(now.getMinutes()).padStart(2, '0');

        const hEl = document.getElementById('t-hour');
        const mEl = document.getElementById('t-minute');
        const ampmEl = document.getElementById('t-ampm');

        if (hEl) hEl.innerText = hourStr;
        if (mEl) mEl.innerText = minuteStr;
        if (ampmEl) ampmEl.innerText = ampm;

        // Xử lý Ngày
        const dateEl = document.getElementById('t-date');
        if (dateEl) {
            const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            dateEl.innerText = now.toLocaleDateString('vi-VN', dateOptions);
        }
    }

    setInterval(updateTypoClock, 1000);
    document.addEventListener('DOMContentLoaded', updateTypoClock);
    // Invoke immediately in case DOM is already loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        updateTypoClock();
    }
})();
