import type {
  AnalysisResult,
  ImageMeta,
  ProfileId,
  ProfileInfo,
} from "@cmyk/shared";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function fetchProfiles(): Promise<ProfileInfo[]> {
  const data = await parseJson<{ profiles: ProfileInfo[] }>(
    await fetch("/api/profiles"),
  );
  return data.profiles;
}

export async function fetchMeta(file: File): Promise<ImageMeta> {
  const form = new FormData();
  form.append("file", file);
  const data = await parseJson<{ meta: ImageMeta }>(
    await fetch("/api/meta", { method: "POST", body: form }),
  );
  return data.meta;
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
    proofPngBase64: string;
  }>(await fetch("/api/proof", { method: "POST", body: form }));

  return {
    profile: data.profile,
    usedApproximate: data.usedApproximate,
    width: data.width,
    height: data.height,
    proofUrl: `data:image/png;base64,${data.proofPngBase64}`,
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

export async function downloadProof(file: File, profileId: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("profileId", profileId);
  const res = await fetch("/api/export/proof", { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  triggerDownload(blob, "cmyk-soft-proof.png");
}

export async function downloadReport(file: File | null, profileId: string, seed = false) {
  const form = new FormData();
  if (file) form.append("file", file);
  form.append("profileId", profileId);
  if (seed) form.append("seed", "1");
  const res = await fetch("/api/export/report", { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  triggerDownload(blob, "cmyk-proofing-report.html");
}

export async function downloadTiff(file: File, profileId: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("profileId", profileId);
  const res = await fetch("/api/export/tiff", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "TIFF export failed");
  }
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
