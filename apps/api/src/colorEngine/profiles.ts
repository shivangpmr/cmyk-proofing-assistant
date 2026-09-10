import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTO_PROFILE,
  PROFILE_DEFINITIONS,
  type ProfileId,
  type ProfileInfo,
} from "@cmyk/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveProfilesDir(): string {
  if (process.env.PROFILES_DIR) return path.resolve(process.env.PROFILES_DIR);
  const candidates = [
    path.resolve(process.cwd(), "profiles"),
    path.resolve(__dirname, "../../../../profiles"),
    path.resolve(__dirname, "../../../profiles"),
    path.resolve(__dirname, "../../profiles"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}

export const PROFILES_DIR = resolveProfilesDir();
function listProfileFiles(): string[] {
  if (!fs.existsSync(PROFILES_DIR)) return [];
  return fs
    .readdirSync(PROFILES_DIR)
    .filter((f) => /\.(icc|icm)$/i.test(f));
}

function findFile(candidates: string[], files: string[]): string | null {
  const lower = new Map(files.map((f) => [f.toLowerCase(), f]));
  for (const name of candidates) {
    const hit = lower.get(name.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

export function getProfilesDir(): string {
  return PROFILES_DIR;
}

export function listProfiles(): ProfileInfo[] {
  const files = listProfileFiles();
  const defs = PROFILE_DEFINITIONS.map((def) => {
    const filename = findFile(def.filenames, files);
    return {
      id: def.id as ProfileId,
      label: def.label,
      shortLabel: def.shortLabel,
      description: def.description,
      installed: Boolean(filename),
      filename,
      approximate: !filename,
    } satisfies ProfileInfo;
  });

  const autoTarget =
    defs.find((p) => p.id === "fogra39" && p.installed) ??
    defs.find((p) => p.installed) ??
    null;

  const auto: ProfileInfo = {
    ...AUTO_PROFILE,
    installed: Boolean(autoTarget),
    filename: autoTarget?.filename ?? null,
    approximate: !autoTarget,
  };

  return [auto, ...defs];
}

export function resolveProfile(profileId: ProfileId | string): ProfileInfo {
  const all = listProfiles();
  const requested = all.find((p) => p.id === profileId) ?? all[0];

  if (requested.id === "auto") {
    const fogra = all.find((p) => p.id === "fogra39" && p.installed);
    const first = all.find((p) => p.id !== "auto" && p.installed);
    const target = fogra ?? first;
    if (target) {
      return {
        ...target,
        id: "auto",
        label: `Auto → ${target.label}`,
        shortLabel: `Auto · ${target.shortLabel}`,
        description: AUTO_PROFILE.description,
        installed: true,
        approximate: false,
      };
    }
    return {
      ...requested,
      label: "Auto / Recommended (approximate)",
      shortLabel: "Auto · Approx",
      approximate: true,
      installed: false,
      filename: null,
    };
  }

  return requested;
}

export function profileIccPath(profile: ProfileInfo): string | null {
  if (!profile.filename) return null;
  return path.join(PROFILES_DIR, profile.filename);
}
