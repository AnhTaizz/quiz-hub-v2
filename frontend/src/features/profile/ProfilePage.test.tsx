import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";
import { AuthProvider } from "@/auth/AuthProvider";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { profileApi } from "@/api/profile.api";
import type { UserProfileResponse } from "@/types/api";

vi.mock("@/api/profile.api", () => ({
  profileApi: { get: vi.fn(), update: vi.fn(), uploadAvatar: vi.fn(), changePassword: vi.fn() },
}));

const api = vi.mocked(profileApi);

const profile: UserProfileResponse = {
  id: 5,
  email: "ada@example.com",
  fullName: "Ada Lovelace",
  phone: null,
  avatarUrl: "/avatars/old.png",
  role: "STUDENT",
  isEnable: true,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>
          <MemoryRouter>
            <ProfilePage />
          </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("token", "t");
  localStorage.setItem(
    "user",
    JSON.stringify({ id: 5, email: "ada@example.com", fullName: "Ada Lovelace", role: "STUDENT", avatarUrl: "/avatars/old.png" }),
  );
  api.get.mockResolvedValue(profile);
  api.update.mockImplementation(async (payload) => ({ ...profile, ...payload }));
});

describe("ProfilePage", () => {
  it("loads the profile into the form and keeps the email read-only", async () => {
    renderPage();
    expect(await screen.findByLabelText("Full name")).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText("Email")).toBeDisabled();
  });

  it("does not save a blank name", async () => {
    const user = userEvent.setup();
    renderPage();
    const name = await screen.findByLabelText("Full name");
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/required/i);
    expect(api.update).not.toHaveBeenCalled();
  });

  it("always re-sends the current phone/avatar (the backend overwrites all three) and refreshes the stored user", async () => {
    const user = userEvent.setup();
    renderPage();
    const name = await screen.findByLabelText("Full name");
    await user.clear(name);
    await user.type(name, "Ada King");
    await user.type(screen.getByLabelText("Phone number"), "0123456789");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith({ fullName: "Ada King", phone: "0123456789", avatarUrl: "/avatars/old.png" }),
    );
    await waitFor(() => expect(JSON.parse(localStorage.getItem("user") ?? "{}").fullName).toBe("Ada King"));
    expect(localStorage.getItem("token")).toBe("t");
  });

  it("rejects a non-image before uploading anything", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await screen.findByLabelText("Full name");
    await user.upload(screen.getByLabelText("Choose a photo to upload"), new File(["x"], "evil.html", { type: "text/html" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/image file/i);
    expect(api.uploadAvatar).not.toHaveBeenCalled();
  });

  it("uploads a valid image, previews it, and applies it only on save", async () => {
    api.uploadAvatar.mockResolvedValue({ url: "/avatars/new.png" });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText("Full name");
    await user.upload(screen.getByLabelText("Choose a photo to upload"), new File(["x"], "me.png", { type: "image/png" }));

    await waitFor(() => expect(api.uploadAvatar).toHaveBeenCalled());
    expect(api.update).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: "/avatars/new.png" })),
    );
  });

  it("shows the backend's upload error as text", async () => {
    api.uploadAvatar.mockRejectedValue({ status: 400, message: "File ảnh không được vượt quá 5MB" });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText("Full name");
    await user.upload(screen.getByLabelText("Choose a photo to upload"), new File(["x"], "me.png", { type: "image/png" }));

    expect(await screen.findByText("File ảnh không được vượt quá 5MB")).toBeInTheDocument();
  });

  it("puts a wrong-current-password error (code 1011) on the current-password field", async () => {
    api.changePassword.mockRejectedValue({ status: 400, code: 1011, message: "Mật khẩu hiện tại không chính xác" });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Change password" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Current password"), "wrong-old");
    await user.type(screen.getByLabelText("New password"), "new-secret");
    await user.type(screen.getByLabelText("Confirm new password"), "new-secret");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(api.changePassword).toHaveBeenCalled());
    expect(await screen.findByText("Mật khẩu hiện tại không chính xác")).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    expect(api.changePassword).toHaveBeenCalledWith({
      oldPassword: "wrong-old",
      newPassword: "new-secret",
      confirmNewPassword: "new-secret",
    });
  });

  it("does not call the API for a too-short new password", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Change password" }));
    await user.type(screen.getByLabelText("Current password"), "old-secret");
    await user.type(screen.getByLabelText("New password"), "abc");
    await user.type(screen.getByLabelText("Confirm new password"), "abc");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText(/at least 6/)).toBeInTheDocument();
    expect(api.changePassword).not.toHaveBeenCalled();
  });
});
