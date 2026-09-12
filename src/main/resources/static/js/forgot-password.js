/* ── State ── */
let currentStep = 1;
let userEmail = '';
let otpVerified = false;
let countdownTimer = null;

/* ── Step Navigation ── */
function goToStep(n) {
    document.querySelectorAll('.fp-step').forEach(el => el.classList.remove('active'));
    document.getElementById('step' + n).classList.add('active');
    currentStep = n;
    updateProgress(n);
}

function updateProgress(step) {
    for (let i = 1; i <= 3; i++) {
        const sc = document.getElementById('sc' + i);
        const sl = document.getElementById('sl' + i);
        sc.className = 'step-circle';
        sl.className = 'step-label';
        if (i < step) {
            sc.classList.add('done');
            sc.innerHTML = '<i class="bi bi-check-lg" style="font-size:14px;"></i>';
            sl.classList.add('done');
        } else if (i === step) {
            sc.classList.add('active');
            sc.textContent = i;
            sl.classList.add('active');
        } else {
            sc.textContent = i;
        }
    }
    if (document.getElementById('line1'))
        document.getElementById('line1').className = 'step-line' + (step > 1 ? ' done' : '');
    if (document.getElementById('line2'))
        document.getElementById('line2').className = 'step-line' + (step > 2 ? ' done' : '');
}

/* ── STEP 1: Gửi OTP ── */
document.getElementById('emailForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('fpEmail').value.trim();
    const btn = document.getElementById('sendOtpBtn');
    const txt = document.getElementById('sendOtpText');
    const errEl = document.getElementById('emailError');
    errEl.style.display = 'none';

    btn.disabled = true;
    txt.textContent = 'Đang gửi...';

    try {
        const res = await fetch('/api/auth/forgot-password?email=' + encodeURIComponent(email), {
            method: 'POST'
        });
        if (res.ok) {
            userEmail = email;
            document.getElementById('displayEmail').textContent = email;
            showToast('Mã OTP đã được gửi đến email của bạn!', 'success');
            goToStep(2);
            startCountdown();
            setTimeout(() => document.getElementById('otp0').focus(), 100);
        } else {
            const data = await res.json().catch(() => ({}));
            errEl.textContent = data.message || 'Email không tồn tại trong hệ thống.';
            errEl.style.display = 'block';
        }
    } catch (err) {
        showToast('Có lỗi xảy ra. Vui lòng thử lại.', 'error');
    } finally {
        btn.disabled = false;
        txt.textContent = 'Gửi mã OTP';
    }
});

/* ── OTP Input Behavior ── */
const otpInputs = document.querySelectorAll('.otp-input');
otpInputs.forEach((inp, idx) => {
    inp.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '');
        this.classList.toggle('filled', this.value.length > 0);
        if (this.value && idx < 5) otpInputs[idx + 1].focus();
    });
    inp.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !this.value && idx > 0) otpInputs[idx - 1].focus();
    });
    inp.addEventListener('paste', function(e) {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'');
        paste.split('').slice(0,6).forEach((ch, i) => {
            if (otpInputs[i]) { otpInputs[i].value = ch; otpInputs[i].classList.add('filled'); }
        });
        otpInputs[Math.min(paste.length, 5)].focus();
    });
});

function getOtpValue() {
    return [...otpInputs].map(i => i.value).join('');
}

/* ── STEP 2: Xác thực OTP ── */
async function verifyOtp() {
    const otp = getOtpValue();
    if (otp.length < 6) {
        showToast('Vui lòng nhập đủ 6 chữ số OTP.', 'error');
        otpInputs.forEach(i => i.classList.add('error'));
        return;
    }
    otpInputs.forEach(i => i.classList.remove('error'));

    const btn = document.getElementById('verifyOtpBtn');
    const txt = document.getElementById('verifyOtpText');
    btn.disabled = true;
    txt.textContent = 'Đang kiểm tra...';

    /* Backend chưa có endpoint riêng verify OTP trước khi reset,
       nên ta lưu OTP lại và sẽ gửi cùng lúc ở bước 3 */
    /* Nếu bạn muốn verify trước: gọi /api/auth/verify-otp */
    otpVerified = true;
    showToast('Xác thực thành công!', 'success');
    goToStep(3);
    clearInterval(countdownTimer);

    btn.disabled = false;
    txt.textContent = 'Xác thực';
}

/* ── Countdown ── */
function startCountdown() {
    let secs = 60;
    const el = document.getElementById('countdown');
    const link = document.getElementById('resendLink');
    link.classList.add('disabled');
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        secs--;
        el.textContent = secs;
        if (secs <= 0) {
            clearInterval(countdownTimer);
            link.classList.remove('disabled');
            link.innerHTML = 'Gửi lại';
        }
    }, 1000);
}

async function resendOtp() {
    document.getElementById('resendLink').classList.add('disabled');
    document.getElementById('resendLink').innerHTML = 'Gửi lại (<span id="countdown">60</span>s)';
    otpInputs.forEach(i => { i.value=''; i.classList.remove('filled','error'); });
    try {
        await fetch('/api/auth/forgot-password?email=' + encodeURIComponent(userEmail), { method: 'POST' });
        showToast('Mã OTP mới đã được gửi!', 'success');
        startCountdown();
    } catch { showToast('Không thể gửi lại. Thử lại sau.', 'error'); }
}

/* ── STEP 3: Reset Password ── */
document.getElementById('resetForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('confirmPassword').value;
    const newPwErr = document.getElementById('newPwError');
    const confirmPwErr = document.getElementById('confirmPwError');
    newPwErr.style.display = 'none';
    confirmPwErr.style.display = 'none';

    if (newPw.length < 6) {
        newPwErr.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.';
        newPwErr.style.display = 'block'; return;
    }
    if (newPw !== confirmPw) {
        confirmPwErr.textContent = 'Mật khẩu xác nhận không khớp.';
        confirmPwErr.style.display = 'block'; return;
    }

    const btn = document.getElementById('resetBtn');
    const txt = document.getElementById('resetBtnText');
    btn.disabled = true;
    txt.textContent = 'Đang xử lý...';

    try {
        const otp = getOtpValue();
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, otp: otp, newPassword: newPw, confirmPassword: confirmPw })
        });
        if (res.ok) {
            goToStep(4);
            // Ẩn step progress ở bước success
            document.getElementById('stepProgress').style.display = 'none';
        } else {
            const data = await res.json().catch(() => ({}));
            showToast(data.message || 'OTP không hợp lệ hoặc đã hết hạn.', 'error');
        }
    } catch { showToast('Có lỗi xảy ra. Vui lòng thử lại.', 'error'); }
    finally { btn.disabled = false; txt.textContent = 'Đặt lại mật khẩu'; }
});

/* ── Password Strength ── */
function checkStrength(val) {
    const bar = document.getElementById('strengthBar');
    const label = document.getElementById('strengthLabel');
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const levels = [
        { w: '20%', bg: '#f87171', lbl: 'Rất yếu' },
        { w: '40%', bg: '#fb923c', lbl: 'Yếu' },
        { w: '60%', bg: '#facc15', lbl: 'Trung bình' },
        { w: '80%', bg: '#4ade80', lbl: 'Mạnh' },
        { w: '100%', bg: '#22c55e', lbl: 'Rất mạnh' },
    ];
    const lvl = levels[Math.max(0, score - 1)];
    bar.style.width = val ? lvl.w : '0';
    bar.style.background = lvl.bg;
    label.textContent = val ? lvl.lbl : '';
    label.style.color = lvl.bg;
}

/* ── Toggle Password Visibility ── */
function togglePwd(inputId, iconId) {
    const inp = document.getElementById(inputId);
    const ico = document.getElementById(iconId);
    if (inp.type === 'password') {
        inp.type = 'text';
        ico.classList.replace('bi-eye', 'bi-eye-slash');
    } else {
        inp.type = 'password';
        ico.classList.replace('bi-eye-slash', 'bi-eye');
    }
}

/* ── Toast ── */
function showToast(msg, type = 'success') {
    if (type === 'error') toast.error(msg);
    else if (type === 'warning') toast.warning(msg);
    else toast.success(msg);
}
