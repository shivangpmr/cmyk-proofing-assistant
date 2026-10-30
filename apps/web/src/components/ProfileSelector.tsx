import type { ProfileInfo } from "@cmyk/shared";
import { HelpTip } from "@/components/HelpTip";

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
    <div className="flex items-center gap-1.5">
      <label
        className="hidden text-xs font-medium tracking-wide text-muted sm:inline"
        htmlFor="profile"
      >
        Print profile
      </label>
      <select
        id="profile"
        aria-label="Print profile"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[200px] rounded-sm border border-line bg-surface px-2 py-1.5 text-sm sm:max-w-[240px]"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
            {p.id !== "auto" && !p.installed ? " (not installed)" : ""}
          </option>
        ))}
      </select>
      <HelpTip label="What is a print profile?">
        The printing standard (ICC profile) your printer uses. It changes how colors will
        look on paper. <strong>Not sure? Keep Auto</strong>, or ask your printer which
        profile they want.
      </HelpTip>
    </div>
  );
}
