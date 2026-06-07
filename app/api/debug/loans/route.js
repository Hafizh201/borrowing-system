import { getDataRows, getRiwayatRows, getPerpanjangRows } from "../../../../lib/appsScript";
import { findOverdueLoans } from "../../../../lib/loanLogic";

export const dynamic = "force-dynamic";

export async function GET() {
  const [dataRows, riwayatRows, perpanjangRows] = await Promise.all([
    getDataRows(),
    getRiwayatRows(),
    getPerpanjangRows(),
  ]);

  const loans = findOverdueLoans({
    dataRows,
    riwayatRows,
    perpanjangRows,
    now: new Date(),
    sendWindowMinutes: 0,
  });

  return Response.json({
    success: true,
    data_count: dataRows.length,
    riwayat_count: riwayatRows.length,
    perpanjang_count: perpanjangRows.length,
    loans,
  });
}
