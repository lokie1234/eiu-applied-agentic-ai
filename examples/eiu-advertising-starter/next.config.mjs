import { fileURLToPath } from "node:url";

export default {
  // Keep the extracted sample independent from neighboring projects.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};
