// Creates local signing material without printing credentials. Run once, then
// copy the documented variables to Vercel; reruns preserve existing keys.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
require("@next/env").loadEnvConfig(process.cwd());
const envPath = path.join(process.cwd(), ".env.local");
let source = fs.readFileSync(envPath, "utf8");
const values = {
  NEXT_PUBLIC_CONVEX_URL: "https://pleasant-cow-963.ap-southeast-2.convex.cloud",
  CONVEX_SITE_URL: "https://pleasant-cow-963.ap-southeast-2.convex.site",
  REALTIME_PROVIDER: "supabase",
  NEXT_PUBLIC_REALTIME_PROVIDER: "supabase",
  REALTIME_BRIDGE_SECRET: crypto.randomBytes(32).toString("hex"),
};
if (!process.env.CONVEX_JWT_PRIVATE_KEY) values.CONVEX_JWT_PRIVATE_KEY = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" });
for (const [key, value] of Object.entries(values)) if (!process.env[key]) source += `\n${key}=${JSON.stringify(value)}\n`;
fs.writeFileSync(envPath, source, { mode: 0o600 });
console.log("Local Convex URL, provider flags and signing material configured. Credentials were not printed.");
