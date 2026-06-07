import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function clean(value) {
  return String(value ?? "").trim();
}

export async function POST(request) {
  const formData = await request.formData();

  const extend_token = clean(formData.get("extend_token"));
  const alasan = clean(formData.get("alasan")); // boleh kosong
  const tambah_hari = clean(formData.get("tambah_hari")) || "1";

  const successUrl = new URL("/perpanjang/berhasil", request.url);
  const failedUrl = new URL("/perpanjang/gagal", request.url);

  if (!extend_token) {
    return NextResponse.redirect(failedUrl);
  }

  const appsScriptUrl = process.env.APPS_SCRIPT_URL;

  if (!appsScriptUrl) {
    console.error("APPS_SCRIPT_URL belum diisi.");
    return NextResponse.redirect(failedUrl);
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
      return NextResponse.redirect(failedUrl);
    }

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error("Submit perpanjang error:", error);
    return NextResponse.redirect(failedUrl);
  }
}