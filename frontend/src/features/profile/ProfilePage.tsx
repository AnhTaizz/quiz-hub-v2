import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { profileApi } from "@/api/profile.api";
import { isApiError } from "@/api/httpClient";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import type { Role, UserProfileResponse } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useToast } from "@/components/feedback/ToastProvider";
import { AvatarPreview } from "./AvatarPreview";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { validateAvatarFile, validateProfile } from "./profileValidation";
import "./ProfilePage.css";

const ROLE_LABEL: Record<Role, string> = { STUDENT: "Student", TEACHER: "Teacher", ADMIN: "Administrator" };

export function ProfilePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => profileApi.get(signal),
  });

  return (
    <div className="qh-profile-page">
      <ProfileHeader role={data?.role} />
      <main className="qh-profile-main">
        <h1 className="qh-profile-title">Your profile</h1>
        {isLoading && <Spinner label="Loading profile" />}
        {isError && <ErrorState message="Could not load your profile." onRetry={() => void refetch()} />}
        {/* key: re-seed the form if a different account's profile is ever loaded */}
        {data && <ProfileForm key={data.id} profile={data} />}
      </main>
    </div>
  );
}

function ProfileHeader({ role }: { role: Role | undefined }) {
  const { user, logout } = useAuth();
  const effectiveRole = role ?? user?.role ?? "STUDENT";
  const home = roleHomePath(effectiveRole);

  return (
    <header className="qh-profile-header">
      <span className="qh-profile-brand">QuizHub</span>
      <nav className="qh-profile-header__actions" aria-label="Profile navigation">
        {/* Student dashboard is a React route; teacher/admin dashboards are still server-rendered (full page load). */}
        {effectiveRole === "STUDENT" ? (
          <Link to={home} className="qh-button qh-button--secondary">
            Back to dashboard
          </Link>
        ) : (
          <a href={home} className="qh-button qh-button--secondary">
            Back to dashboard
          </a>
        )}
        <Button variant="ghost" type="button" onClick={logout}>
          Log out
        </Button>
      </nav>
    </header>
  );
}

function ProfileForm({ profile }: { profile: UserProfileResponse }) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl);
  const [fullNameError, setFullNameError] = useState<string | undefined>();
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { updateUser } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const upload = useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file),
    onSuccess: (result) => {
      // The backend only stores the file; the profile is not updated until Save (same as the legacy page).
      setAvatarUrl(result.url);
      showToast("Photo uploaded. Save your profile to apply it.", "info");
    },
    onError: (error) => setAvatarError(isApiError(error) ? error.message : "Could not upload the photo."),
  });

  const save = useMutation({
    // The backend overwrites all three fields on every update, so the current avatar/phone are always re-sent.
    mutationFn: () =>
      profileApi.update({ fullName: fullName.trim(), phone: phone.trim() === "" ? null : phone.trim(), avatarUrl }),
    onSuccess: (updated) => {
      updateUser({ fullName: updated.fullName, avatarUrl: updated.avatarUrl });
      queryClient.setQueryData(["profile"], updated);
      showToast("Profile saved.", "success");
    },
    onError: (error) => {
      if (isApiError(error) && error.errors?.fullName) setFullNameError(error.errors.fullName);
      else showToast(isApiError(error) ? error.message : "Could not save your profile.", "error");
    },
  });

  function handleFile(file: File | undefined) {
    if (!file) return;
    setAvatarError(null);
    const problem = validateAvatarFile(file);
    if (problem) {
      setAvatarError(problem);
      return;
    }
    upload.mutate(file);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = validateProfile({ fullName });
    setFullNameError(errors.fullName);
    if (!errors.fullName) save.mutate();
  }

  return (
    <>
      <div className="qh-profile-grid">
        <Card className="qh-profile-avatar-card">
          <AvatarPreview url={avatarUrl} name={fullName} />
          <p className="qh-profile-name">{fullName || "—"}</p>
          <p className="qh-profile-email">{profile.email}</p>
          <span className="qh-profile-role">{ROLE_LABEL[profile.role]}</span>
        </Card>

        <Card>
          <form onSubmit={handleSubmit} noValidate aria-label="Edit profile">
            <Input
              label="Full name"
              name="fullName"
              autoComplete="name"
              required
              value={fullName}
              error={fullNameError}
              onChange={(event) => setFullName(event.target.value)}
            />
            <Input label="Email" name="email" value={profile.email} disabled readOnly />
            <Input
              label="Phone number"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />

            <div className="qh-field">
              <span className="qh-field__label" id="qh-avatar-label">
                Profile photo
              </span>
              <div className="qh-profile-avatar-actions" role="group" aria-labelledby="qh-avatar-label">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="visually-hidden"
                  aria-label="Choose a photo to upload"
                  tabIndex={-1}
                  onChange={(event) => {
                    handleFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()} isLoading={upload.isPending}>
                  Upload photo
                </Button>
                {avatarUrl && (
                  <Button type="button" variant="ghost" onClick={() => setAvatarUrl(null)}>
                    Remove photo
                  </Button>
                )}
              </div>
              <p className="qh-profile-hint">JPEG, PNG, GIF or WebP, up to 5 MB.</p>
              {avatarError && (
                <p className="qh-field__error" role="alert">
                  {avatarError}
                </p>
              )}
            </div>

            <div className="qh-profile-actions">
              <Button type="submit" isLoading={save.isPending}>
                Save changes
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPasswordOpen(true)}>
                Change password
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}
