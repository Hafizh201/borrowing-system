import "./globals.css";

export const metadata = {
  title: "Smart Borrowing System",
  description: "Form perpanjangan peminjaman barang",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
