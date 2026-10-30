import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FlaskConical, LoaderCircle } from "lucide-react";
import type { AnalysisResult, ImageMeta, ProfileInfo } from "@cmyk/shared";
import { ComparisonSlider } from "@/components/ComparisonSlider";
import { ProfileSelector } from "@/components/ProfileSelector";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { UploadZone } from "@/components/UploadZone";
import { Button } from "@/components/ui/button";
import {
  downloadProof,
  downloadReport,
  downloadTiff,
  fetchAnalysis,
  fetchProfiles,
  fetchProof,
  fetchSeedAnalysis,
} from "@/lib/api";
import { remapImageUrl } from "@/lib/remap";
import { createWorkingCopy } from "@/lib/workingCopy";

export default function App() {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [profileId, setProfileId] = useState("auto");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [displayOriginal, setDisplayOriginal] = useState<string | null>(null);
  const [displayProof, setDisplayProof] = useState<string | null>(null);
  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seedMode, setSeedMode] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    fetchProfiles()
      .then(setProfiles)
      .catch((e) => setError(String(e)));
  }, []);

  const activeProfile = useMemo(() => {
    return (
      analysis?.profile ??
      profiles.find((p) => p.id === profileId) ??
      profiles[0]
    );
  }, [analysis, profiles, profileId]);

  const runPipeline = useCallback(async (nextFile: File, nextProfileId: string) => {
    setLoading(true);
    setError(null);
    setSeedMode(false);
    setMappings({});
    setProgress("Preparing image…");

    try {
      const working = await createWorkingCopy(nextFile);
      setFile(working.file);
      setMeta(working.meta);
      setOriginalUrl(working.url);
      setDisplayOriginal(working.url);

      setProgress("Generating CMYK soft proof…");
      const proof = await fetchProof(working.file, nextProfileId);
      setProofUrl(proof.proofUrl);
      setDisplayProof(proof.proofUrl);

      setProgress("Analyzing colors…");
      const result = await fetchAnalysis(working.file, nextProfileId);
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, []);

  const runSeed = useCallback(async (nextProfileId: string) => {
    setLoading(true);
    setError(null);
    setSeedMode(true);
    setFile(null);
    setMeta(null);
    setMappings({});
    setProgress("Running seed color tests…");
    try {
      const result = await fetchSeedAnalysis(nextProfileId);
      setAnalysis(result);
      const board = buildSeedBoard(result);
      setOriginalUrl(board.original);
      setProofUrl(board.proof);
      setDisplayOriginal(board.original);
      setDisplayProof(board.proof);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, []);

  const onFile = (f: File) => {
    setSourceFile(f);
    void runPipeline(f, profileId);
  };

  const onProfileChange = (id: string) => {
    setProfileId(id);
    if (sourceFile && !seedMode) void runPipeline(sourceFile, id);
    else if (seedMode) void runSeed(id);
  };

  useEffect(() => {
    let cancelled = false;
    async function applyMappings() {
      if (!originalUrl || !proofUrl || !analysis) return;
      if (Object.keys(mappings).length === 0) {
        setDisplayOriginal(originalUrl);
        setDisplayProof(proofUrl);
        return;
      }
      const [o, p] = await Promise.all([
        remapImageUrl(originalUrl, mappings, analysis.colors, "original"),
        remapImageUrl(proofUrl, mappings, analysis.colors, "proof"),
      ]);
      if (!cancelled) {
        setDisplayOriginal(o);
        setDisplayProof(p);
      }
    }
    void applyMappings();
    return () => {
      cancelled = true;
    };
  }, [mappings, originalUrl, proofUrl, analysis]);

  const onPreview = (fromHex: string, toHex: string | null) => {
    setMappings((prev) => {
      const next = { ...prev };
      if (!toHex) delete next[fromHex];
      else next[fromHex] = toHex;
      return next;
    });
  };

  const onApplyAll = () => {
    if (!analysis) return;
    const next: Record<string, string> = {};
    for (const c of analysis.colors) {
      if (c.severity === "safe") continue;
      const balanced = c.suggestions.find((s) => s.kind === "balanced") ?? c.suggestions[0];
      if (balanced) next[c.hex] = balanced.hex;
    }
    setMappings(next);
  };

  const anyInstalled = profiles.some((p) => p.id !== "auto" && p.installed);
  const usedApprox = analysis?.usedApproximate ?? !anyInstalled;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted">CMYK</p>
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">
              Proofing Assistant
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {profiles.length > 0 && (
              <ProfileSelector
                profiles={profiles}
                value={profileId}
                onChange={onProfileChange}
              />
            )}
            <div className="relative">
              <Button variant="outline" onClick={() => setExportOpen((v) => !v)}>
                <Download className="size-4" />
                Export
              </Button>
              {exportOpen && (
                <div className="absolute right-0 z-20 mt-1 w-56 border border-line bg-surface p-1 shadow-sm">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-paper disabled:opacity-40"
                    disabled={!file || !proofUrl}
                    onClick={() => {
                      if (proofUrl && activeProfile) {
                        void downloadProof(proofUrl, activeProfile.shortLabel);
                      }
                      setExportOpen(false);
                    }}
                  >
                    Download CMYK Proof
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-paper disabled:opacity-40"
                    disabled={!file && !seedMode}
                    onClick={() => {
                      void downloadReport(file, profileId, seedMode);
                      setExportOpen(false);
                    }}
                  >
                    Export Report
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-paper disabled:opacity-40"
                    disabled={!file}
                    onClick={() => {
                      if (!file) return;
                      void downloadTiff(file, profileId).catch((e) =>
                        setError(e instanceof Error ? e.message : String(e)),
                      );
                      setExportOpen(false);
                    }}
                  >
                    Export CMYK TIFF
                  </button>
                </div>
              )}
            </div>
            <Button variant="ghost" onClick={() => void runSeed(profileId)} title="Developer seed colors">
              <FlaskConical className="size-4" />
              <span className="hidden sm:inline">Test colors</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {!originalUrl && !loading && <UploadZone onFile={onFile} />}

        {(originalUrl || loading) && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <UploadZone onFile={onFile} compact />
              {meta && (
                <p className="font-mono text-xs text-muted">
                  {meta.filename} · {meta.width}×{meta.height} · {meta.colorMode}
                </p>
              )}
            </div>

            {loading && (
              <div className="flex items-center gap-3 border border-line bg-surface px-4 py-3 text-sm">
                <LoaderCircle className="size-4 animate-spin" />
                {progress || "Working…"}
              </div>
            )}

            {error && (
              <div className="border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            {displayOriginal && displayProof && activeProfile && (
              <>
                <ComparisonSlider
                  originalUrl={displayOriginal}
                  proofUrl={displayProof}
                  profileLabel={activeProfile.shortLabel}
                />
                <div className="flex flex-wrap gap-x-6 gap-y-2 border border-line bg-surface px-4 py-3 font-mono text-xs text-muted">
                  <span>
                    <strong className="text-ink">RGB</strong> sRGB
                  </span>
                  <span>
                    <strong className="text-ink">CMYK</strong> {activeProfile.label}
                    {usedApprox ? " · approximate simulation" : ""}
                  </span>
                  {analysis && (
                    <span>
                      <strong className="text-ink">Color shifts</strong>{" "}
                      {analysis.summary.minorCount + analysis.summary.significantCount}
                    </span>
                  )}
                  {Object.keys(mappings).length > 0 && (
                    <span>
                      <strong className="text-ink">Preview mappings</strong>{" "}
                      {Object.keys(mappings).length}
                    </span>
                  )}
                </div>
              </>
            )}

            {analysis && (
              <SuggestionsPanel
                analysis={analysis}
                mappings={mappings}
                onPreview={onPreview}
                onApplyAll={onApplyAll}
                onReset={() => setMappings({})}
              />
            )}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted">
          Soft proofing is an on-screen simulation. Final appearance depends on the
          printer, paper, ink, press conditions, and ICC profile.
          {!anyInstalled && (
            <>
              {" "}
              Place ICC files in <code className="font-mono">/profiles</code> for
              profile-accurate conversion — see profiles/README.md.
            </>
          )}
        </p>
      </main>
    </div>
  );
}

function buildSeedBoard(analysis: AnalysisResult): { original: string; proof: string } {
  const cols = 4;
  const size = 96;
  const rows = Math.ceil(analysis.colors.length / cols);
  const w = cols * size;
  const h = rows * size;

  const draw = (mode: "original" | "proof") => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    analysis.colors.forEach((c, i) => {
      const x = (i % cols) * size;
      const y = Math.floor(i / cols) * size;
      ctx.fillStyle = mode === "original" ? c.hex : c.softProofHex;
      ctx.fillRect(x, y, size, size);
    });
    return canvas.toDataURL("image/png");
  };

  return { original: draw("original"), proof: draw("proof") };
}
