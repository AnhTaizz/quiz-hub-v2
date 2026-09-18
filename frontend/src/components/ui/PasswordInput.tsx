import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import "./Input.css";
import "./PasswordInput.css";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, id, className, ...rest }, ref) => {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className="qh-field">
        <label htmlFor={inputId} className="qh-field__label">
          {label}
        </label>
        <div className="qh-password__wrapper">
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            className={["qh-field__input", "qh-password__input", error && "qh-field__input--invalid", className]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            {...rest}
          />
          <button
            type="button"
            className="qh-password__toggle"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        {error && (
          <p id={errorId} className="qh-field__error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
