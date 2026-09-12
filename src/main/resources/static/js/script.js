// ─── Global: Logout (Moved to header fragment) ────────────────


document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    // ─── 1. Header scroll ───────────────────────────────────────
    const header = document.getElementById('header');
    if (header) {
        const onScroll = () => {
            if (window.scrollY > 30) {
                header.classList.add('header-scrolled');
            } else {
                header.classList.remove('header-scrolled');
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // ─── 2. Mobile nav toggle ────────────────────────────────────
    const toggleBtn = document.getElementById('mobile-nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    if (toggleBtn && navMenu) {
        toggleBtn.addEventListener('click', () => {
            navMenu.classList.toggle('nav-open');
            const icon = toggleBtn.querySelector('i');
            icon.classList.toggle('bi-list');
            icon.classList.toggle('bi-x');
        });
        // Close on link click
        navMenu.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => {
                navMenu.classList.remove('nav-open');
                const icon = toggleBtn.querySelector('i');
                icon.classList.add('bi-list');
                icon.classList.remove('bi-x');
            });
        });
    }

    // ─── 3. Smooth scroll ───────────────────────────────────────
    document.querySelectorAll('a.scrollto, a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const hash = this.getAttribute('href');
            if (!hash || hash === '#' || !hash.startsWith('#')) return;
            const target = document.querySelector(hash);
            if (!target) return;
            e.preventDefault();
            const offset = header ? header.offsetHeight : 68;
            window.scrollTo({
                top: target.getBoundingClientRect().top + window.pageYOffset - offset,
                behavior: 'smooth'
            });
        });
    });

    // ─── 4. Active nav link ─────────────────────────────────────
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.navbar a');
    window.addEventListener('scroll', () => {
        const scrollY = window.pageYOffset;
        sections.forEach(section => {
            const top = section.offsetTop - (header ? header.offsetHeight : 68) - 60;
            const bottom = top + section.offsetHeight;
            const id = section.getAttribute('id');
            navLinks.forEach(link => {
                if (link.getAttribute('href') === `#${id}`) {
                    link.classList.toggle('active', scrollY >= top && scrollY < bottom);
                }
            });
        });
    }, { passive: true });

    // ─── 5. Reveal on scroll (IntersectionObserver) ─────────────
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = parseFloat(entry.target.style.transitionDelay || '0') * 1000;
                setTimeout(() => entry.target.classList.add('visible'), delay);
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => io.observe(el));

    // ─── 6. Scroll-to-top button ────────────────────────────────
    const scrollTop = document.getElementById('scrolltop');
    if (scrollTop) {
        window.addEventListener('scroll', () => {
            scrollTop.style.display = window.scrollY > 400 ? 'block' : 'none';
        }, { passive: true });
    }

    // ─── 7. Khởi tạo Slider, Đồng bộ Nút bấm & Phím tắt ─────────────
    const heroCarouselElement = document.getElementById('heroCarousel');
    const slideButtons = document.querySelectorAll('.slide-btn');

    if (heroCarouselElement) {
        // Khởi tạo Bootstrap Carousel bằng Javascript để ép nó chạy NGAY LẬP TỨC
        const carouselInstance = new bootstrap.Carousel(heroCarouselElement, {
            interval: 3600,     // 4.5 giây đổi slide 1 lần
            ride: 'carousel',   // Kích hoạt auto-play
            pause: 'hover'      // Tạm dừng khi rê chuột vào ảnh (chỉnh 'false' nếu muốn nó chạy liên tục không dừng)
        });

        // Đồng bộ các nút bấm bên trái khi slide tự động chuyển
        if (slideButtons.length > 0) {
            heroCarouselElement.addEventListener('slide.bs.carousel', function (event) {
                slideButtons.forEach(btn => btn.classList.remove('active'));
                if (slideButtons[event.to]) {
                    slideButtons[event.to].classList.add('active');
                }
            });
        }

        // Lắng nghe sự kiện bấm phím Mũi tên Trái/Phải trên toàn bộ trang web
        document.addEventListener('keydown', function (event) {
            // Không trượt slide nếu người dùng đang gõ chữ trong ô input nào đó
            if (event.target.tagName.toLowerCase() === 'input' || event.target.tagName.toLowerCase() === 'textarea') {
                return;
            }

            if (event.key === 'ArrowLeft') {
                carouselInstance.prev(); // Sang trái
            } else if (event.key === 'ArrowRight') {
                carouselInstance.next(); // Sang phải
            }
        });
    }

    // ─── 8. Authentication Management ───────────────────────────
    const checkAuthState = () => {
        const userJson = localStorage.getItem('user') || sessionStorage.getItem('user');
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const navUl = document.querySelector('#navbar ul');

        if (userJson && token && navUl) {
            const user = JSON.parse(userJson);

            // Tìm các nút Login/Signup cũ để thay thế
            const loginBtn = navUl.querySelector('.nav-btn-login')?.parentElement;
            const signupBtn = navUl.querySelector('.nav-btn-signup')?.parentElement;

            // Nếu không có nút Login/Signup → đang ở trang dashboard (đã có user UI)
            // Không thêm dropdown nữa để tránh bị trùng
            if (!loginBtn && !signupBtn) return;

            if (loginBtn) loginBtn.remove();
            if (signupBtn) signupBtn.remove();

            // Thêm dropdown User hoặc nút Logout
            const userLi = document.createElement('li');
            userLi.className = 'dropdown ms-lg-3';
            userLi.innerHTML = `
                <a href="#" class="nav-btn-user" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="bi bi-person-circle"></i>
                    <span class="d-none d-md-inline">${user.fullName}</span>
                    <i class="bi bi-chevron-down ms-1" style="font-size: 12px;"></i>
                </a>
                <ul class="dropdown-menu dropdown-menu-end shadow" style="border:none; border-radius:12px; margin-top:10px;">
                    <li><a class="dropdown-item py-2" href="/profile"><i class="bi bi-person me-2"></i> Hồ sơ cá nhân</a></li>
                    ${user.role === 'ADMIN' ? '<li><a class="dropdown-item py-2" href="/admin"><i class="bi bi-speedometer2 me-2"></i> Quản trị</a></li>' : ''}
                    ${user.role === 'TEACHER' ? '<li><a class="dropdown-item py-2" href="/teacher"><i class="bi bi-journal-text me-2"></i> Giảng dạy</a></li>' : ''}
                    ${user.role === 'STUDENT' ? '<li><a class="dropdown-item py-2" href="/student"><i class="bi bi-book me-2"></i> Bảng điều khiển</a></li>' : ''}
                    <li><a class="dropdown-item py-2" href="#" data-bs-toggle="modal" data-bs-target="#changePasswordModal"><i class="bi bi-key me-2"></i> Đổi mật khẩu</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item py-2 text-danger" href="#" id="logoutBtn"><i class="bi bi-box-arrow-right me-2"></i> Đăng xuất</a></li>
                </ul>
            `;
            navUl.appendChild(userLi);

            // Xử lý sự kiện đăng xuất
            document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                document.cookie = 'jwt=; path=/; max-age=0;';
                window.location.href = '/login';
            });

            // Xử lý toggle dropdown trên mobile (đơn giản)
            userLi.querySelector('.nav-btn-user').addEventListener('click', (e) => {
                if (window.innerWidth < 992) {
                    e.preventDefault();
                    userLi.classList.toggle('active');
                }
            });
        }
    };

    // Khởi chạy kiểm tra trạng thái ngay lập tức
    checkAuthState();

    // ─── 9. Global Fetch Wrapper (Tự động đính kèm Token) ──────────
    // Ghi đè window.fetch để tự động thêm header Authorization nếu có token
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        let [resource, config] = args;

        // Nếu là gọi đến API của chúng ta (bắt đầu bằng /api/)
        if (typeof resource === 'string' && resource.startsWith('/api/')) {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (token) {
                if (!config) config = {};
                if (!config.headers) config.headers = {};

                // Nếu header chưa có Authorization thì mới thêm
                if (!config.headers['Authorization']) {
                    config.headers['Authorization'] = `Bearer ${token}`;
                }
            }
        }

        const response = await originalFetch(resource, config);

        // Nếu API trả về 401 (Unauthorized) - Token hết hạn hoặc không hợp lệ
        if (response.status === 401 && !resource.includes('/api/auth/login')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            document.cookie = 'jwt=; path=/; max-age=0;';
            window.location.href = '/login';
        }

        return response;
    };
});

// ─── Nav Dropdown "Kho của tôi" ─────────────────────────────────
function toggleNavDropdown(event, el) {
    event.preventDefault();
    event.stopPropagation();
    const li = el.closest('.nav-item-dropdown');
    const isOpen = li.classList.contains('open');

    // Đóng tất cả các dropdown đang mở khác
    document.querySelectorAll('.nav-item-dropdown.open').forEach(d => d.classList.remove('open'));

    if (!isOpen) {
        li.classList.add('open');
    }
}

// Đóng dropdown khi click ra ngoài
document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-item-dropdown')) {
        document.querySelectorAll('.nav-item-dropdown.open').forEach(d => d.classList.remove('open'));
    }
});

