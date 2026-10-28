import type { AuthConfig } from "convex/server";

export default {
  providers: [{ type: "customJwt", applicationID: "eiu-interactive", issuer: "https://eiu-learning.internal",
    jwks: process.env.EIU_AUTH_JWKS!, algorithm: "RS256" }],
} satisfies AuthConfig;
