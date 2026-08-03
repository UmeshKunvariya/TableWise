import { cn } from "@/lib/cn";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-fg hover:bg-primary-hover disabled:hover:bg-primary",
  accent:
    "bg-accent text-accent-fg hover:bg-accent-hover disabled:hover:bg-accent",
  secondary:
    "bg-surface-raised text-ink border border-border-strong hover:bg-surface-sunken",
  ghost: "bg-transparent text-ink-muted hover:bg-surface-sunken",
  danger: "bg-danger text-white hover:opacity-90",
};

/* Sizes never drop below a 44px touch target — see docs/PLAN.md. */
const SIZES: Record<Size, string> = {
  md: "min-h-11 px-4 text-base",
  lg: "min-h-14 px-6 text-lg",
};

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-control font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
