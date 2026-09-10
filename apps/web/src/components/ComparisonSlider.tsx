import { useRef, useState } from "react";

export function ComparisonSlider({
  originalUrl,
  proofUrl,
  profileLabel,
}: {
  originalUrl: string;
  proofUrl: string;
  profileLabel: string;
}) {
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);
  const frame = useRef<HTMLDivElement>(null);

  const updateFromClientX = (clientX: number) => {
    const el = frame.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(2, Math.min(98, next)));
  };

  return (
    <div className="w-full">
      <div
        ref={frame}
        className="relative aspect-[4/3] w-full overflow-hidden border border-line bg-[#e8e8e6] select-none"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          updateFromClientX(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <img
          src={proofUrl}
          alt="CMYK soft proof"
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
        <img
          src={originalUrl}
          alt="Original RGB"
          className="absolute inset-0 h-full w-full object-contain"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          draggable={false}
        />

        <div
          className="absolute inset-y-0 z-10 w-px bg-ink"
          style={{ left: `${pos}%` }}
        >
          <div className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink bg-surface shadow-sm">
            <span className="font-mono text-[10px] tracking-wide">⟷</span>
          </div>
        </div>

        <div className="pointer-events-none absolute top-3 left-3 rounded-sm bg-black/70 px-2 py-1 font-mono text-[11px] text-white">
          RGB
        </div>
        <div className="pointer-events-none absolute top-3 right-3 rounded-sm bg-black/70 px-2 py-1 font-mono text-[11px] text-white">
          CMYK · {profileLabel}
        </div>
      </div>
      <input
        aria-label="Compare RGB and CMYK"
        type="range"
        min={2}
        max={98}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="mt-3 w-full accent-accent"
      />
    </div>
  );
}
