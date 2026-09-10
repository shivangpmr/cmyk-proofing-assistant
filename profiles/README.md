# ICC Profiles

Place CMYK ICC/ICM files in this folder. The API picks them up automatically.

## Recommended filenames

| Profile | Suggested filename |
| --- | --- |
| ISO Coated v2 / FOGRA39 | `ISOcoated_v2_eci.icc` or `ISOcoated_v2_bas.ICC` |
| PSO Coated v3 / FOGRA51 | `PSOcoated_v3.icc` |
| GRACoL | `GRACoL2006_Coated1v2.icc` (or your printer’s GRACoL file) |
| SWOP | `USWebCoatedSWOP.icc` |
| Japan Color | `JapanColor2001Coated.icc` |

## Where to get profiles

- **ICC Profile Registry (recommended):** https://registry.color.org/profile-registry/
  - Direct files live under `https://registry.color.org/profile-registry/profiles/<name>.icc`
- **FOGRA39 / FOGRA51 (ECI):** https://www.eci.org/
- **FOGRA39 equivalent (basICColor):** OpenICC / SourceForge `basICColor-Profiles` — `ISOcoated_v2_bas.ICC`
- **GRACoL / SWOP:** IDEAlliance / your printer
- **Japan Color:** Japan Color Consortium / your printer

You can also run from the repo root:

```bash
npm run fetch-profiles
```

That script attempts to download a redistributable FOGRA39-based profile when available.

Profiles in this folder are for **local private use**. Do not redistribute ICC files with the project.
