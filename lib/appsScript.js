import { getConfig, requireEnv } from "./config";
import { clean } from "./utils";

function unwrapAppsScriptJson(json) {
  if (Array.isArray(json)) return json;

  if (json?.success === false || json?.ok === false) {
    throw new Error(json.error || json.message || "Apps Script mengembalikan error.");
  }

  if (Array.isArray(json?.data)) return json.data;

  // Beberapa macro memakai bentuk { ok:true, data:{ riwayat: [...] } }
  if (json?.data && typeof json.data === "object") {
    return json.data;
  }

  return json;
}

async function requestAppsScript(params = {}, options = {}) {
  const { appsScriptUrl } = getConfig();
  requireEnv("APPS_SCRIPT_URL", appsScriptUrl);

  const method = options.method || "GET";

  if (method === "GET") {
    const url = new URL(appsScriptUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const text = await response.text();
    let json;

    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Respons Apps Script bukan JSON: ${text.slice(0, 200)}`);
    }

    return unwrapAppsScriptJson(json);
  }

  const response = await fetch(appsScriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
    cache: "no-store",
  });

  const text = await response.text();
  let json;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Respons Apps Script bukan JSON: ${text.slice(0, 200)}`);
  }

  if (json?.success === false || json?.ok === false) {
    throw new Error(json.error || json.message || "Apps Script POST gagal.");
  }

  return json;
}

export async function getDataRows() {
  const result = await requestAppsScript({ mode: "getdata" });

  if (Array.isArray(result)) return result;

  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.siswa)) return result.siswa;

  return [];
}

export async function getRiwayatRows() {
  const result = await requestAppsScript({ mode: "getriwayat" });

  if (Array.isArray(result)) return result;

  if (Array.isArray(result?.riwayat)) return result.riwayat;
  if (Array.isArray(result?.data)) return result.data;

  return [];
}

export async function getReminderRows() {
  try {
    const result = await requestAppsScript({ mode: "getreminder" });

    if (Array.isArray(result)) return result;

    if (Array.isArray(result?.reminder)) return result.reminder;
    if (Array.isArray(result?.data)) return result.data;

    return [];
  } catch (error) {
    console.warn("getReminderRows gagal. Pastikan macro punya mode=getreminder.", error);
    return [];
  }
}

export async function submitReminderLog({
  extend_token,
  uidpeminjam,
  nama,
  kelas,
  Idbarang,
  no_wa,
  status,
}) {
  return requestAppsScript(
    {
      mode: "reminder",
      extend_token: clean(extend_token),
      uidpeminjam: clean(uidpeminjam),
      nama: clean(nama),
      kelas: clean(kelas),
      Idbarang: clean(Idbarang),
      no_wa: clean(no_wa),
      status: clean(status || "SENT"),
    },
    {
      method: "POST",
    }
  );
}

export async function getPerpanjangRows() {
  try {
    const result = await requestAppsScript({ mode: "getperpanjang" });

    if (Array.isArray(result)) return result;

    if (Array.isArray(result?.perpanjang)) return result.perpanjang;
    if (Array.isArray(result?.data)) return result.data;

    return [];
  } catch (error) {
    console.warn("getPerpanjangRows gagal. Pastikan macro punya mode=getperpanjang.", error);
    return [];
  }
}

export async function submitPerpanjang({
  extend_token,
  tambah_hari,
  tenggat_baru,
  waktu_perpanjang,
  alasan,
}) {
  return requestAppsScript(
    {
      mode: "perpanjang",
      extend_token: clean(extend_token),
      tambah_hari: clean(tambah_hari || 1),
      tenggat_baru: clean(tenggat_baru),
      waktu_perpanjang: clean(waktu_perpanjang),
      alasan: clean(alasan),
    },
    {
      method: "POST",
    }
  );
}
