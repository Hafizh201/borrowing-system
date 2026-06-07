export default function HomePage() {
  return (
    <main className="page">
      <section className="card error-card">
        <div className="icon error-icon">!</div>
        <h1>Anda tidak punya akses untuk ke halaman utama</h1>
        <p className="subtitle">
          Silakan gunakan link resmi dari sistem. Link perpanjangan seperti <span className="mono">/perpanjang?token=...</span> tetap dapat digunakan.
        </p>
      </section>
    </main>
  );
}
