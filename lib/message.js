import { clean } from "./utils";

export function buildReminderMessage({ nama, idbarang, waktu, tenggat, link }) {
  return [
    `Assalamu’alaikum, ${clean(nama) || "pengguna"}.`,
    ``,
    `Barang dengan ID "${clean(idbarang)}" yang Anda pinjam pada ${clean(waktu)} belum tercatat dikembalikan.`,
    ``,
    `Batas maksimal peminjaman adalah 1 hari.`,
    `Silakan segera mengembalikan barang, atau ajukan perpanjangan melalui link berikut:`,
    ``,
    link,
    ``,
    `Terima kasih.`,
    `Smart Borrowing System`,
  ].join("\n");
}
