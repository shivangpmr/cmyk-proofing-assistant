/**
 * Attempts to download a redistributable FOGRA39-based ICC profile
 * (basICColor ISOcoated_v2_bas) from OpenICC / SourceForge.
 * Large archives are avoided when a direct mirror is unavailable —
 * fall back to profiles/README.md instructions.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const profilesDir = path.resolve(__dirname, "../profiles");
const target = path.join(profilesDir, "ISOcoated_v2_bas.ICC");

if (fs.existsSync(target)) {
  console.log("Profile already present:", target);
  process.exit(0);
}

fs.mkdirSync(profilesDir, { recursive: true });

const url =
  "https://downloads.sourceforge.net/project/openicc/basICColor-Profiles/basICColor_Offset_2009-1.1.1.tar.gz";

console.log("Downloading basICColor Offset 2009 package (large)…");
console.log(url);
console.log("If this fails, manually place ISOcoated_v2_bas.ICC or ISOcoated_v2_eci.icc in /profiles");

const archive = path.join(profilesDir, "_basiccolor.tar.gz");

try {
  execSync(`curl -L --fail -o "${archive}" "${url}"`, { stdio: "inherit" });
  execSync(
    `tar -tzf "${archive}" | findstr /i "ISOcoated_v2_bas"`,
    { stdio: "pipe", shell: "cmd.exe" },
  );
  // Extract matching file with tar
  const list = execSync(`tar -tzf "${archive}"`, { encoding: "utf8" });
  const entry = list
    .split(/\r?\n/)
    .find((l) => /ISOcoated_v2_bas\.ICC$/i.test(l.trim()));
  if (!entry) throw new Error("ISOcoated_v2_bas.ICC not found in archive");
  execSync(`tar -xzf "${archive}" -C "${profilesDir}" "${entry.trim()}"`, {
    stdio: "inherit",
  });
  // Move to flat profiles dir if nested
  const nested = path.join(profilesDir, entry.trim());
  if (fs.existsSync(nested) && nested !== target) {
    fs.renameSync(nested, target);
  }
  fs.rmSync(archive, { force: true });
  console.log("Installed:", target);
} catch (err) {
  console.error("Automatic fetch failed:", err);
  console.error("Place ICC files manually — see profiles/README.md");
  process.exitCode = 1;
}
