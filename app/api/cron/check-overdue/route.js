export const dynamic = "force-dynamic";

const MINUTES_PER_DAY = 1440;

function clean(value) {
  return String(value ?? "").trim();
}

function upper(value) {
  return clean(value).toUpperCase();
}

function parseDate(value) {
  const text = clean(value);
  if (!text) return null;

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0)
    );
  }

  const fallback = new Date(text);
  if (Number.isNaN(fallback.getTime())) return null;

  return fallback;
}

function isPinjam(row) {
  return upper(row.mode) === "PINJAM";
}

function isKembali(row) {
  return upper(row.mode) === "KEMBALI";
}

function getIdBarang(row) {
  return clean(row.Idbarang || row.idbarang || row.uidbarang);
}

function normalizeWaNumber(number) {
  let value = clean(number).replace(/\D/g, "");

  if (value.startsWith("0")) {
    value = "62" + value.slice(1);
  }

  if (!value.startsWith("62")) {
    value = "62" + value;
  }

  return value;
}

function isReturnedAfter(riwayatRows, pinjamRow) {
  const idbarang = getIdBarang(pinjamRow);
  const token = clean(pinjamRow.extend_token);
  const waktuPinjam = parseDate(pinjamRow.waktu);

  if (!idbarang || !waktuPinjam) return false;

  return riwayatRows.some((row) => {
    if (!isKembali(row)) return false;

    const rowIdBarang = getIdBarang(row);
    const rowToken = clean(row.extend_token);
    const waktuKembali = parseDate(row.waktu);

    if (!waktuKembali) return false;

    const sameToken = token && rowToken && token === rowToken;

    const sameBarangAfter =
      rowIdBarang === idbarang &&
      waktuKembali.getTime() >= waktuPinjam.getTime();

    return sameToken || sameBarangAfter;
  });
}

function getLatestExtension(perpanjangRows, token) {
  const matches = perpanjangRows
    .filter((row) => clean(row.extend_token) === clean(token))
    .map((row) => ({
      ...row,
      date: parseDate(row.tenggat_baru),
    }))
    .filter((row) => row.date);

  if (matches.length === 0) return null;

  matches.sort((a, b) => b.date.getTime() - a.date.getTime());
  return matches[0];
}

function getReminderKey({ token, effectiveTenggat, reminderKe }) {
  return `${token}|${effectiveTenggat}|R${reminderKe}`;
}

function hasReminderBeenSent(reminderRows, reminderKey) {
  return reminderRows.some((row) => {
    const rowKey = clean(row.reminder_key || row.reminderkey);
    const rowStatus = upper(row.status);
    return rowKey === reminderKey && ["SENT", "DRY_RUN_SENT"].includes(rowStatus);
  });
}

function buildMessage({ nama, idbarang, waktu, tenggat, link, reminderKe }) {
  const reminderLine =
    reminderKe > 1
      ? `Ini adalah pengingat ke-${reminderKe} karena barang belum tercatat dikembalikan atau diperpanjang.`
      : `Ini adalah pengingat pertama karena barang sudah melewati batas pengembalian.`;

  return [
    `Assalamu’alaikum, ${nama}.`,
    ``,
    `Barang dengan ID "${idbarang}" yang Anda pinjam pada ${waktu} belum tercatat dikembalikan.`,
    `Batas pengembalian barang adalah ${tenggat}.`,
    ``,
    reminderLine,
    ``,
    `Silakan segera mengembalikan barang, atau ajukan perpanjangan melalui link berikut:`,
    ``,
    link,
    ``,
    `Terima kasih.`,
    `Smart Borrowing System`,
  ].join("\n");
}

async function fetchAppsScript(mode) {
  const baseUrl = process.env.APPS_SCRIPT_URL;

  if (!baseUrl) {
    throw new Error("APPS_SCRIPT_URL belum diisi di Environment Variables");
  }

  const url = `${baseUrl}?mode=${encodeURIComponent(mode)}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  const json = await response.json();

  if (!json.success && !json.ok) {
    throw new Error(`Apps Script gagal mode=${mode}: ${JSON.stringify(json)}`);
  }

  return json.data || [];
}

async function postAppsScript(payload) {
  const baseUrl = process.env.APPS_SCRIPT_URL;

  if (!baseUrl) {
    throw new Error("APPS_SCRIPT_URL belum diisi di Environment Variables");
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const json = await response.json();

  if (!response.ok || (!json.success && !json.ok)) {
    throw new Error(`Apps Script POST gagal: ${JSON.stringify(json)}`);
  }

  return json;
}

async function sendFonnte({ target, message }) {
  const token = process.env.FONNTE_TOKEN;
  const endpoint = process.env.FONNTE_API_URL || "https://api.fonnte.com/send";

  if (!token) {
    return {
      status: false,
      reason: "FONNTE_TOKEN belum diisi",
    };
  }

  try {
    const formData = new FormData();
    formData.append("target", normalizeWaNumber(target));
    formData.append("message", message);
    formData.append("countryCode", "62");
    formData.append("preview", "false");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    const fonnteSuccess = response.ok && data?.status === true;

    return {
      status: fonnteSuccess,
      http_status: response.status,
      endpoint,
      response: data,
    };
  } catch (error) {
    return {
      status: false,
      reason: "FETCH_FAILED",
      endpoint,
      error: String(error?.message || error),
    };
  }
}

async function logReminder({
  token,
  uidpeminjam,
  nama,
  kelas,
  idbarang,
  noWa,
  reminderKey,
  reminderKe,
  effectiveTenggat,
  status,
}) {
  const webKey = process.env.APPS_SCRIPT_WRITE_KEY || process.env.CRON_SECRET || "";

  return postAppsScript({
    mode: "simpanreminder",
    web_key: webKey,
    extend_token: token,
    uidpeminjam,
    nama,
    kelas,
    Idbarang: idbarang,
    no_wa: noWa,
    reminder_key: reminderKey,
    reminder_ke: String(reminderKe),
    tenggat_dasar: effectiveTenggat,
    status,
  });
}

export async function GET(request) {
  try {
    const requestUrl = new URL(request.url);

    const secret = requestUrl.searchParams.get("secret");
    const force = requestUrl.searchParams.get("force") === "true";

    if (secret !== process.env.CRON_SECRET) {
      return Response.json(
        {
          success: false,
          error: "Unauthorized cron request",
        },
        { status: 401 }
      );
    }

    const dryRun = String(process.env.DRY_RUN || "true") === "true";
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    const now = new Date();

    const [dataRows, riwayatRows, perpanjangRows, reminderRows] =
      await Promise.all([
        fetchAppsScript("getdata"),
        fetchAppsScript("getriwayat"),
        fetchAppsScript("getperpanjang"),
        fetchAppsScript("getreminder"),
      ]);

    const results = [];

    for (const row of riwayatRows) {
      if (!isPinjam(row)) continue;

      const idbarang = getIdBarang(row);
      const token = clean(row.extend_token);
      const nama = clean(row.nama);
      const kelas = clean(row.kelas);
      const uidpeminjam = clean(row.uidpeminjam);
      const waktu = clean(row.waktu);
      const rawTenggat = clean(row.Tenggat || row.tenggat);

      if (!idbarang || !token || !uidpeminjam || !rawTenggat) {
        results.push({
          status: "SKIP_INCOMPLETE",
          token,
          idbarang,
          tenggat: rawTenggat,
        });
        continue;
      }

      if (isReturnedAfter(riwayatRows, row)) {
        results.push({
          status: "SKIP_RETURNED",
          token,
          idbarang,
          tenggat: "",
        });
        continue;
      }

      const latestExtension = getLatestExtension(perpanjangRows, token);

      const effectiveTenggat = latestExtension
        ? clean(latestExtension.tenggat_baru)
        : rawTenggat;

      const tenggatDate = parseDate(effectiveTenggat);

      if (!tenggatDate) {
        results.push({
          status: "SKIP_NO_TENGGAT",
          token,
          idbarang,
          tenggat: effectiveTenggat,
        });
        continue;
      }

      const overdueMinutes = Math.floor(
        (now.getTime() - tenggatDate.getTime()) / 60000
      );

      if (overdueMinutes < 0) {
        results.push({
          status: "SKIP_NOT_OVERDUE",
          token,
          idbarang,
          tenggat: effectiveTenggat,
          overdueMinutes,
        });
        continue;
      }

      const reminderKe = Math.floor(overdueMinutes / MINUTES_PER_DAY) + 1;
      const reminderKey = getReminderKey({
        token,
        effectiveTenggat,
        reminderKe,
      });

      if (!force && hasReminderBeenSent(reminderRows, reminderKey)) {
        results.push({
          status: "SKIP_ALREADY_SENT",
          token,
          idbarang,
          tenggat: effectiveTenggat,
          overdueMinutes,
          reminder_ke: reminderKe,
          reminder_key: reminderKey,
        });
        continue;
      }

      const user = dataRows.find((item) => clean(item.uid) === uidpeminjam);
      const noWa = clean(user?.no_wa);

      if (!noWa) {
        results.push({
          status: "SKIP_NO_WA",
          token,
          idbarang,
          tenggat: effectiveTenggat,
          reminder_ke: reminderKe,
          reminder_key: reminderKey,
        });
        continue;
      }

      const link = `${appUrl}/perpanjang?token=${encodeURIComponent(token)}`;

      const message = buildMessage({
        nama,
        idbarang,
        waktu,
        tenggat: effectiveTenggat,
        link,
        reminderKe,
      });

      if (dryRun) {
        results.push({
          status: "DRY_RUN_SENT",
          token,
          idbarang,
          no_wa: noWa,
          tenggat: effectiveTenggat,
          overdueMinutes,
          reminder_ke: reminderKe,
          reminder_key: reminderKey,
          fonnte: {
            status: true,
            dry_run: true,
            detail: "DRY_RUN aktif, pesan tidak benar-benar dikirim.",
            target: normalizeWaNumber(noWa),
            message,
          },
        });

        continue;
      }

      const fonnteResult = await sendFonnte({
        target: noWa,
        message,
      });

      if (fonnteResult.status) {
        try {
          const logResult = await logReminder({
            token,
            uidpeminjam,
            nama,
            kelas,
            idbarang,
            noWa,
            reminderKey,
            reminderKe,
            effectiveTenggat,
            status: "SENT",
          });

          results.push({
            status: "SENT",
            token,
            idbarang,
            no_wa: noWa,
            tenggat: effectiveTenggat,
            overdueMinutes,
            reminder_ke: reminderKe,
            reminder_key: reminderKey,
            fonnte: fonnteResult,
            reminder_log: logResult,
          });
        } catch (logError) {
          results.push({
            status: "SENT_LOG_FAILED",
            token,
            idbarang,
            no_wa: noWa,
            tenggat: effectiveTenggat,
            overdueMinutes,
            reminder_ke: reminderKe,
            reminder_key: reminderKey,
            fonnte: fonnteResult,
            log_error: String(logError?.message || logError),
          });
        }

        continue;
      }

      results.push({
        status: "FAILED",
        token,
        idbarang,
        no_wa: noWa,
        tenggat: effectiveTenggat,
        overdueMinutes,
        reminder_ke: reminderKe,
        reminder_key: reminderKey,
        fonnte: fonnteResult,
      });
    }

    return Response.json({
      success: true,
      gateway: "fonnte",
      reminder_tracking: true,
      dry_run: dryRun,
      checked_at: new Date().toISOString(),
      total_rows_checked: riwayatRows.length,
      total_results: results.length,
      results,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        gateway: "fonnte",
        reminder_tracking: true,
        error: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
