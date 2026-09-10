import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline" | "accent";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none",
        variant === "default" && "bg-ink text-white hover:bg-black",
        variant === "accent" && "bg-accent text-white hover:opacity-90",
        variant === "outline" && "border border-line bg-surface hover:bg-paper",
        variant === "ghost" && "hover:bg-black/5",
        className,
      )}
      {...props}
    />
  );
}
