import http from "node:http";
import { fileURLToPath } from "node:url";
import {
  createDesktopAcceleratorHost,
  createError,
  DEFAULT_HOST,
  DEFAULT_INTERNAL_PORT,
  parseCommaList,
} from "./host.js";

const DEFAULT_PORT = 43117;
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "https://wwessex.github.io",
  "https://smartactiontool.app",
  "https://www.smartactiontool.app",
];
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function withCors(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  };
}

function sendJson(res, statusCode, payload, origin, allowedOrigins) {
  res.writeHead(statusCode, {
    ...JSON_HEADERS,
    ...withCors(origin, allowedOrigins),
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw createError(415, { error: "Requests must use application/json." });
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
    const size = chunks.reduce((sum, part) => sum + part.length, 0);
    if (size > 1_000_000) {
      throw createError(413, { error: "Request body too large." });
    }
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw createError(400, { error: "Invalid JSON body." });
  }
}


export function createDesktopHelperServer(options = {}) {
  const allowedOrigins = [
    ...DEFAULT_ALLOWED_ORIGINS,
    ...parseCommaList(process.env.SMART_TOOL_ALLOWED_ORIGINS),
    ...parseCommaList(process.env.SMART_TOOL_APP_ORIGIN),
    ...(options.allowedOrigins || []),
  ].filter((value, index, list) => list.indexOf(value) === index);

  const host = options.host || DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const engine = options.engine || createDesktopAcceleratorHost({
    host,
    internalPort: options.internalPort || DEFAULT_INTERNAL_PORT,
  });

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.includes(origin)) {
      sendJson(res, 403, { error: "Origin not allowed." }, origin, allowedOrigins);
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, withCors(origin, allowedOrigins));
      res.end();
      return;
    }

    try {
      if (req.method === "GET" && req.url === "/health") {
        sendJson(res, 200, engine.health(), origin, allowedOrigins);
        return;
      }

      if (req.method === "POST" && req.url === "/load") {
        const body = await readJsonBody(req);
        if (typeof body.model_id !== "string" || !body.model_id.trim()) {
          throw createError(400, { error: "model_id is required." });
        }
        sendJson(res, 200, await engine.load(body.model_id), origin, allowedOrigins);
        return;
      }

      if (req.method === "POST" && req.url === "/generate") {
        const body = await readJsonBody(req);
        if (typeof body.prompt !== "string" || !body.prompt.trim()) {
          throw createError(400, { error: "prompt is required." });
        }
        if (body.config != null && typeof body.config !== "object") {
          throw createError(400, { error: "config must be an object." });
        }
        sendJson(res, 200, await engine.generate(body.prompt, body.config || {}), origin, allowedOrigins);
        return;
      }

      if (req.method === "POST" && req.url === "/unload") {
        await readJsonBody(req);
        sendJson(res, 200, await engine.unload(), origin, allowedOrigins);
        return;
      }

      throw createError(404, { error: "Not found." });
    } catch (error) {
      sendJson(
        res,
        error.statusCode || 500,
        error.payload || { error: error.message || "Internal server error." },
        origin,
        allowedOrigins,
      );
    }
  });

  return {
    server,
    engine,
    allowedOrigins,
    async start() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve();
        });
      });
      return server.address();
    },
    async stop() {
      await engine.unload().catch(() => undefined);
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

export { createDesktopAcceleratorHost, DEFAULT_HOST, DEFAULT_INTERNAL_PORT, LlamaCppEngine } from "./host.js";

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] === thisFile) {
  const app = createDesktopHelperServer();
  app.start()
    .then(() => {
      process.stdout.write(`Desktop helper listening on http://${DEFAULT_HOST}:${DEFAULT_PORT}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
