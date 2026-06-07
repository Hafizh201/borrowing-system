# Smart Borrowing Web

Project ini menangani:
1. Halaman form perpanjangan: `/perpanjang?token=...`
2. Submit form perpanjangan ke Google Apps Script
3. Cron checker: `/api/cron/check-overdue?secret=...`
4. Reminder WhatsApp via Fonnte

## 1. Install

```bash
npm install
```

## 2. Buat `.env.local`

Copy `.env.example` menjadi `.env.local`, lalu isi:

```env
APPS_SCRIPT_URL=URL_APPS_SCRIPT_KAMU
FONNTE_TOKEN=TOKEN_FONNTE_KAMU
APP_URL=http://localhost:3000
CRON_SECRET=rahasia_kamu
DRY_RUN=true
SEND_WINDOW_MINUTES=90
EXTEND_HOURS=24
```

## 3. Jalankan lokal

```bash
npm run dev
```

## 4. Test form perpanjang

Ambil `extend_token` dari sheet `Riwayat`, lalu buka:

```txt
http://localhost:3000/perpanjang?token=TOKEN_KAMU
```

Isi alasan, submit. Kalau berhasil, data masuk ke sheet `Perpanjang`.

## 5. Test cron reminder tanpa kirim WA

Pastikan `DRY_RUN=true`, lalu buka:

```txt
http://localhost:3000/api/cron/check-overdue?secret=rahasia_kamu
```

Kalau ada data yang sudah lewat `Tenggat`, hasilnya akan muncul `DRY_RUN_SENT`.

## 6. Kirim WA sungguhan

Ubah:

```env
DRY_RUN=false
```

Restart dev server:

```bash
npm run dev
```

Buka endpoint cron lagi.

## Catatan penting anti-spam

Project ini tidak mengubah row `Riwayat` untuk menandai WA sudah terkirim, sesuai permintaan awal supaya struktur sheet tidak berubah. Karena itu, sistem memakai `SEND_WINDOW_MINUTES`.

Contoh:
- Cron jalan setiap 30 menit
- `SEND_WINDOW_MINUTES=90`
- WA hanya akan dikirim kalau keterlambatan masih dalam rentang 0 sampai 90 menit.

Kalau ingin anti-spam 100%, nanti perlu tambahan log kecil, misalnya sheet `wa_log` atau kolom status reminder.
