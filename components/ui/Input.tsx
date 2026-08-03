import { cn } from "@/lib/cn";

export type InputProps = React.ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Input({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-12 w-full rounded-control border bg-surface-raised px-3",
          /* 16px minimum, otherwise iOS Safari zooms on focus. */
          "text-base text-ink placeholder:text-ink-faint",
          error ? "border-danger" : "border-border-strong",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
