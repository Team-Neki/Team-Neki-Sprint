import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
const requestedVersion = process.argv[2];
if (requestedVersion && requestedVersion !== manifest.version) {
  throw new Error(`Expected ${manifest.version}, got ${requestedVersion}`);
}

const tempDir = await mkdtemp(join(tmpdir(), "sprint-mcp-smoke-"));
try {
  let packageSpec = `${manifest.name}@${manifest.version}`;
  if (!requestedVersion) {
    const [packed] = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", tempDir], {
      cwd: packageDir,
      encoding: "utf8",
    }));
    packageSpec = join(tempDir, packed.filename);
  }

  const installDir = join(tempDir, "install");
  const maxAttempts = requestedVersion ? 13 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = execFileSync("npm", ["install", "--prefix", installDir, "--omit=dev", "--no-audit", "--no-fund", ...(requestedVersion ? ["--prefer-online"] : []), packageSpec], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      process.stdout.write(output);
      break;
    } catch (error) {
      const stderr = error.stderr?.toString() ?? "";
      const pending = requestedVersion && stderr.includes("ETARGET") && stderr.includes(`No matching version found for ${packageSpec}`);
      if (!pending || attempt === maxAttempts) {
        process.stderr.write(stderr);
        throw new Error(`Failed to install ${packageSpec} after ${attempt} attempt(s)`, { cause: error });
      }
      console.warn(`${packageSpec} is not available yet (attempt ${attempt}/${maxAttempts}); retrying in 15 seconds`);
      await new Promise((resolve) => setTimeout(resolve, 15_000));
    }
  }

  const installedDir = join(installDir, "node_modules", ...manifest.name.split("/"));
  const installed = JSON.parse(await readFile(join(installedDir, "package.json"), "utf8"));
  if (installed.name !== manifest.name || installed.version !== manifest.version) {
    throw new Error(`Installed ${installed.name}@${installed.version}, expected ${manifest.name}@${manifest.version}`);
  }

  const client = new Client({ name: "sprint-mcp-smoke", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(installedDir, installed.bin["sprint-mcp"])],
    env: { SPRINT_API_URL: "http://127.0.0.1:1", SPRINT_API_TOKEN: "smoke-test-only" },
  });
  try {
    await client.connect(transport, { timeout: 10_000 });
    if (client.getServerVersion()?.version !== manifest.version) {
      throw new Error(`Server reports ${client.getServerVersion()?.version}, expected ${manifest.version}`);
    }
    const { tools } = await client.listTools(undefined, { timeout: 10_000 });
    if (tools.length === 0) throw new Error("MCP server returned no tools");
    console.log(`${installed.name}@${installed.version}: initialize and ${tools.length} tools OK`);
  } finally {
    await client.close();
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
