import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentClassroomListPage } from "./StudentClassroomListPage";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { classroomApi } from "@/api/classroom.api";
import type { StudentClassroomSummary } from "@/types/api";

vi.mock("@/api/classroom.api", () => ({
  classroomApi: {
    list: vi.fn(),
    join: vi.fn(),
  },
}));

const api = vi.mocked(classroomApi);

const mockClassrooms: StudentClassroomSummary[] = [
  {
    id: 1,
    name: "Lớp Toán 12A1",
    description: "Lớp học toán nâng cao",
    teacherName: "Nguyễn Văn Thầy",
    imageUrl: null,
    joinStatus: "APPROVED",
    joinedAt: "2026-09-01T08:00:00",
    code: "MATH12",
  },
  {
    id: 2,
    name: "Lớp Lý 12A2",
    description: "Lớp học vật lý",
    teacherName: "Trần Thị Cô",
    imageUrl: "/covers/physics.png",
    joinStatus: "PENDING",
    joinedAt: "2026-09-10T10:00:00",
    code: "PHYS12",
  },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <StudentClassroomListPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue(mockClassrooms);
  api.join.mockResolvedValue("Đã gửi yêu cầu tham gia lớp học.");
});

describe("StudentClassroomListPage", () => {
  it("renders the hero and classroom cards with status badges", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Lớp học của tôi" })).toBeInTheDocument();
    expect(await screen.findByText("Lớp Toán 12A1")).toBeInTheDocument();
    expect(screen.getByText("Đã vào lớp")).toBeInTheDocument();
    expect(screen.getByText("Lớp Lý 12A2")).toBeInTheDocument();
    expect(screen.getByText("Chờ phê duyệt")).toBeInTheDocument();
  });

  it("opens the shared accessible modal when 'Tham gia lớp học' button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Lớp Toán 12A1");
    await user.click(screen.getByRole("button", { name: /Tham gia lớp học/i }));

    const dialog = await screen.findByRole("dialog", { name: "Tham gia lớp học" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("Mã lớp học")).toBeInTheDocument();
  });

  it("closes the join modal when pressing Escape or clicking Hủy", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Lớp Toán 12A1");
    await user.click(screen.getByRole("button", { name: /Tham gia lớp học/i }));

    expect(await screen.findByRole("dialog", { name: "Tham gia lớp học" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Tham gia lớp học" })).not.toBeInTheDocument();
  });

  it("submits the class code and closes modal on success", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Lớp Toán 12A1");
    await user.click(screen.getByRole("button", { name: /Tham gia lớp học/i }));

    await user.type(screen.getByLabelText("Mã lớp học"), "MATH12");
    await user.click(screen.getByRole("button", { name: "Tham gia lớp" }));

    await waitFor(() => expect(api.join).toHaveBeenCalledWith("MATH12"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Tham gia lớp học" })).not.toBeInTheDocument(),
    );
  });
});
