import { Sparkles, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/svg+xml";

export function UploadZone({
  onFile,
  onTrySample,
  compact = false,
}: {
  onFile: (file: File) => void;
  onTrySample?: () => void;
  compact?: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      onFile(file);
    },
    [onFile],
  );

  if (compact) {
    return (
      <label className="inline-flex cursor-pointer">
        <input
          type="file"
          accept={ACCEPT}
          className="peer sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className="inline-flex items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2 text-sm hover:bg-paper peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
          <Upload className="size-4" />
          Replace design
        </span>
      </label>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col items-center border border-dashed border-line bg-surface px-8 py-16 text-center transition",
        dragging && "border-accent bg-accent/5",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <p className="font-mono text-xs tracking-[0.25em] text-muted">CMYK</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        Proofing Assistant
      </h2>
      <p className="mt-4 max-w-md text-base text-muted">
        See how your RGB colors survive the press.
      </p>
      <p className="mt-2 max-w-lg text-sm text-muted">
        Upload a design to preview CMYK reproduction, identify risky colors, and
        find better RGB alternatives.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept={ACCEPT}
            className="peer sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <span className="inline-flex items-center gap-2 rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
            <Upload className="size-4" />
            Upload Design
          </span>
        </label>
        {onTrySample && (
          <button
            type="button"
            onClick={onTrySample}
            className="inline-flex items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-paper"
          >
            <Sparkles className="size-4" />
            Try a sample
          </button>
        )}
      </div>
      <p className="mt-4 text-xs text-muted">Drop your file here · PNG, JPG, WebP, SVG</p>
      <p className="mt-1 text-xs text-muted">
        Your file is processed in memory and never stored.
      </p>
    </div>
  );
}
