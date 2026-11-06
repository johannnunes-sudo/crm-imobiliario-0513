import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { db } from "./database";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  secret: process.env.BETTER_AUTH_SECRET,
  // Produção: só o endereço oficial (WEBSITE_URL). Desenvolvimento: aceita a origem local.
  trustedOrigins: (request) => {
    if (process.env.NODE_ENV === "production" && process.env.WEBSITE_URL) return [process.env.WEBSITE_URL];
    const origin = request?.headers.get("origin");
    return origin ? [origin] : ["*"];
  },
  plugins: [bearer()],
});
