import "server-only";

/**
 * Centralised, server-only access to environment variables.
 * Throws a clear error at call time if something is missing.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local (see .env.example).`,
    );
  }
  return value;
}

export const env = {
  paypal: {
    get clientId() {
      return required("PAYPAL_CLIENT_ID");
    },
    get clientSecret() {
      return required("PAYPAL_CLIENT_SECRET");
    },
    /** Defaults to SANDBOX. Only the literal "LIVE" switches to production. */
    get isSandbox() {
      return (process.env.PAYPAL_ENVIRONMENT ?? "SANDBOX").toUpperCase() !== "LIVE";
    },
    get apiBase() {
      return this.isSandbox
        ? "https://api-m.sandbox.paypal.com"
        : "https://api-m.paypal.com";
    },
    get webhookId() {
      return process.env.PAYPAL_WEBHOOK_ID || "";
    },
  },
  supabase: {
    get url() {
      return required("NEXT_PUBLIC_SUPABASE_URL");
    },
    get anonKey() {
      return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    },
    get serviceRoleKey() {
      return process.env.SUPABASE_SERVICE_ROLE_KEY || this.anonKey;
    },
    get hasServiceRoleKey() {
      return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    },
  },
  ai: {
    get geminiModel() {
      return process.env.GEMINI_MODEL || "gemini-flash-latest";
    },
    get hasGeminiKey() {
      return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    },
  },
};
