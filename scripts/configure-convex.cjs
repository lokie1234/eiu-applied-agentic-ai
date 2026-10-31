// Push only the public JWT verification key and the shared bridge credential.
// Never upload the Supabase key or the private JWT signing key to Convex.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
require("@next/env").loadEnvConfig(process.cwd());
if (!process.env.CONVEX_DEPLOY_KEY || !process.env.CONVEX_JWT_PRIVATE_KEY || !process.env.REALTIME_BRIDGE_SECRET) throw new Error("Run setup-realtime.cjs and configure CONVEX_DEPLOY_KEY first.");
const key = crypto.createPublicKey(process.env.CONVEX_JWT_PRIVATE_KEY.replace(/\\n/g, "\n")).export({ format: "jwk" });
const jwks = { keys: [{ ...key, kid: "eiu-realtime-v1", alg: "RS256", use: "sig" }] };
const values = { EIU_AUTH_JWKS: `data:text/plain;charset=utf-8;base64,${Buffer.from(JSON.stringify(jwks)).toString("base64")}`, EIU_REALTIME_BRIDGE_SECRET: process.env.REALTIME_BRIDGE_SECRET };
const dir = path.join(process.cwd(), ".tmp"); fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, "convex-bootstrap.env");
fs.writeFileSync(file, Object.entries(values).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join("\n"), { mode: 0o600 });
try {
  // Existing deployments must be updated too; the CLI otherwise refuses a
  // changed verification key or bridge credential when importing an env file.
  const result = spawnSync(process.execPath, [path.join(process.cwd(), "node_modules/convex/bin/main.js"), "env", "set", "--force", "--from-file", file], { env: process.env, encoding: "utf8" });
  if (result.status !== 0) {
    let message = (result.stderr || "Convex configuration failed.");
    for (const secret of [process.env.CONVEX_DEPLOY_KEY, ...Object.values(values)]) message = message.replaceAll(secret, "[redacted]");
    throw new Error(message);
  }
  console.log("Convex authentication verification key and bridge credential configured. Secret values were not printed.");
  console.log("The web server must use the same signing key and bridge credential. For a new deployment, also run npx convex deploy to install auth.config.ts and functions.");
} finally { fs.unlinkSync(file); }
