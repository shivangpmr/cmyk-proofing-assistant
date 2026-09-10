import type { ProfileId, ProfileInfo } from "./types.js";

export interface ProfileDefinition {
  id: Exclude<ProfileId, "auto">;
  label: string;
  shortLabel: string;
  description: string;
  /** Candidate filenames (case-insensitive match). */
  filenames: string[];
}

export const PROFILE_DEFINITIONS: ProfileDefinition[] = [
  {
    id: "fogra39",
    label: "ISO Coated v2 (FOGRA39)",
    shortLabel: "ISO Coated v2",
    description: "European coated offset — FOGRA39 / ISO Coated v2",
    filenames: [
      "ISOcoated_v2_eci.icc",
      "ISOcoated_v2_eci.icm",
      "ISOcoated_v2_bas.ICC",
      "ISOcoated_v2_bas.icc",
      "Coated_Fogra39L_VIGC_300.icc",
      "fogra39.icc",
      "FOGRA39.icc",
    ],
  },
  {
    id: "fogra51",
    label: "PSO Coated v3 (FOGRA51)",
    shortLabel: "PSO Coated v3",
    description: "European coated offset — FOGRA51 / PSO Coated v3",
    filenames: [
      "PSOcoated_v3.icc",
      "PSO_Coated_v3.icc",
      "fogra51.icc",
      "FOGRA51.icc",
    ],
  },
  {
    id: "gracol",
    label: "GRACoL",
    shortLabel: "GRACoL",
    description: "North American coated offset — GRACoL",
    filenames: [
      "GRACoL2006_Coated1v2.icc",
      "GRACoL2013.icc",
      "gracol.icc",
      "GRACoL.icc",
    ],
  },
  {
    id: "swop",
    label: "SWOP",
    shortLabel: "SWOP",
    description: "North American web offset — SWOP",
    filenames: [
      "USWebCoatedSWOP.icc",
      "SWOP2006_Coated3v2.icc",
      "swop.icc",
      "SWOP.icc",
    ],
  },
  {
    id: "japan-color",
    label: "Japan Color",
    shortLabel: "Japan Color",
    description: "Japan Color coated offset",
    filenames: [
      "JapanColor2001Coated.icc",
      "JapanColor2011Coated.icc",
      "japan-color.icc",
      "JapanColor.icc",
    ],
  },
];

export const AUTO_PROFILE: Omit<ProfileInfo, "installed" | "filename" | "approximate"> = {
  id: "auto",
  label: "Auto / Recommended",
  shortLabel: "Auto",
  description: "Uses ISO Coated v2 (FOGRA39) when available, otherwise the first installed profile",
};

export const DEFAULT_PROFILE_ID: ProfileId = "auto";
