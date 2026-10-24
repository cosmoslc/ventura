import ExcelJS from "exceljs";
import { type NextRequest, NextResponse } from "next/server";
import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import {
  getDispatchReportData,
  getProfitReportData,
  getWagesReportData,
} from "@/app/(app)/reports/actions";

export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  if (!can(user.role, "reports.view")) {
    return new NextResponse("Ruxsat berilmagan", { status: 403 });
  }

  const { deps } = await currentDeps();
  if (!deps) {
    return new NextResponse("Sessiya xatosi", { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "profit";
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;
  const terakId = searchParams.get("terakId") || undefined;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ventura Sawmill";
  wb.created = new Date();

  const todayStr = new Date().toISOString().slice(0, 10);
  let fileName = `hisobot_${type}_${todayStr}.xlsx`;

  if (type === "profit") {
    fileName = `teraklar_foyda_hisoboti_${todayStr}.xlsx`;
    const ws = wb.addWorksheet("Teraklar bo'yicha foyda");

    ws.columns = [
      { header: "Terak nomi", key: "name", width: 22 },
      { header: "Xarid sanasi", key: "purchaseDate", width: 14 },
      { header: "Xarid narxi (so'm)", key: "purchasePrice", width: 18 },
      { header: "Qo'shimcha xarajat (so'm)", key: "additionalCosts", width: 22 },
      { header: "Ish haqi xarajati (so'm)", key: "workCosts", width: 20 },
      { header: "Jami xarajat (so'm)", key: "totalCosts", width: 18 },
      { header: "Sotuv daromadi (so'm)", key: "dispatchRevenue", width: 20 },
      { header: "Ombor qiymati (so'm)", key: "stockValue", width: 18 },
      { header: "Taxminiy foyda (so'm)", key: "profitEstimated", width: 20 },
      { header: "Haqiqiy foyda (so'm)", key: "profitReal", width: 20 },
      { header: "Rentabellik (%)", key: "marginEstimated", width: 16 },
    ];

    const data = await getProfitReportData(deps.db);

    for (const r of data.rows) {
      ws.addRow({
        name: r.name,
        purchaseDate: r.purchaseDate,
        purchasePrice: r.purchasePrice,
        additionalCosts: r.additionalCosts,
        workCosts: r.workCosts,
        totalCosts: r.totalCosts,
        dispatchRevenue: r.dispatchRevenue,
        stockValue: r.stockValue,
        profitEstimated: r.profitEstimated,
        profitReal: r.profitReal,
        marginEstimated: `${r.marginEstimated}%`,
      });
    }

    if (data.generalExpensesTotal > 0) {
      ws.addRow({});
      ws.addRow({
        name: "Umumiy xarajatlar (K14)",
        totalCosts: data.generalExpensesTotal,
      });
    }
  } else if (type === "wages") {
    fileName = `ishchilar_ish_haqi_${todayStr}.xlsx`;
    const ws = wb.addWorksheet("Ishchilar ish haqi");

    ws.columns = [
      { header: "Ishchi F.I.Sh.", key: "name", width: 25 },
      { header: "Ish shakli", key: "salaryType", width: 16 },
      { header: "Jami ishlagan (so'm)", key: "totalEarned", width: 20 },
      { header: "To'langan summa (so'm)", key: "totalPaid", width: 20 },
      { header: "Hozirgi balans (so'm)", key: "currentBalance", width: 20 },
    ];

    const rows = await getWagesReportData(deps.db, { dateFrom, dateTo });

    for (const w of rows) {
      const typeLabel = w.salaryType === "piecework" ? "Ishbay" : "Oylik/Maosh";
      ws.addRow({
        name: w.name,
        salaryType: typeLabel,
        totalEarned: w.totalEarned,
        totalPaid: w.totalPaid,
        currentBalance: w.currentBalance,
      });
    }
  } else if (type === "dispatch") {
    fileName = `yuk_chiqarish_hisoboti_${todayStr}.xlsx`;
    const ws = wb.addWorksheet("Yuk chiqarish");

    ws.columns = [
      { header: "Sana", key: "date", width: 14 },
      { header: "Terak", key: "terakName", width: 18 },
      { header: "Material", key: "materialName", width: 20 },
      { header: "Miqdor", key: "quantity", width: 16 },
      { header: "Hajm (m³)", key: "volumeTotalM3", width: 14 },
      { header: "Jami summa (so'm)", key: "totalAmount", width: 18 },
      { header: "Mijoz (Qabul qiluvchi)", key: "recipientName", width: 24 },
      { header: "Telefon", key: "phone", width: 16 },
      { header: "Yuk mashinasi", key: "truckName", width: 18 },
    ];

    const rows = await getDispatchReportData(deps.db, { dateFrom, dateTo, terakId });

    for (const d of rows) {
      ws.addRow({
        date: d.date,
        terakName: d.terakName,
        materialName: d.materialName,
        quantity: `${d.quantity} ${d.materialUnit}`,
        volumeTotalM3: d.volumeTotalM3 ?? "-",
        totalAmount: d.totalAmount,
        recipientName: d.recipientName ?? "-",
        phone: d.phone ?? "-",
        truckName: d.truckName ?? "-",
      });
    }
  }

  // Header styling
  wb.eachSheet((sheet) => {
    const firstRow = sheet.getRow(1);
    firstRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    firstRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // dark slate
    };
    firstRow.alignment = { vertical: "middle", horizontal: "center" };
    firstRow.height = 24;
  });

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
