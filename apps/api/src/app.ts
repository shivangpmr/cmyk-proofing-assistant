import cors from "cors";
import express from "express";
import multer from "multer";
import sharp from "sharp";
import { SEED_TEST_COLORS } from "@cmyk/shared";
import { colorEngine } from "./colorEngine/index.js";

const maxUploadMb = process.env.VERCEL ? 4.5 : 40;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024 },
});

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "cmyk-proofing-assistant" });
});

app.get("/api/profiles", (_req, res) => {
  res.json({ profiles: colorEngine.listProfiles() });
});

app.post("/api/meta", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Missing file" });
      return;
    }
    const meta = await colorEngine.getImageMeta(req.file.buffer, req.file.originalname);
    res.json({ meta });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/proof", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Missing file" });
      return;
    }
    const profileId = String(req.body.profileId ?? "auto");
    const result = await colorEngine.softProofImage(req.file.buffer, profileId);
    // Base64 PNG of a photo can exceed the hosted ~4.5 MB response limit.
    const jpeg = await sharp(result.buffer)
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toBuffer();
    res.json({
      profile: result.profile,
      usedApproximate: result.usedApproximate,
      width: result.width,
      height: result.height,
      proofBase64: jpeg.toString("base64"),
      proofMime: "image/jpeg",
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/analyze", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Missing file" });
      return;
    }
    const profileId = String(req.body.profileId ?? "auto");
    const analysis = await colorEngine.analyzeImage(req.file.buffer, profileId);
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/suggest", async (req, res) => {
  try {
    const { hex, rgb, profileId = "auto" } = req.body ?? {};
    let color = rgb;
    if (!color && hex) {
      const h = String(hex).replace("#", "");
      const n = Number.parseInt(h.length === 3 ? h.split("").map((c: string) => c + c).join("") : h, 16);
      color = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    if (!color) {
      res.status(400).json({ error: "Provide hex or rgb" });
      return;
    }
    const result = await colorEngine.suggestAlternatives(color, profileId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/seed-analyze", async (req, res) => {
  try {
    const profileId = String(req.body?.profileId ?? "auto");
    const analysis = await colorEngine.analyzeHexColors([...SEED_TEST_COLORS], profileId);
    res.json({ analysis, seeds: SEED_TEST_COLORS });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/export/proof", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Missing file" });
      return;
    }
    const profileId = String(req.body.profileId ?? "auto");
    const result = await colorEngine.softProofImage(req.file.buffer, profileId, 4000);
    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="cmyk-soft-proof-${result.profile.shortLabel.replace(/\s+/g, "-").toLowerCase()}.png"`,
    );
    res.send(result.buffer);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/export/tiff", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Missing file" });
      return;
    }
    const profileId = String(req.body.profileId ?? "auto");
    const result = await colorEngine.exportCmykTiff(req.file.buffer, profileId);
    if (!result.buffer) {
      res.status(400).json({
        error:
          "CMYK TIFF export requires an installed ICC profile for the selected condition. Place a profile in /profiles.",
      });
      return;
    }
    res.setHeader("Content-Type", "image/tiff");
    res.setHeader("Content-Disposition", 'attachment; filename="cmyk-export.tif"');
    res.send(result.buffer);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/export/report", upload.single("file"), async (req, res) => {
  try {
    const profileId = String(req.body.profileId ?? "auto");
    let analysis;
    let thumbBase64 = "";

    if (req.file) {
      analysis = await colorEngine.analyzeImage(req.file.buffer, profileId);
      const thumb = await colorEngine.softProofImage(req.file.buffer, profileId, 480);
      thumbBase64 = thumb.buffer.toString("base64");
    } else if (req.body?.seed) {
      analysis = await colorEngine.analyzeHexColors([...SEED_TEST_COLORS], profileId);
    } else {
      res.status(400).json({ error: "Missing file" });
      return;
    }

    const date = new Date().toISOString();
    const rows = analysis.colors
      .map((c) => {
        const balanced = c.suggestions.find((s) => s.kind === "balanced");
        return `<tr>
          <td><span style="display:inline-block;width:14px;height:14px;background:${c.hex};border:1px solid #ccc;vertical-align:middle;margin-right:6px"></span>${c.hex}</td>
          <td>${c.softProofHex}</td>
          <td>${balanced?.hex ?? "—"}</td>
          <td>${c.cmyk.c}/${c.cmyk.m}/${c.cmyk.y}/${c.cmyk.k}</td>
          <td>${balanced ? `${balanced.cmyk.c}/${balanced.cmyk.m}/${balanced.cmyk.y}/${balanced.cmyk.k}` : "—"}</td>
          <td>${c.deltaE}</td>
          <td>${c.severity}</td>
          <td>${c.explanation}</td>
        </tr>`;
      })
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>CMYK Proofing Report</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;color:#111;max-width:960px;margin:40px auto;padding:0 20px;line-height:1.45}
  h1{font-size:22px;letter-spacing:.02em;margin:0 0 8px}
  .meta{color:#555;font-size:13px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
  th{background:#f5f5f5}
  .note{margin-top:28px;font-size:12px;color:#666}
  img{max-width:240px;border:1px solid #ddd}
</style>
</head>
<body>
  <h1>CMYK Proofing Assistant — Report</h1>
  <div class="meta">
    <div><strong>Profile:</strong> ${analysis.profile.label}${analysis.usedApproximate ? " (approximate simulation)" : ""}</div>
    <div><strong>Date:</strong> ${date}</div>
    <div><strong>Colors analyzed:</strong> ${analysis.summary.analyzedCount}</div>
    <div><strong>Readiness:</strong> ${analysis.summary.readiness}</div>
    <div>${analysis.summary.overview}</div>
  </div>
  ${thumbBase64 ? `<p><img src="data:image/png;base64,${thumbBase64}" alt="Soft proof thumbnail"/></p>` : ""}
  <table>
    <thead>
      <tr>
        <th>Original HEX</th>
        <th>CMYK proof HEX</th>
        <th>Suggested HEX</th>
        <th>Original CMYK</th>
        <th>Suggested CMYK</th>
        <th>ΔE00</th>
        <th>Severity</th>
        <th>Recommendation</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="note">Soft proofing is an on-screen simulation. Final appearance depends on the printer, paper, ink, press conditions, and ICC profile.</p>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="cmyk-proofing-report.html"');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default app;