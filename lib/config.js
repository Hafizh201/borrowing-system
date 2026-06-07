export function getConfig() {
  return {
    appsScriptUrl: process.env.APPS_SCRIPT_URL || "",
    fonnteToken: process.env.FONNTE_TOKEN || "",
    appUrl: process.env.APP_URL || "http://localhost:3000",
    cronSecret: process.env.CRON_SECRET || "",
    dryRun: String(process.env.DRY_RUN || "true").toLowerCase() === "true",
    sendWindowMinutes: Number(process.env.SEND_WINDOW_MINUTES || 90),
    extendHours: Number(process.env.EXTEND_HOURS || 24),
  };
}

export function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Environment variable ${name} belum diisi.`);
  }
}
