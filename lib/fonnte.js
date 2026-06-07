import { getConfig, requireEnv } from "./config";
import { normalizePhone } from "./utils";

export async function sendFonnteMessage({ target, message }) {
  const { fonnteToken, dryRun } = getConfig();

  const normalizedTarget = normalizePhone(target);

  if (!normalizedTarget) {
    return {
      status: false,
      reason: "Nomor WhatsApp kosong atau tidak valid.",
    };
  }

  if (dryRun) {
    return {
      status: true,
      dry_run: true,
      detail: "DRY_RUN aktif, pesan tidak benar-benar dikirim.",
      target: [normalizedTarget],
      message,
    };
  }

  requireEnv("FONNTE_TOKEN", fonnteToken);

  const formData = new FormData();
  formData.append("target", normalizedTarget);
  formData.append("message", message);
  formData.append("countryCode", "62");
  formData.append("preview", "false");
  formData.append("typing", "true");

  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: fonnteToken,
    },
    body: formData,
  });

  const json = await response.json();

  return json;
}
