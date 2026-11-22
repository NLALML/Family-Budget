import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const INK = rgb(0.29, 0.18, 0.12);
const MUTED = rgb(0.54, 0.45, 0.38);
const NEGATIVE = rgb(0.76, 0.29, 0.23);
const POSITIVE = rgb(0.36, 0.48, 0.27);

const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const PAGE_SIZE = [595.28, 841.89]; // A4
const TOP_Y = 800;

function formatCHF(n) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(
    Number(n) || 0
  );
}

// computeMonthData / computePositionIst werden von BudgetApp.jsx übergeben,
// damit hier keine zweite, potenziell abweichende Berechnungslogik gepflegt
// werden muss — die Jahresübersicht rechnet exakt gleich wie Dashboard & Co.
export async function generateYearReviewPdf({ yearBudget, expenses, year, householdName, computeMonthData, computePositionIst }) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const startMonth = yearBudget?.startMonth || 1;
  const endMonth = year < curYear ? 12 : year > curYear ? 0 : curMonth;

  let page = pdfDoc.addPage(PAGE_SIZE);
  let y = TOP_Y;

  function ensureSpace(minY) {
    if (y < minY) {
      page = pdfDoc.addPage(PAGE_SIZE);
      y = TOP_Y;
    }
  }

  page.drawText("Jahresübersicht", { x: 40, y, size: 20, font: bold, color: INK });
  y -= 26;
  page.drawText(`${householdName ? householdName + " — " : ""}${year}`, { x: 40, y, size: 12, font, color: MUTED });
  y -= 16;
  page.drawText(
    "Plan vs. Ist pro Kategorie und Monat, inkl. Durchschnittswert als Grundlage für die neue Jahresbudgetierung.",
    { x: 40, y, size: 9.5, font, color: MUTED }
  );
  y -= 30;

  const categories = Object.entries(yearBudget?.categories || {}).sort((a, b) =>
    a[1].name.localeCompare(b[1].name, "de")
  );

  categories.forEach(([catId, cat]) => {
    ensureSpace(230);

    page.drawText(cat.name, { x: 40, y, size: 14, font: bold, color: INK });
    y -= 20;

    page.drawText("Monat", { x: 40, y, size: 9, font: bold, color: MUTED });
    page.drawText("Plan", { x: 160, y, size: 9, font: bold, color: MUTED });
    page.drawText("Ist", { x: 250, y, size: 9, font: bold, color: MUTED });
    page.drawText("Differenz", { x: 340, y, size: 9, font: bold, color: MUTED });
    y -= 6;
    page.drawLine({ start: { x: 40, y }, end: { x: 440, y }, thickness: 0.4, color: MUTED });
    y -= 13;

    let sumPlanTracked = 0;
    let sumIstTracked = 0;
    let trackedCount = 0;

    for (let m = 1; m <= 12; m++) {
      ensureSpace(60);
      const data = computeMonthData(yearBudget, expenses, year, m);
      const catData = data.byCategory[catId] || { plan: 0, ist: 0 };
      const tracked = m >= startMonth && m <= endMonth;
      if (tracked) {
        sumPlanTracked += catData.plan;
        sumIstTracked += catData.ist;
        trackedCount += 1;
      }
      const diff = catData.plan - catData.ist;
      const color = tracked ? INK : MUTED;
      page.drawText(MONTHS_SHORT[m - 1], { x: 40, y, size: 9.5, font, color });
      page.drawText(formatCHF(catData.plan), { x: 160, y, size: 9.5, font, color });
      page.drawText(tracked ? formatCHF(catData.ist) : "–", { x: 250, y, size: 9.5, font, color });
      page.drawText(tracked ? formatCHF(diff) : "–", {
        x: 340, y, size: 9.5, font, color: tracked ? (diff < 0 ? NEGATIVE : POSITIVE) : MUTED,
      });
      y -= 15;
    }

    y -= 4;
    page.drawLine({ start: { x: 40, y }, end: { x: 440, y }, thickness: 0.4, color: MUTED });
    y -= 15;

    const avgPlan = trackedCount ? sumPlanTracked / trackedCount : 0;
    const avgIst = trackedCount ? sumIstTracked / trackedCount : 0;
    page.drawText(`Ø pro Monat (${trackedCount} erfasste Monate)`, { x: 40, y, size: 10, font: bold, color: INK });
    page.drawText(formatCHF(avgPlan), { x: 160, y, size: 10, font: bold, color: INK });
    page.drawText(formatCHF(avgIst), { x: 250, y, size: 10, font: bold, color: INK });
    y -= 24;

    const positions = (cat.positions || []).filter((p) => !p.isFixed);
    if (positions.length > 0 && trackedCount > 0) {
      ensureSpace(50 + positions.length * 15);
      page.drawText("Positionen — Ø Ist/Monat vs. aktueller Plan", { x: 40, y, size: 10, font: bold, color: INK });
      y -= 16;
      positions.forEach((p) => {
        ensureSpace(40);
        let sum = 0;
        for (let m = startMonth; m <= endMonth; m++) {
          sum += computePositionIst(expenses, year, m, catId, p.name);
        }
        const avg = sum / trackedCount;
        page.drawText(p.name, { x: 50, y, size: 9.5, font, color: INK });
        page.drawText(`Ø ${formatCHF(avg)}`, { x: 280, y, size: 9.5, font, color: INK });
        page.drawText(`Aktueller Plan: ${formatCHF(p.amount)}`, { x: 380, y, size: 9.5, font, color: MUTED });
        y -= 14;
      });
    }

    y -= 22;
  });

  return pdfDoc.save();
}
