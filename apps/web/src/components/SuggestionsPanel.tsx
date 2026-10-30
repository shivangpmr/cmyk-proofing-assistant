import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { AnalyzedColor, AnalysisResult, PrintReadiness } from "@cmyk/shared";
import { severityLabel } from "@cmyk/shared";
import { HelpTip } from "@/components/HelpTip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const READINESS: Record<PrintReadiness, { label: string; meaning: string }> = {
  ready: {
    label: "Ready",
    meaning: "No colors are expected to shift noticeably in print.",
  },
  review: {
    label: "Review",
    meaning: "Some colors may look slightly different in print. Check the ones listed below.",
  },
  needs_attention: {
    label: "Needs Attention",
    meaning:
      "Some colors will look clearly different in print. Consider the suggested replacements before sending the file to print.",
  },
};

export function SuggestionsPanel({
  analysis,
  mappings,
  onPreview,
  onApplyAll,
  onReset,
}: {
  analysis: AnalysisResult;
  mappings: Record<string, string>;
  onPreview: (fromHex: string, toHex: string | null) => void;
  onApplyAll: () => void;
  onReset: () => void;
}) {
  const problemColors = analysis.colors.filter((c) => c.severity !== "safe");
  const fixable = problemColors.filter((c) => c.suggestions.length > 0);
  const { summary } = analysis;

  return (
    <section className="border border-line bg-surface" aria-labelledby="readiness-heading">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted">PRINT READINESS</p>
            <div className="flex items-center gap-1">
              <h2 id="readiness-heading" className="text-lg font-semibold">
                {READINESS[summary.readiness].label}
              </h2>
              <HelpTip label="What do the readiness levels mean?">
                <span className="block space-y-1.5">
                  {(Object.keys(READINESS) as PrintReadiness[]).map((key) => (
                    <span key={key} className="block">
                      <strong>{READINESS[key].label}:</strong> {READINESS[key].meaning}
                    </span>
                  ))}
                  <span className="block text-muted">
                    This is a guide based on an on-screen simulation, not a guarantee.
                  </span>
                </span>
              </HelpTip>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onApplyAll} disabled={fixable.length === 0}>
              Preview all suggestions
            </Button>
            <Button variant="ghost" onClick={onReset} disabled={Object.keys(mappings).length === 0}>
              Reset
            </Button>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">{summary.overview}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1 font-mono text-xs text-muted">
          <span>
            {summary.analyzedCount} analyzed · {summary.safeCount} safe · {summary.minorCount}{" "}
            minor · {summary.significantCount} significant
          </span>
          <HelpTip label="How is the color shift measured?">
            <strong>Shift</strong> is how different the printed color looks from your screen
            color, measured as Delta E (ΔE00). Under 3 is hard to notice, 3 to 8 is noticeable
            side by side, and over 8 is obvious.
          </HelpTip>
        </p>
      </div>

      {problemColors.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted">
          No colors in this design are expected to shift noticeably in print.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {problemColors.map((color) => (
            <ColorRow
              key={color.id}
              color={color}
              mappedTo={mappings[color.hex] ?? null}
              onPreview={onPreview}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ColorRow({
  color,
  mappedTo,
  onPreview,
}: {
  color: AnalyzedColor;
  mappedTo: string | null;
  onPreview: (fromHex: string, toHex: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const balanced =
    color.suggestions.find((s) => s.kind === "balanced") ?? color.suggestions[0];
  const activeHex = mappedTo ?? balanced?.hex ?? null;

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex border border-line" aria-hidden="true">
            <span className="size-9" style={{ background: color.hex }} />
            <span className="size-9" style={{ background: color.softProofHex }} />
          </div>
          <span className="font-mono text-[10px] text-muted">screen · print</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{color.shiftSummary}</h3>
            <span
              className={cn(
                "rounded-sm px-1.5 py-0.5 text-[11px] font-medium",
                color.severity === "significant" && "bg-danger/10 text-danger",
                color.severity === "minor" && "bg-warn/10 text-warn",
              )}
            >
              {severityLabel(color.severity)}
            </span>
            <span className="text-xs text-muted">{color.name}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{color.explanation}</p>
          <p className="mt-1 font-mono text-xs text-muted">
            Details: {color.hex} → {color.softProofHex} in print · Shift {color.deltaE} · CMYK{" "}
            {color.cmyk.c}/{color.cmyk.m}/{color.cmyk.y}/{color.cmyk.k}
          </p>

          {balanced ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-muted">Suggested</span>
                <span
                  className="inline-block size-4 border border-line"
                  style={{ background: balanced.hex }}
                />
                <span className="font-mono">{balanced.hex}</span>
                <span className="basis-full text-xs text-muted sm:basis-auto">
                  prints as {balanced.softProofHex} · shift {balanced.deltaE} (
                  {Math.round((1 - balanced.deltaE / color.deltaE) * 100)}% closer)
                </span>
              </div>
              <Button
                variant={mappedTo ? "accent" : "outline"}
                aria-pressed={Boolean(mappedTo)}
                onClick={() => onPreview(color.hex, mappedTo ? null : balanced.hex)}
              >
                {mappedTo ? "Hide suggested color" : "Show suggested color in preview"}
              </Button>
              {color.suggestions.length > 1 && (
                <button
                  type="button"
                  aria-expanded={open}
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                  onClick={() => setOpen((v) => !v)}
                >
                  {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  More options
                </button>
              )}
            </div>
          ) : (
            <p className="mt-3 border-l-2 border-warn/40 pl-3 text-sm text-muted">
              No better RGB alternative: this color is limited by the print gamut. Ask your
              printer about spot colors.
            </p>
          )}

          {open && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {color.suggestions.map((s) => (
                <button
                  key={s.kind}
                  type="button"
                  aria-pressed={activeHex === s.hex && Boolean(mappedTo)}
                  onClick={() => onPreview(color.hex, s.hex)}
                  className={cn(
                    "border border-line p-3 text-left hover:bg-paper",
                    activeHex === s.hex && "border-accent bg-accent/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide">{s.kind}</span>
                    <span className="size-5 border border-line" style={{ background: s.hex }} />
                  </div>
                  <p className="mt-2 font-mono text-sm">{s.hex}</p>
                  <p className="mt-1 text-xs text-muted">
                    Prints as {s.softProofHex} · shift {s.deltaE} (
                    {Math.round((1 - s.deltaE / color.deltaE) * 100)}% closer)
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
