import { AlertCircle, CheckCircle2, X } from "lucide-react";
import type { ReactNode } from "react";

type AlertBannerProps = {
  variant: "success" | "error";
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
};

const VARIANT = {
  success: {
    label: "Success",
    border: "border-[#22c55e]/70",
    bg: "bg-green-50/80",
    title: "text-green-800",
    text: "text-green-700",
    icon: "text-green-500",
    iconNode: CheckCircle2,
  },
  error: {
    label: "Error",
    border: "border-[#ef4444]/70",
    bg: "bg-red-50/80",
    title: "text-red-800",
    text: "text-red-700",
    icon: "text-red-500",
    iconNode: AlertCircle,
  },
} as const;

export function AlertBanner({ variant, title, children, onDismiss }: AlertBannerProps) {
  const styles = VARIANT[variant];
  const Icon = styles.iconNode;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-2xl border border-t-0 border-r-0 border-b-0 border-l-4 ${styles.border} ${styles.bg} px-4 py-3.5`}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${styles.icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={`font-display text-sm font-bold ${styles.title}`}>{title ?? styles.label}</p>
        <p className={`mt-0.5 text-sm font-semibold ${styles.text}`}>{children}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className={`shrink-0 rounded-lg p-1 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6bff] focus-visible:ring-offset-1 ${styles.text}`}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
