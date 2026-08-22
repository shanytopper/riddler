// Creates (or finds) the prototype's Render web service and triggers a deploy (decision D27).
//
//   node --env-file=apps/api/.env apps/api/scripts/render-deploy.mjs --repo https://github.com/<owner>/<repo> [--branch main]
//
// Needs a Render API key in RENDER_API_KEY (or the Windows machine variable Render_Key) and the
// database's id in RENDER_POSTGRES_ID (apps/api/.env). The repository must be reachable by Render:
// public, or private with GitHub connected to the workspace in the Render dashboard. The service's
// DATABASE_URL is the database's *internal* connection string (same region, private network).
// Mirrors render.yaml; the blueprint remains the human-readable description of the same service.
import { argv, env, exit } from "node:process";

const API = "https://api.render.com/v1";
const SERVICE_NAME = "riddles-api";
const REGION = "frankfurt";

const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const repo = arg("--repo");
const branch = arg("--branch", "main");
const key = env.RENDER_API_KEY ?? env.Render_Key ?? env.RENDER_KEY;
const postgresId = env.RENDER_POSTGRES_ID;
if (!repo || !key || !postgresId) {
  console.error(
    "usage: --repo <url> [--branch main]; needs RENDER_API_KEY (or Render_Key) and RENDER_POSTGRES_ID",
  );
  exit(2);
}

const headers = {
  authorization: `Bearer ${key}`,
  accept: "application/json",
  "content-type": "application/json",
};
async function call(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON error body
  }
  if (!response.ok)
    throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 400)}`);
  return json;
}

const owners = await call("GET", "/owners?limit=20");
const owner = owners[0]?.owner;
if (!owner) throw new Error("no Render workspace visible to this key");
console.log(`workspace: ${owner.name} (${owner.id})`);

const info = await call("GET", `/postgres/${postgresId}/connection-info`);
const databaseUrl = info.internalConnectionString;
if (!databaseUrl)
  throw new Error("database has no internal connection string yet (still creating?)");

const existing = (
  await call("GET", `/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=10`)
).find((entry) => entry.service?.name === SERVICE_NAME)?.service;

let service = existing;
if (!service) {
  service = await call("POST", "/services", {
    type: "web_service",
    name: SERVICE_NAME,
    ownerId: owner.id,
    repo,
    branch,
    autoDeploy: "yes",
    rootDir: ".",
    envVars: [
      { key: "NODE_VERSION", value: "24" },
      { key: "DATABASE_URL", value: databaseUrl },
    ],
    serviceDetails: {
      env: "node",
      runtime: "node",
      plan: "free",
      region: REGION,
      numInstances: 1,
      healthCheckPath: "/health",
      envSpecificDetails: {
        buildCommand: "npm ci && npm run build",
        startCommand: "node apps/api/src/main.ts",
      },
    },
  });
  // POST /services returns { service, deployId }
  service = service.service ?? service;
  console.log(`created service ${service.id}`);
} else {
  console.log(`found service ${service.id}; updating DATABASE_URL and redeploying`);
  await call("PUT", `/services/${service.id}/env-vars`, [
    { key: "NODE_VERSION", value: "24" },
    { key: "DATABASE_URL", value: databaseUrl },
  ]);
  await call("POST", `/services/${service.id}/deploys`, {});
}

const url = service.serviceDetails?.url ?? `https://${SERVICE_NAME}.onrender.com`;
console.log(`service url: ${url}`);
console.log("waiting for the deploy to go live (a cold build takes several minutes)...");
for (let i = 0; i < 90; i++) {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const deploys = await call("GET", `/services/${service.id}/deploys?limit=1`);
  const latest = deploys[0]?.deploy;
  const status = latest?.status ?? "unknown";
  if (i % 3 === 0) console.log(`  ${i * 10}s: ${status}`);
  if (status === "live") {
    console.log(`live: ${url}`);
    exit(0);
  }
  if (["build_failed", "update_failed", "canceled", "deactivated"].includes(status)) {
    console.error(`deploy ${status}; see the Render dashboard logs`);
    exit(1);
  }
}
console.error("timed out waiting for the deploy; check the Render dashboard");
exit(1);
