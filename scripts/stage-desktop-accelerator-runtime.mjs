import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, chmod, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const runtimeManifestPath = path.join(repoRoot, "desktop-helper", "runtime", "runtime-manifest.json");
const acceleratorManifestPath = path.join(repoRoot, "desktop-helper", "desktop-accelerator.manifest.json");
const defaultOutputDir = path.join(repoRoot, "desktop-helper", "runtime", "staged");
const defaultCacheDir = path.join(repoRoot, "desktop-helper", "runtime", "cache");

function parseArgs(argv) {
  const parsed = {
    clean: false,
    outputDir: defaultOutputDir,
    cacheDir: defaultCacheDir,
    targets: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--clean") {
      parsed.clean = true;
      continue;
    }
    if (arg === "--output") {
      parsed.outputDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--cache-dir") {
      parsed.cacheDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--targets") {
      parsed.targets = argv[index + 1].split(",").map((value) => value.trim()).filter(Boolean);
      index += 1;
    }
  }

  return parsed;
}

function defaultTargetId() {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return `${process.platform}-${arch}`;
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`));
      }
    });
  });
}

async function extractArchive(archivePath, archiveType, destinationDir) {
  if (archiveType === "tar.gz") {
    await runCommand("tar", ["-xzf", archivePath, "-C", destinationDir]);
    return;
  }

  if (archiveType === "zip") {
    if (process.platform === "win32") {
      const archiveLiteral = archivePath.replace(/'/g, "''");
      const destinationLiteral = destinationDir.replace(/'/g, "''");
      await runCommand("powershell", [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${archiveLiteral}' -DestinationPath '${destinationLiteral}' -Force`,
      ]);
      return;
    }

    await runCommand("unzip", ["-oq", archivePath, "-d", destinationDir]);
    return;
  }

  throw new Error(`Unsupported archive type: ${archiveType}`);
}

async function downloadArchive(target, cacheDir) {
  await mkdir(cacheDir, { recursive: true });
  const archiveName = path.basename(new URL(target.archive.url).pathname);
  const archivePath = path.join(cacheDir, archiveName);

  if (await fileExists(archivePath)) {
    const existingHash = await sha256File(archivePath);
    if (existingHash === target.archive.sha256) {
      return archivePath;
    }
    await rm(archivePath, { force: true });
  }

  const response = await fetch(target.archive.url, {
    headers: { "User-Agent": "smart-tool-runtime-stager" },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${target.archive.url} (${response.status}).`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(archivePath));

  const actualHash = await sha256File(archivePath);
  if (actualHash !== target.archive.sha256) {
    await rm(archivePath, { force: true });
    throw new Error(`SHA256 mismatch for ${archiveName}. Expected ${target.archive.sha256}, received ${actualHash}.`);
  }

  return archivePath;
}

async function stageTarget(target, outputDir, cacheDir) {
  const destinationDir = path.join(outputDir, "runtimes", target.id);
  const stampPath = path.join(destinationDir, ".smart-tool-runtime.json");
  const expectedStamp = JSON.stringify({
    id: target.id,
    archiveUrl: target.archive.url,
    archiveSha256: target.archive.sha256,
    executable: target.executable,
    bundleSubpath: target.bundle_subpath,
  }, null, 2);

  if (await fileExists(stampPath)) {
    const currentStamp = await readFile(stampPath, "utf8");
    const executablePath = path.join(destinationDir, target.executable);
    if (currentStamp.trim() === expectedStamp && await fileExists(executablePath)) {
      return;
    }
  }

  const archivePath = await downloadArchive(target, cacheDir);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `smart-tool-runtime-${target.id}-`));

  try {
    await extractArchive(archivePath, target.archive.type, tempDir);
    const sourceDir = target.bundle_subpath
      ? path.join(tempDir, target.bundle_subpath)
      : tempDir;

    const sourceStat = await stat(sourceDir).catch(() => null);
    if (!sourceStat?.isDirectory()) {
      throw new Error(`Expected extracted runtime directory at ${sourceDir}.`);
    }

    await rm(destinationDir, { recursive: true, force: true });
    await mkdir(path.dirname(destinationDir), { recursive: true });
    await cp(sourceDir, destinationDir, { recursive: true });

    const executablePath = path.join(destinationDir, target.executable);
    if (!(await fileExists(executablePath))) {
      throw new Error(`Expected runtime executable at ${executablePath}.`);
    }
    if (!target.executable.endsWith(".exe")) {
      await chmod(executablePath, 0o755);
    }

    await writeFile(stampPath, `${expectedStamp}\n`, "utf8");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runtimeManifest = JSON.parse(await readFile(runtimeManifestPath, "utf8"));
  const requestedTargetIds = options.targets.length > 0 ? options.targets : [defaultTargetId()];
  const requestedTargets = requestedTargetIds.map((targetId) => {
    const target = runtimeManifest.targets.find((candidate) => candidate.id === targetId);
    if (!target) {
      throw new Error(`No runtime manifest entry configured for ${targetId}.`);
    }
    return target;
  });

  if (options.clean) {
    await rm(options.outputDir, { recursive: true, force: true });
  }

  await mkdir(options.outputDir, { recursive: true });
  await cp(acceleratorManifestPath, path.join(options.outputDir, "manifest.json"));

  for (const target of requestedTargets) {
    await stageTarget(target, options.outputDir, options.cacheDir);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
