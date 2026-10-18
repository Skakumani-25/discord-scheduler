import { useState, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { LoaderCircle, type LucideIcon } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: LucideIcon;
  // Icon-only buttons must also pass aria-label
  iconOnly?: boolean;
  block?: boolean;
  loading?: boolean;
  // Returning a promise disables the button and shows a spinner until it settles,
  // which prevents duplicate submissions
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  "danger-ghost": "btn-ghost btn-danger-text",
};

export default function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconOnly = false,
  block = false,
  loading = false,
  type = "button",
  className,
  disabled,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const [busy, setBusy] = useState(false);
  const pending = loading || busy;
  const iconSize = size === "sm" ? 15 : 16;

  async function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (pending) return;
    const result = onClick?.(e);
    if (result instanceof Promise) {
      setBusy(true);
      try {
        await result;
      } catch {
        // Callers report their own errors; this only resets the busy state
      } finally {
        setBusy(false);
      }
    }
  }

  const classes = [
    "btn",
    VARIANT_CLASS[variant],
    size === "sm" && "btn-sm",
    iconOnly && "btn-icon",
    block && "btn-block",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      onClick={handleClick}
      {...rest}
    >
      {pending ? (
        <LoaderCircle size={iconSize} className="spin" aria-hidden />
      ) : (
        Icon && <Icon size={iconSize} aria-hidden />
      )}
      {!iconOnly && children}
    </button>
  );
}
