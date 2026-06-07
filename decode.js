const fs = require("fs");

const raw = fs.readFileSync("session.json", "utf8");
const json = JSON.parse(raw);

const qr = json?.data?.qr_code;

if (!qr) {
  console.log("QR tidak ditemukan");
  console.log(json);
  process.exit(1);
}

const base64 = qr.split(",")[1];
fs.writeFileSync("qr.png", Buffer.from(base64, "base64"));

console.log("QR berhasil dibuat: qr.png");
console.log("Session ID:", json.data.session_id);