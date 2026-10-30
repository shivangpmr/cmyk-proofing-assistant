import type { AnalysisResult, ProfileId, ProfileInfo } from "@cmyk/shared";

async function errorFrom(res: Response): Promise<Error> {
  const text = await res.text();
  if (res.status === 413 || text.includes("PAYLOAD_TOO_LARGE")) {
    return new Error(
      "This file is too large for the hosted preview. Try a smaller export, or run the app locally for full-size files.",
    );
  }
  try {
    const json = JSON.parse(text) as { error?: string };
    if (json.error) return new Error(json.error);
  } catch {
    // not JSON
  }
  return new Error(text || res.statusText);
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorFrom(res);
  return res.json() as Promise<T>;
}

export async function fetchProfiles(): Promise<ProfileInfo[]> {
  const data = await parseJson<{ profiles: ProfileInfo[] }>(
    await fetch("/api/profiles"),
  );
  return data.profiles;
}

export async function fetchProof(
  file: File,
  profileId: ProfileId | string,
): Promise<{
  profile: ProfileInfo;
  usedApproximate: boolean;
  width: number;
  height: number;
  proofUrl: string;
}> {
  const form = new FormData();
  form.append("file", file);
  form.append("profileId", profileId);
  const data = await parseJson<{
    profile: ProfileInfo;
    usedApproximate: boolean;
    width: number;
    height: number;
    proofBase64: string;
    proofMime: string;
  }>(await fetch("/api/proof", { method: "POST", body: form }));

  return {
    profile: data.profile,
    usedApproximate: data.usedApproximate,
    width: data.width,
    height: data.height,
    proofUrl: `data:${data.proofMime};base64,${data.proofBase64}`,
  };
}

export async function fetchAnalysis(
  file: File,
  profileId: ProfileId | string,
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("profileId", profileId);
  const data = await parseJson<{ analysis: AnalysisResult }>(
    await fetch("/api/analyze", { method: "POST", body: form }),
  );
  return data.analysis;
}

export async function fetchSeedAnalysis(
  profileId: ProfileId | string,
): Promise<AnalysisResult> {
  const data = await parseJson<{ analysis: AnalysisResult }>(
    await fetch("/api/seed-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    }),
  );
  return data.analysis;
}

export async function downloadProof(proofUrl: string, profileLabel: string) {
  const blob = await (await fetch(proofUrl)).blob();
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const slug = profileLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  triggerDownload(blob, `cmyk-soft-proof-${slug}.${ext}`);
}

export async function downloadReport(file: File | null, profileId: string, seed = false) {
  const form = new FormData();
  if (file) form.append("file", file);
  form.append("profileId", profileId);
  if (seed) form.append("seed", "1");
  const res = await fetch("/api/export/report", { method: "POST", body: form });
  if (!res.ok) throw await errorFrom(res);
  const blob = await res.blob();
  triggerDownload(blob, "cmyk-proofing-report.html");
}

export async function downloadTiff(file: File, profileId: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("profileId", profileId);
  const res = await fetch("/api/export/tiff", { method: "POST", body: form });
  if (!res.ok) throw await errorFrom(res);
  const blob = await res.blob();
  triggerDownload(blob, "cmyk-export.tif");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
