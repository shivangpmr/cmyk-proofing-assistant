import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const PANEL_WIDTH = 288;
const VIEWPORT_MARGIN = 16;

export function HelpTip({
  label,
  children,
  className,
}: {
  /** Accessible name for the trigger, e.g. "What is a print profile?" */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const open = position !== null;

  const toggle = () => {
    if (open) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewport = document.documentElement.clientWidth;
    const width = Math.min(PANEL_WIDTH, viewport - VIEWPORT_MARGIN * 2);
    const centered = rect.left + rect.width / 2 - width / 2;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(centered, viewport - width - VIEWPORT_MARGIN));
    setPosition({ top: rect.bottom + 4, left, width });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={cn("inline-flex align-middle", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-black/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Info className="size-4" />
      </button>
      {position && (
        <span
          id={panelId}
          role="note"
          style={{ top: position.top, left: position.left, width: position.width }}
          className="fixed z-30 border border-line bg-surface p-3 text-left font-sans text-xs leading-relaxed font-normal tracking-normal text-ink normal-case shadow-sm"
        >
          {children}
        </span>
      )}
    </span>
  );
}
