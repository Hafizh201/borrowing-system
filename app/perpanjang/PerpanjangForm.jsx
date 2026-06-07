"use client";

import { useMemo, useState } from "react";

function clean(value) {
  return String(value ?? "").trim();
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

function pad(number) {
  return String(number).padStart(2, "0");
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

function addDaysFromTenggat(tenggatLama, tambahHari) {
  const baseDate = parseDate(tenggatLama);

  if (!baseDate) return "";

  const result = new Date(baseDate.getTime());
  result.setDate(result.getDate() + Number(tambahHari || 1));

  return formatDate(result);
}

function nowString() {
  return formatDate(new Date());
}

export default function PerpanjangForm({ loan, token }) {
  const [tambahHari, setTambahHari] = useState(1);
  const [alasan, setAlasan] = useState("");

  const waktuPerpanjang = useMemo(() => nowString(), []);

  const tenggatLama = clean(
    loan?.effectiveTenggat || loan?.Tenggat || loan?.tenggat
  );

  const tenggatBaru = useMemo(() => {
    return addDaysFromTenggat(tenggatLama, tambahHari);
  }, [tenggatLama, tambahHari]);

  function handleTambahHariChange(event) {
    const raw = Number(event.target.value || 1);
    const safe = Math.min(Math.max(raw, 1), 30);
    setTambahHari(safe);
  }

  return (
    <form className="form detail-form" action="/api/perpanjang" method="POST">
      <input type="hidden" name="extend_token" value={token} />
      <input type="hidden" name="tambah_hari" value={tambahHari} />

      <div className="field">
        <label className="label">Nama</label>
        <input
          className="input readonly"
          value={clean(loan?.nama) || "-"}
          disabled
          readOnly
        />
      </div>

      <div className="field">
        <label className="label">Kelas</label>
        <input
          className="input readonly"
          value={clean(loan?.kelas) || "-"}
          disabled
          readOnly
        />
      </div>

      <div className="field">
        <label className="label">ID Barang</label>
        <input
          className="input readonly mono"
          value={clean(loan?.Idbarang || loan?.idbarang) || "-"}
          disabled
          readOnly
        />
      </div>

      <div className="field">
        <label className="label">Kode Perpanjangan</label>
        <input
          className="input readonly mono"
          value={token}
          disabled
          readOnly
        />
      </div>

      <div className="field">
        <label className="label">Tenggat Lama</label>
        <input
          className="input readonly"
          value={tenggatLama || "-"}
          disabled
          readOnly
        />
      </div>

      <div className="field">
        <label className="label">Waktu Perpanjang</label>
        <input
          className="input readonly"
          value={waktuPerpanjang}
          disabled
          readOnly
        />
      </div>

      <div className="form-grid-two highlight-grid">
        <div className="field">
          <label className="label">Tambah Hari</label>
          <input
            className="input"
            type="number"
            min="1"
            max="30"
            value={tambahHari}
            onChange={handleTambahHariChange}
          />
        </div>

        <div className="field">
          <label className="label">Tenggat Baru</label>
          <input
            className="input readonly strong"
            value={tenggatBaru || "-"}
            disabled
            readOnly
          />
        </div>
      </div>

      <div className="field">
        <label className="label">
          Alasan <span className="muted">(opsional)</span>
        </label>
        <textarea
          className="textarea"
          name="alasan"
          value={alasan}
          onChange={(event) => setAlasan(event.target.value)}
          placeholder="Contoh: Masih digunakan untuk dokumentasi kegiatan sekolah."
        />
      </div>

      <button className="button" type="submit">
        Ya, Perpanjang
      </button>
    </form>
  );
}