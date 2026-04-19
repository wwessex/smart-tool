import { spawnSync } from "node:child_process";

const [, , scriptPath, ...scriptArgs] = process.argv;

if (!scriptPath) {
  console.error("Usage: node scripts/run-python.mjs <script.py> [args...]");
  process.exit(1);
}

const candidates =
  process.platform === "win32"
    ? [
        ["py", ["-3", scriptPath, ...scriptArgs]],
        ["python", [scriptPath, ...scriptArgs]],
      ]
    : [
        ["python3", [scriptPath, ...scriptArgs]],
        ["python", [scriptPath, ...scriptArgs]],
      ];

for (const [command, args] of candidates) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    continue;
  }

  process.exit(result.status ?? 0);
}

console.error("Unable to find a usable Python interpreter. Tried:", candidates.map(([command]) => command).join(", "));
process.exit(1);
