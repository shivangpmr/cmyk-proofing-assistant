# CMYK Proofing Assistant

Simple soft-proofing tool for designers: upload an RGB design, slide to compare the CMYK simulation, and get safer RGB alternatives for colors that shift.

## Stack

- **Web:** React, TypeScript, Vite, Tailwind CSS, Lucide
- **API:** Node.js, Express, Sharp, color.js
- **Shared:** profile IDs, ΔE thresholds, types

## Quick start

```bash
cd D:\Code\cmyk-proofing-assistant
npm install
npm run build -w @cmyk/shared
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:8787

## ICC profiles

Place `.icc` / `.icm` files in [`profiles/`](profiles/). See [`profiles/README.md`](profiles/README.md).

Supported selectors:

- Auto / Recommended
- ISO Coated v2 (FOGRA39)
- PSO Coated v3 (FOGRA51)
- GRACoL
- SWOP
- Japan Color

Without an installed profile, the engine uses a clearly labeled **approximate** soft-proof simulation (Lab chroma compression). With an ICC file present, Sharp performs profile-based conversion.

Optional helper (large download):

```bash
npm run fetch-profiles
```

## Features

1. Upload PNG / JPG / WebP / SVG
2. Before/after slider: Original RGB vs CMYK soft proof
3. Print readiness summary + colors to watch
4. Closest / Safer / Balanced RGB suggestions
5. Preview mappings (non-destructive)
6. Export soft-proof PNG, HTML report, CMYK TIFF (when ICC installed)
7. Developer **Test colors** seed mode

## Deploy (internal / Vercel)

Private GitHub + Vercel:

1. ICC profiles in `profiles/` are committed for private internal use.
2. `vercel.json` builds the web app and routes `/api/*` to the Express serverless function.
3. **Vercel Hobby body limit is ~4.5 MB** per request — keep test uploads under that, or use local/`npm run dev` for larger files.

```bash
npx vercel --prod
```
