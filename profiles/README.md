# ICC profiles

The API loads every `.icc` / `.icm` file in this folder at startup and matches it to a print condition by filename (see [`packages/shared/src/profiles.ts`](../packages/shared/src/profiles.ts)).

## Bundled profiles

These files are **not** covered by the project's MIT license. They belong to their respective owners and remain subject to their terms. If you redistribute this project, check those terms first.

| Print condition | File | Owner | Source |
| --- | --- | --- | --- |
| ISO Coated v2 (FOGRA39) | `ISOcoated_v2_bas.ICC` | basICColor | [OpenICC basICColor profiles](https://sourceforge.net/projects/openicc/files/basICColor-Profiles/) |
| FOGRA39, 300% ink limit | `Coated_Fogra39L_VIGC_300.icc` | VIGC | [ICC Profile Registry](https://registry.color.org/profile-registry/) |
| PSO Coated v3 (FOGRA51) | `PSOcoated_v3.icc` | European Color Initiative (ECI) | [ICC Profile Registry](https://registry.color.org/profile-registry/) / [eci.org](https://www.eci.org/) |
| GRACoL | `GRACoL2006_Coated1v2.icc` | IDEAlliance | [ICC Profile Registry](https://registry.color.org/profile-registry/) |
| SWOP | `SWOP2006_Coated3v2.icc` | IDEAlliance | [ICC Profile Registry](https://registry.color.org/profile-registry/) |
| Japan Color | `JapanColor2011Coated.icc` | Japan Color | [ICC Profile Registry](https://registry.color.org/profile-registry/) |

**Auto / Recommended** uses FOGRA39 when it is installed, otherwise the first installed profile.

## Adding or replacing a profile

1. Get the profile your printer recommends (ask them, or use the [ICC Profile Registry](https://registry.color.org/profile-registry/)).
2. Save it here with one of the filenames listed for that print condition in [`packages/shared/src/profiles.ts`](../packages/shared/src/profiles.ts), or add your filename to that list.
3. Restart the API. The profile dropdown marks it as installed.

If no profile matches a print condition, the app falls back to a clearly labeled **approximate** simulation for it.
