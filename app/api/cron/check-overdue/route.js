export const dynamic = "force-dynamic";

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

function buildMessage({ nama, idbarang, waktu, tenggat, link }) {
  return [
    `Assalamu’alaikum, ${nama}.`,
    ``,
    `Barang dengan ID "${idbarang}" yang Anda pinjam pada ${waktu} belum tercatat dikembalikan.`,
    ``,
    `Batas pengembalian barang adalah ${tenggat}.`,
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
    const sendWindowMinutes = Number(process.env.SEND_WINDOW_MINUTES || 90);
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    const now = new Date();

    const [dataRows, riwayatRows, perpanjangRows] = await Promise.all([
      fetchAppsScript("getdata"),
      fetchAppsScript("getriwayat"),
      fetchAppsScript("getperpanjang"),
    ]);

    const results = [];

    for (const row of riwayatRows) {
      if (!isPinjam(row)) continue;

      const idbarang = getIdBarang(row);
      const token = clean(row.extend_token);
      const nama = clean(row.nama);
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

      if (!force && overdueMinutes > sendWindowMinutes) {
        results.push({
          status: "SKIP_OUTSIDE_SEND_WINDOW",
          token,
          idbarang,
          tenggat: effectiveTenggat,
          overdueMinutes,
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
      });

      if (dryRun) {
        results.push({
          status: "DRY_RUN_SENT",
          token,
          idbarang,
          no_wa: noWa,
          tenggat: effectiveTenggat,
          overdueMinutes,
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

      results.push({
        status: fonnteResult.status ? "SENT" : "FAILED",
        token,
        idbarang,
        no_wa: noWa,
        tenggat: effectiveTenggat,
        overdueMinutes,
        fonnte: fonnteResult,
      });
    }

    return Response.json({
      success: true,
      gateway: "fonnte",
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
        error: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
