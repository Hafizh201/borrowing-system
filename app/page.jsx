export default function HomePage() {
  return (
    <main className="page">
      <section className="card">
        <span className="badge">Smart Borrowing System</span>
        <h1 className="title">Web Perpanjangan Aktif</h1>
        <p className="subtitle">
          Halaman ini dipakai untuk form perpanjangan dan cron reminder otomatis.
        </p>
        <div className="info-box">
          <div className="info-row">
            <span className="info-label">Form perpanjangan</span>
            <span className="info-value">/perpanjang?token=...</span>
          </div>
          <div className="info-row">
            <span className="info-label">Cron reminder</span>
            <span className="info-value">/api/cron/check-overdue</span>
          </div>
        </div>
      </section>
    </main>
  );
}
