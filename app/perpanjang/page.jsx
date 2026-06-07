import { getRiwayatRows, getPerpanjangRows } from "../../lib/appsScript";
import { findLoanByToken } from "../../lib/loanLogic";
import { clean } from "../../lib/utils";
import PerpanjangForm from "./PerpanjangForm";

export const dynamic = "force-dynamic";

export default async function PerpanjangPage({ searchParams }) {
  const token = clean(searchParams?.token);

  if (!token) {
    return (
      <main className="page">
        <section className="card">
          <span className="badge danger">Link tidak valid</span>
          <h1 className="title danger">Token tidak ditemukan</h1>
          <p className="subtitle">
            Link perpanjangan tidak membawa token. Silakan buka link dari pesan WhatsApp.
          </p>
        </section>
      </main>
    );
  }

  let loan = null;
  let error = "";

  try {
    const [riwayatRows, perpanjangRows] = await Promise.all([
      getRiwayatRows(),
      getPerpanjangRows(),
    ]);

    loan = findLoanByToken({
      riwayatRows,
      perpanjangRows,
      token,
    });
  } catch (err) {
    error = String(err.message || err);
  }

  if (error) {
    return (
      <main className="page">
        <section className="card">
          <span className="badge danger">Sistem error</span>
          <h1 className="title danger">Gagal membaca data</h1>
          <p className="subtitle">{error}</p>
        </section>
      </main>
    );
  }

  if (!loan) {
    return (
      <main className="page">
        <section className="card">
          <span className="badge danger">Link tidak valid</span>
          <h1 className="title danger">Data peminjaman tidak ditemukan</h1>
          <p className="subtitle">
            Token perpanjangan tidak ditemukan di riwayat peminjaman.
          </p>
        </section>
      </main>
    );
  }

  if (loan.sudahKembali) {
    return (
      <main className="page">
        <section className="card">
          <span className="badge success">Sudah kembali</span>
          <h1 className="title success">Perpanjangan tidak diperlukan</h1>
          <p className="subtitle">
            Barang ini sudah tercatat dikembalikan, sehingga link perpanjangan tidak perlu digunakan.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card wide-card">
        <span className="badge">Smart Borrowing System</span>
        <h1 className="title">Konfirmasi Perpanjang</h1>
        <p className="subtitle">
          Cek detail peminjaman di bawah ini. Data identitas dikunci supaya tidak dapat diubah.
        </p>

        <PerpanjangForm loan={loan} token={token} />

        <p className="small">
          Setelah dikirim, data akan masuk ke sheet Perpanjang. Tenggat baru dihitung otomatis berdasarkan jumlah hari tambahan.
        </p>
      </section>
    </main>
  );
}
