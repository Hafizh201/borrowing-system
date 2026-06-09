import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function clean(value) {
  return String(value ?? "").trim();
}

function getIdBarang(row) {
  return clean(row.Idbarang || row.idbarang || row.uidbarang);
}

function getBarangName(barangRows, idbarang) {
  const item = barangRows.find((row) => clean(row.uidbarang) === clean(idbarang));
  const namaBarang = clean(item?.namabarang || item?.nama_barang || item?.NamaBarang || item?.nama);
  return namaBarang || "Barang terdaftar";
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

async function fetchAppsScript(mode) {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;

  if (!appsScriptUrl) {
    throw new Error("APPS_SCRIPT_URL belum diisi.");
  }

  const response = await fetch(`${appsScriptUrl}?mode=${encodeURIComponent(mode)}`, {
    cache: "no-store",
  });

  const json = await response.json();

  if (!response.ok || (!json.success && !json.ok)) {
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

    return {
      status: response.ok && data?.status === true,
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

function buildPerpanjangSuccessMessage({
  nama,
  namaBarang,
  tambahHari,
  tenggatLama,
  tenggatBaru,
}) {
  return [
    `Assalamu’alaikum, ${nama}.`,
    "",
    `Perpanjangan peminjaman barang "${namaBarang}" berhasil tercatat di sistem.`,
    "",
    `Tambahan waktu: ${tambahHari} hari.`,
    `Tenggat lama: ${tenggatLama}.`,
    `Tenggat baru: ${tenggatBaru}.`,
    "",
    "Silakan menjaga barang dengan baik dan mengembalikannya sesuai tenggat baru.",
    "",
    "Terima kasih.",
    "Smart Borrowing System",
  ].join("\n");
}

async function sendPerpanjangNotification({ extendToken, tambahHari, result }) {
  const [dataRows, barangRows, riwayatRows] = await Promise.all([
    fetchAppsScript("getdata"),
    fetchAppsScript("getbarang"),
    fetchAppsScript("getriwayat"),
  ]);

  const pinjamRow = [...riwayatRows]
    .reverse()
    .find(
      (row) =>
        clean(row.extend_token) === extendToken &&
        clean(row.mode).toUpperCase() === "PINJAM"
    );

  if (!pinjamRow) {
    return {
      status: false,
      reason: "PINJAM_ROW_NOT_FOUND",
    };
  }

  const user = dataRows.find((item) => clean(item.uid) === clean(pinjamRow.uidpeminjam));
  const noWa = clean(user?.no_wa);

  if (!noWa) {
    return {
      status: false,
      reason: "NO_WA_NOT_FOUND",
    };
  }

  const tenggatLama = clean(result?.tenggat_lama || result?.data?.tenggat_lama);
  const tenggatBaru = clean(result?.tenggat_baru || result?.data?.tenggat_baru);
  const namaBarang = getBarangName(barangRows, getIdBarang(pinjamRow));

  const message = buildPerpanjangSuccessMessage({
    nama: clean(pinjamRow.nama),
    namaBarang,
    tambahHari,
    tenggatLama,
    tenggatBaru,
  });

  const fonnte = await sendFonnte({
    target: noWa,
    message,
  });

  return {
    status: fonnte.status,
    no_wa: noWa,
    namabarang: namaBarang,
    fonnte,
  };
}

export async function POST(request) {
  const formData = await request.formData();

  const extend_token = clean(formData.get("extend_token"));
  const alasan = clean(formData.get("alasan"));
  const tambah_hari = clean(formData.get("tambah_hari")) || "1";

  const successUrl = new URL("/perpanjang/berhasil", request.url);
  const failedUrl = new URL("/perpanjang/gagal", request.url);

  if (!extend_token) {
    return NextResponse.redirect(failedUrl, 303);
  }

  const appsScriptUrl = process.env.APPS_SCRIPT_URL;

  if (!appsScriptUrl) {
    console.error("APPS_SCRIPT_URL belum diisi.");
    return NextResponse.redirect(failedUrl, 303);
  }

  try {
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "perpanjang",
        extend_token,
        tambah_hari,
        alasan,
      }),
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok || (!result.success && !result.ok)) {
      console.error("Apps Script error:", result);
      return NextResponse.redirect(failedUrl, 303);
    }

    try {
      const notification = await sendPerpanjangNotification({
        extendToken: extend_token,
        tambahHari: tambah_hari,
        result,
      });

      successUrl.searchParams.set("notif", notification.status ? "sent" : "failed");
    } catch (notificationError) {
      console.error("Notif perpanjang error:", notificationError);
      successUrl.searchParams.set("notif", "failed");
    }

    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    console.error("Submit perpanjang error:", error);
    return NextResponse.redirect(failedUrl, 303);
  }
}
