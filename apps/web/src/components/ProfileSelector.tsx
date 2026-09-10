import { Info } from "lucide-react";
import type { ProfileInfo } from "@cmyk/shared";

export function ProfileSelector({
  profiles,
  value,
  onChange,
}: {
  profiles: ProfileInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium tracking-wide text-muted" htmlFor="profile">
        CMYK Profile
      </label>
      <select
        id="profile"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[240px] rounded-sm border border-line bg-surface px-2 py-1.5 text-sm"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id} disabled={p.id !== "auto" && !p.installed && false}>
            {p.label}
            {p.id !== "auto" && !p.installed ? " (not installed)" : ""}
          </option>
        ))}
      </select>
      <span
        title="CMYK appearance depends on the print condition and ICC profile. Select the profile your printer recommends."
        className="text-muted"
      >
        <Info className="size-4" />
      </span>
    </div>
  );
}
