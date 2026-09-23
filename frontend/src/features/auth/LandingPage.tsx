import { Navigate, Link } from "react-router";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import { PublicHeader } from "./PublicHeader";
import "./LandingPage.css";

const FEATURES = [
  { icon: "bi-magic", title: "Tạo đề thi dễ dàng", text: "Xây dựng ngân hàng câu hỏi và đề thi trực tuyến chỉ trong vài phút." },
  { icon: "bi-people-fill", title: "Quản lý lớp học", text: "Giao bài, theo dõi tiến độ và đồng hành cùng từng học viên." },
  { icon: "bi-bar-chart-fill", title: "Thống kê trực quan", text: "Kết quả được chấm tự động và trình bày rõ ràng, dễ theo dõi." },
  { icon: "bi-lightning-charge-fill", title: "Luyện tập linh hoạt", text: "Ôn tập theo chủ đề, trộn câu hỏi và học theo tốc độ của riêng bạn." },
];

export function LandingPage() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated && user) return <Navigate to={roleHomePath(user.role)} replace />;

  return (
    <div className="qh-landing">
      <PublicHeader />
      <main>
        <section className="qh-landing-hero">
          <div className="qh-landing-hero__glow qh-landing-hero__glow--one" />
          <div className="qh-landing-hero__glow qh-landing-hero__glow--two" />
          <div className="qh-landing-hero__copy">
            <span className="qh-landing-kicker"><i className="bi bi-stars" /> Nền tảng học tập thông minh</span>
            <h1>Học tốt hơn.<br /><span>Thi hiệu quả hơn.</span></h1>
            <p>QuizHub giúp giáo viên tạo đề, quản lý lớp học và giúp học viên luyện tập, chinh phục kiến thức mỗi ngày.</p>
            <div className="qh-landing-hero__actions">
              <Link to="/register" className="qh-landing-button qh-landing-button--primary">Bắt đầu miễn phí <i className="bi bi-arrow-right" /></Link>
              <a href="#features" className="qh-landing-button qh-landing-button--ghost"><i className="bi bi-play-circle" /> Khám phá QuizHub</a>
            </div>
            <div className="qh-landing-trust"><span><i className="bi bi-check-circle-fill" /> Miễn phí khởi đầu</span><span><i className="bi bi-check-circle-fill" /> Không cần thẻ tín dụng</span></div>
          </div>
          <div className="qh-landing-preview" aria-label="Xem trước bảng điều khiển QuizHub">
            <div className="qh-landing-preview__bar"><i /><i /><i /><span>quizhub.vn/dashboard</span></div>
            <div className="qh-landing-preview__body">
              <aside><b>QH</b><i /><i /><i /><i /></aside>
              <div className="qh-landing-preview__content">
                <p>Chào buổi sáng, Minh!</p><h2>Tổng quan học tập</h2>
                <div className="qh-landing-preview__stats"><span><b>12</b>Đề đã hoàn thành</span><span><b>8.6</b>Điểm trung bình</span><span><b>3</b>Bài đang chờ</span></div>
                <div className="qh-landing-preview__chart"><span /><span /><span /><span /><span /><span /></div>
              </div>
            </div>
          </div>
        </section>

        <section className="qh-landing-section" id="features">
          <span className="qh-landing-section__eyebrow">MỌI THỨ BẠN CẦN</span>
          <h2>Một nền tảng, trọn vẹn trải nghiệm học tập</h2>
          <p className="qh-landing-section__lead">Đơn giản cho người mới bắt đầu, đủ mạnh mẽ cho lớp học hiện đại.</p>
          <div className="qh-landing-features">{FEATURES.map((feature) => <article key={feature.title}><i className={`bi ${feature.icon}`} /><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
        </section>

        <section className="qh-landing-how" id="how-it-works">
          <div><span>01</span><h3>Tạo tài khoản</h3><p>Chọn vai trò học viên hoặc giáo viên.</p></div>
          <i className="bi bi-arrow-right" />
          <div><span>02</span><h3>Tham gia lớp học</h3><p>Nhập mã lớp hoặc tạo lớp học mới.</p></div>
          <i className="bi bi-arrow-right" />
          <div><span>03</span><h3>Bắt đầu học</h3><p>Làm bài, luyện tập và xem tiến độ.</p></div>
        </section>

        <section className="qh-landing-cta"><h2>Sẵn sàng nâng cấp trải nghiệm học tập?</h2><p>Tham gia QuizHub và bắt đầu ngay hôm nay.</p><Link to="/register">Tạo tài khoản miễn phí <i className="bi bi-arrow-right" /></Link></section>
      </main>
      <footer className="qh-landing-footer"><span><i className="bi bi-layers-fill" /> Quiz<span>Hub</span></span><p>© 2026 QuizHub. Học tập thông minh hơn mỗi ngày.</p></footer>
    </div>
  );
}
