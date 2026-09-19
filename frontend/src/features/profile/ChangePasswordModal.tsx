import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { profileApi } from "@/api/profile.api";
import { isApiError } from "@/api/httpClient";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useToast } from "@/components/feedback/ToastProvider";
import "@/features/auth/AuthPages.css";
import { mapPasswordApiError, validatePasswordChange, type PasswordErrors, type PasswordFields } from "./profileValidation";

const EMPTY: PasswordFields = { oldPassword: "", newPassword: "", confirmNewPassword: "" };

export function ChangePasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [values, setValues] = useState<PasswordFields>(EMPTY);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const { showToast } = useToast();

  const mutation = useMutation({
    mutationFn: () => profileApi.changePassword(values),
    onSuccess: () => {
      showToast("Password changed.", "success");
      handleClose();
    },
    onError: (error) => {
      if (!isApiError(error)) {
        setGeneral("Could not change the password. Please try again.");
        return;
      }
      const mapped = mapPasswordApiError(error);
      if (mapped.field === "general") setGeneral(mapped.message);
      else setErrors({ [mapped.field]: mapped.message });
    },
  });

  function handleClose() {
    setValues(EMPTY);
    setErrors({});
    setGeneral(null);
    onClose();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setGeneral(null);
    const found = validatePasswordChange(values);
    setErrors(found);
    if (Object.keys(found).length === 0) mutation.mutate();
  }

  function field<K extends keyof PasswordFields>(key: K) {
    return {
      value: values[key],
      error: errors[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues((prev) => ({ ...prev, [key]: event.target.value })),
    };
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={mutation.isPending ? () => undefined : handleClose}
      title="Change password"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="qh-change-password-form" isLoading={mutation.isPending}>
            Update password
          </Button>
        </>
      }
    >
      <form id="qh-change-password-form" onSubmit={handleSubmit} noValidate>
        {general && (
          <p className="qh-auth-error" role="alert">
            {general}
          </p>
        )}
        <PasswordInput label="Current password" autoComplete="current-password" {...field("oldPassword")} />
        <PasswordInput label="New password" autoComplete="new-password" {...field("newPassword")} />
        <PasswordInput label="Confirm new password" autoComplete="new-password" {...field("confirmNewPassword")} />
      </form>
    </Modal>
  );
}
