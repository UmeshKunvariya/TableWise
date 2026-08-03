import { cn } from "@/lib/cn";

export function Card({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface-raised p-5 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
