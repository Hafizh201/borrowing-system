import {
  clean,
  upper,
  parseLocalDate,
  getRowIdBarang,
  getRowTenggat,
  getRowToken,
} from "./utils";

export function isPinjam(row) {
  return upper(row.mode) === "PINJAM";
}

export function isKembali(row) {
  return upper(row.mode) === "KEMBALI";
}

export function isReturnedAfter(riwayatRows, pinjamRow) {
  const idbarang = getRowIdBarang(pinjamRow);
  const waktuPinjam = parseLocalDate(pinjamRow.waktu);

  if (!idbarang || !waktuPinjam) return false;

  return riwayatRows.some((row) => {
    const rowIdBarang = getRowIdBarang(row);
    const waktuRow = parseLocalDate(row.waktu);

    return (
      isKembali(row) &&
      rowIdBarang === idbarang &&
      waktuRow &&
      waktuRow.getTime() >= waktuPinjam.getTime()
    );
  });
}

export function getLatestExtension(perpanjangRows, token) {
  const matches = perpanjangRows
    .filter((row) => clean(row.extend_token) === clean(token))
    .map((row) => ({
      ...row,
      date: parseLocalDate(row.tenggat_baru),
    }))
    .filter((row) => row.date);

  if (matches.length === 0) return null;

  matches.sort((a, b) => b.date.getTime() - a.date.getTime());

  return matches[0];
}

export function getEffectiveTenggat(pinjamRow, perpanjangRows) {
  const token = getRowToken(pinjamRow);
  const extension = getLatestExtension(perpanjangRows, token);

  if (extension?.tenggat_baru) {
    return clean(extension.tenggat_baru);
  }

  return getRowTenggat(pinjamRow);
}

export function findLoanByToken({ riwayatRows, perpanjangRows, token }) {
  const pinjamRow = riwayatRows.find((row) => {
    return isPinjam(row) && getRowToken(row) === clean(token);
  });

  if (!pinjamRow) return null;

  const effectiveTenggat = getEffectiveTenggat(pinjamRow, perpanjangRows);

  return {
    ...pinjamRow,
    effectiveTenggat,
    sudahKembali: isReturnedAfter(riwayatRows, pinjamRow),
  };
}

export function findOverdueLoans({
  dataRows,
  riwayatRows,
  perpanjangRows,
  now = new Date(),
  sendWindowMinutes = 90,
}) {
  const results = [];

  for (const row of riwayatRows) {
    if (!isPinjam(row)) continue;

    const token = getRowToken(row);
    const idbarang = getRowIdBarang(row);
    const uidpeminjam = clean(row.uidpeminjam);

    if (!token || !idbarang || !uidpeminjam) {
      results.push({
        row,
        status: "SKIP_INCOMPLETE",
      });
      continue;
    }

    if (isReturnedAfter(riwayatRows, row)) {
      results.push({
        row,
        token,
        idbarang,
        status: "SKIP_RETURNED",
      });
      continue;
    }

    const effectiveTenggat = getEffectiveTenggat(row, perpanjangRows);
    const tenggatDate = parseLocalDate(effectiveTenggat);

    if (!tenggatDate) {
      results.push({
        row,
        token,
        idbarang,
        status: "SKIP_NO_TENGGAT",
      });
      continue;
    }

    const overdueMs = now.getTime() - tenggatDate.getTime();
    const overdueMinutes = Math.floor(overdueMs / 60000);

    if (overdueMinutes < 0) {
      results.push({
        row,
        token,
        idbarang,
        status: "SKIP_NOT_OVERDUE",
        tenggat: effectiveTenggat,
        overdueMinutes,
      });
      continue;
    }

    if (sendWindowMinutes > 0 && overdueMinutes > sendWindowMinutes) {
      results.push({
        row,
        token,
        idbarang,
        status: "SKIP_OUTSIDE_SEND_WINDOW",
        tenggat: effectiveTenggat,
        overdueMinutes,
      });
      continue;
    }

    const user = dataRows.find((u) => clean(u.uid) === uidpeminjam);

    results.push({
      row,
      token,
      idbarang,
      uidpeminjam,
      user,
      status: "OVERDUE_READY",
      tenggat: effectiveTenggat,
      overdueMinutes,
    });
  }

  return results;
}
