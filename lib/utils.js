export function clean(value) {
  return String(value ?? "").trim();
}

export function upper(value) {
  return clean(value).toUpperCase();
}

export function normalizePhone(value) {
  let phone = clean(value).replace(/[^\d]/g, "");

  if (phone.startsWith("0")) {
    phone = `62${phone.slice(1)}`;
  }

  if (!phone.startsWith("62") && phone.length > 0) {
    phone = `62${phone}`;
  }

  return phone;
}

export function parseLocalDate(value) {
  const text = clean(value);

  if (!text) return null;

  // Format dari Apps Script biasanya: yyyy-MM-dd HH:mm:ss
  const normalized = text.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

export function formatDisplay(value) {
  const text = clean(value);
  if (!text) return "-";
  return text;
}

export function formatDateForInput(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds()),
  ].join("");
}

export function hoursAfter(dateString, hours) {
  const date = parseLocalDate(dateString) || new Date();
  date.setHours(date.getHours() + Number(hours || 24));
  return formatDateForInput(date);
}

export function getRowIdBarang(row) {
  return clean(row.Idbarang || row.idbarang || row.IDBARANG || row.uidbarang);
}

export function getRowTenggat(row) {
  return clean(row.Tenggat || row.tenggat);
}

export function getRowToken(row) {
  return clean(row.extend_token || row.Extend_Token || row.EXTEND_TOKEN);
}
