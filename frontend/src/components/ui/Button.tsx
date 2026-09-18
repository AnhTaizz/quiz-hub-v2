import { forwardRef, type ButtonHTMLAttributes } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", isLoading = false, disabled, className, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={["qh-button", `qh-button--${variant}`, className].filter(Boolean).join(" ")}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...rest}
      >
        {isLoading && <span className="qh-button__spinner" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
