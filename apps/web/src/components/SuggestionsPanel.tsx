import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { AnalyzedColor, AnalysisResult } from "@cmyk/shared";
import { severityLabel } from "@cmyk/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const { summary } = analysis;

  const readinessLabel =
    summary.readiness === "ready"
      ? "Ready"
      : summary.readiness === "review"
        ? "Review"
        : "Needs Attention";

  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted">
              PRINT READINESS
            </p>
            <h2 className="text-lg font-semibold">{readinessLabel}</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onApplyAll} disabled={problemColors.length === 0}>
              Apply all suggestions
            </Button>
            <Button variant="ghost" onClick={onReset} disabled={Object.keys(mappings).length === 0}>
              Reset
            </Button>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">{summary.overview}</p>
        <p className="mt-1 font-mono text-xs text-muted">
          {summary.analyzedCount} analyzed · {summary.safeCount} safe ·{" "}
          {summary.minorCount} minor · {summary.significantCount} significant
          {summary.mostAffected.length > 0
            ? ` · Most affected: ${summary.mostAffected.join(", ")}`
            : ""}
        </p>
      </div>

      {problemColors.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted">
          No problematic colors detected for this soft proof.
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
        <div
          className="size-10 shrink-0 border border-line"
          style={{ background: color.hex }}
          title={color.hex}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium">{color.hex}</span>
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
            RGB → CMYK proof {color.hex} → {color.softProofHex} · ΔE00 {color.deltaE}
          </p>
          {balanced && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Suggested</span>
                <span
                  className="inline-block size-4 border border-line"
                  style={{ background: balanced.hex }}
                />
                <span className="font-mono">{balanced.hex}</span>
                <span className="text-xs text-muted">
                  (Balanced · proof {balanced.softProofHex} · ΔE {balanced.deltaE}
                  {balanced.deltaE < color.deltaE
                    ? ` · −${Math.round((1 - balanced.deltaE / color.deltaE) * 100)}% shift`
                    : ""}
                  )
                </span>
              </div>
              <Button
                variant={mappedTo ? "accent" : "outline"}
                onClick={() =>
                  onPreview(color.hex, mappedTo ? null : balanced.hex)
                }
              >
                {mappedTo ? "Undo preview" : "Preview change"}
              </Button>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                All options
              </button>
            </div>
          )}
          {open && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {color.suggestions.map((s) => {
                const improvement =
                  color.deltaE > 0
                    ? Math.max(0, Math.round((1 - s.deltaE / color.deltaE) * 100))
                    : 0;
                return (
                  <button
                    key={s.kind}
                    type="button"
                    onClick={() => onPreview(color.hex, s.hex)}
                    className={cn(
                      "border border-line p-3 text-left hover:bg-paper",
                      activeHex === s.hex && "border-accent bg-accent/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide">
                        {s.kind}
                      </span>
                      <span
                        className="size-5 border border-line"
                        style={{ background: s.hex }}
                      />
                    </div>
                    <p className="mt-2 font-mono text-sm">{s.hex}</p>
                    <p className="mt-1 text-xs text-muted">
                      Proof {s.softProofHex} · ΔE {s.deltaE}
                      {improvement > 0 ? ` · ${improvement}% better` : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
