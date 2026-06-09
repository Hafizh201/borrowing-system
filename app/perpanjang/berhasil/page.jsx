export default function BerhasilPage({ searchParams }) {
  const notif = searchParams?.notif;

  return (
    <main className="page">
      <section className="card">
        <span className="badge success">Berhasil</span>
        <h1 className="title success">Perpanjangan Tercatat</h1>
        <p className="subtitle">
          Data perpanjangan sudah masuk ke sistem. Silakan tetap menjaga barang dan mengembalikannya sesuai tenggat baru.
        </p>

        {notif === "sent" && (
          <div className="info-box success-box">
            Notifikasi WhatsApp berhasil dikirim sebagai bukti perpanjangan.
          </div>
        )}

        {notif === "failed" && (
          <div className="info-box warning-box">
            Perpanjangan berhasil tercatat, tetapi notifikasi WhatsApp belum berhasil dikirim.
          </div>
        )}
      </section>
    </main>
  );
}
