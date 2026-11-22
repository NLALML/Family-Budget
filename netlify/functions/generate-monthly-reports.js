// Läuft automatisch am 1. jedes Monats (siehe netlify.toml, schedule cron) für
// ALLE Haushalte. Erzeugt pro Haushalt zwei PDFs zum gerade abgelaufenen Monat:
//   - Kurzversion: Ist vs. Plan pro Kategorie
//   - Detailversion: alle einzelnen erfassten Ausgaben, nach Kategorie gruppiert
// Lädt beide PDFs in den privaten Supabase-Storage-Bucket "monthly-reports"
// hoch und legt eine Zeile in der Tabelle "monthly_reports" an — das Frontend
// zeigt darüber im Tab "Profil" eine Benachrichtigung mit Download-Links.
//
// Läuft serverseitig mit dem Supabase Service-Role-Key (siehe delete-account.js),
// da hier für ALLE Haushalte geschrieben werden muss, nicht nur für den eigenen.

import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const INK = rgb(0.29, 0.18, 0.12);
const MUTED = rgb(0.54, 0.45, 0.38);
const NEGATIVE = rgb(0.76, 0.29, 0.23);
const POSITIVE = rgb(0.36, 0.48, 0.27);

const MONTHS_LONG = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function formatCHF(n) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(
    Number(n) || 0
  );
}

function quarterlyDueMonths(startMonth) {
  const start = startMonth || 1;
  return [0, 1, 2, 3].map((k) => ((start - 1 + k * 3) % 12) + 1);
}

function fixedActiveInMonth(item, month) {
  if (item.type === "yearly") return item.yearlyMonth === month;
  if (item.type === "quarterly") return quarterlyDueMonths(item.yearlyMonth).includes(month);
  return (item.months || []).includes(month);
}

function fixedAmountTotal(item) {
  if (item.split && item.split.length) return item.split.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return Number(item.amount) || 0;
}

// Reduzierte Variante der Frontend-Berechnung (siehe BudgetApp.jsx computeMonthData) —
// wird hier separat gepflegt, da diese Function unabhängig vom Frontend-Build läuft.
function computeCategoryTotals(yearBudget, expenses, year, month) {
  const cats = {};
  if (!yearBudget) return cats;
  Object.entries(yearBudget.categories || {}).forEach(([catId, cat]) => {
    cats[catId] = { name: cat.name, plan: 0, ist: 0 };
    (cat.positions || []).forEach((p) => {
      if (p.isFixed) {
        const amt = fixedAmountTotal(p);
        if (p.type === "yearly") {
          cats[catId].plan += amt / 12;
          if (p.yearlyMonth === month) cats[catId].ist += amt;
        } else if (fixedActiveInMonth(p, month)) {
          cats[catId].plan += amt;
          cats[catId].ist += amt;
        }
      } else {
        cats[catId].plan += Number(p.amount) || 0;
      }
    });
  });
  expenses.forEach((e) => {
    const [ey, em] = e.date.split("-").map(Number);
    if (ey === year && em === month && cats[e.category_id]) {
      cats[e.category_id].ist += Number(e.betrag) || 0;
    }
  });
  return cats;
}

async function makeSummaryPdf(householdName, year, month, categoryTotals) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([595.28, 841.89]);
  let y = 800;

  page.drawText("Monatsrückblick", { x: 40, y, size: 20, font: bold, color: INK });
  y -= 26;
  page.drawText(`${householdName} — ${MONTHS_LONG[month - 1]} ${year}`, { x: 40, y, size: 12, font, color: MUTED });
  y -= 34;

  const cols = [
    { x: 40, w: 220, label: "Kategorie" },
    { x: 270, w: 90, label: "Plan" },
    { x: 370, w: 90, label: "Ist" },
    { x: 470, w: 90, label: "Differenz" },
  ];
  cols.forEach((c) => page.drawText(c.label, { x: c.x, y, size: 10, font: bold, color: MUTED }));
  y -= 6;
  page.drawLine({ start: { x: 40, y }, end: { x: 560, y }, thickness: 0.5, color: MUTED });
  y -= 16;

  let totalPlan = 0;
  let totalIst = 0;
  const rows = Object.values(categoryTotals).sort((a, b) => a.name.localeCompare(b.name, "de"));

  rows.forEach((r) => {
    if (y < 70) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 800;
    }
    const diff = r.plan - r.ist;
    totalPlan += r.plan;
    totalIst += r.ist;
    page.drawText(r.name, { x: 40, y, size: 10.5, font, color: INK });
    page.drawText(formatCHF(r.plan), { x: 270, y, size: 10.5, font, color: INK });
    page.drawText(formatCHF(r.ist), { x: 370, y, size: 10.5, font, color: INK });
    page.drawText(formatCHF(diff), { x: 470, y, size: 10.5, font, color: diff < 0 ? NEGATIVE : POSITIVE });
    y -= 18;
  });

  y -= 6;
  page.drawLine({ start: { x: 40, y }, end: { x: 560, y }, thickness: 0.5, color: MUTED });
  y -= 20;
  const totalDiff = totalPlan - totalIst;
  page.drawText("Total", { x: 40, y, size: 11, font: bold, color: INK });
  page.drawText(formatCHF(totalPlan), { x: 270, y, size: 11, font: bold, color: INK });
  page.drawText(formatCHF(totalIst), { x: 370, y, size: 11, font: bold, color: INK });
  page.drawText(formatCHF(totalDiff), { x: 470, y, size: 11, font: bold, color: totalDiff < 0 ? NEGATIVE : POSITIVE });

  return pdfDoc.save();
}

async function makeDetailPdf(householdName, year, month, categoryTotals, expenses) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([595.28, 841.89]);
  let y = 800;

  function ensureSpace(minY) {
    if (y < minY) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 800;
    }
  }

  page.drawText("Monatsrückblick — Detail", { x: 40, y, size: 20, font: bold, color: INK });
  y -= 26;
  page.drawText(`${householdName} — ${MONTHS_LONG[month - 1]} ${year}`, { x: 40, y, size: 12, font, color: MUTED });
  y -= 34;

  const byCategory = {};
  expenses.forEach((e) => {
    const catName = categoryTotals[e.category_id]?.name || e.category_id || "Unbekannt";
    if (!byCategory[catName]) byCategory[catName] = [];
    byCategory[catName].push(e);
  });
  const categoryNames = Object.keys(byCategory).sort((a, b) => a.localeCompare(b, "de"));

  if (categoryNames.length === 0) {
    page.drawText("Keine Ausgaben in diesem Monat erfasst.", { x: 40, y, size: 11, font, color: MUTED });
  }

  categoryNames.forEach((catName) => {
    ensureSpace(110);
    page.drawText(catName, { x: 40, y, size: 13, font: bold, color: INK });
    y -= 20;

    const cols = [
      { x: 40, label: "Datum" },
      { x: 110, label: "Ort" },
      { x: 260, label: "Einkäufer" },
      { x: 370, label: "Position" },
      { x: 490, label: "Betrag" },
    ];
    cols.forEach((c) => page.drawText(c.label, { x: c.x, y, size: 9, font: bold, color: MUTED }));
    y -= 6;
    page.drawLine({ start: { x: 40, y }, end: { x: 560, y }, thickness: 0.4, color: MUTED });
    y -= 14;

    const rows = byCategory[catName].sort((a, b) => (a.date < b.date ? -1 : 1));
    let subtotal = 0;
    rows.forEach((e) => {
      ensureSpace(60);
      subtotal += Number(e.betrag) || 0;
      page.drawText(e.date || "", { x: 40, y, size: 9.5, font, color: INK });
      page.drawText((e.ort || "").slice(0, 26), { x: 110, y, size: 9.5, font, color: INK });
      page.drawText((e.einkaeufer || "").slice(0, 20), { x: 260, y, size: 9.5, font, color: INK });
      page.drawText((e.position || "").slice(0, 20), { x: 370, y, size: 9.5, font, color: INK });
      page.drawText(formatCHF(e.betrag), { x: 490, y, size: 9.5, font, color: INK });
      y -= 15;
    });
    ensureSpace(50);
    page.drawText(`Zwischensumme: ${formatCHF(subtotal)}`, { x: 40, y, size: 10, font: bold, color: INK });
    y -= 28;
  });

  return pdfDoc.save();
}

export async function handler() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY oder VITE_SUPABASE_URL fehlt." }) };
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Zielmonat: der Monat, der gerade zu Ende gegangen ist (Vormonat von "heute").
  const now = new Date();
  let targetMonth = now.getMonth(); // 0-basiert: now.getMonth() ist bereits "Vormonat" als 1-basierter Wert
  let targetYear = now.getFullYear();
  if (targetMonth === 0) {
    targetMonth = 12;
    targetYear -= 1;
  }

  const results = [];

  try {
    const { data: households, error: hErr } = await admin.from("households").select("id, name");
    if (hErr) throw hErr;

    for (const household of households || []) {
      try {
        const { data: budgetRow } = await admin
          .from("app_data")
          .select("value")
          .eq("household_id", household.id)
          .eq("key", `year-budget:${targetYear}`)
          .maybeSingle();
        const yearBudget = budgetRow?.value || null;

        const { data: expenses } = await admin
          .from("expenses")
          .select("category_id, position, date, ort, einkaeufer, betrag")
          .eq("household_id", household.id)
          .gte("date", `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`)
          .lt(
            "date",
            targetMonth === 12
              ? `${targetYear + 1}-01-01`
              : `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-01`
          );

        const categoryTotals = computeCategoryTotals(yearBudget, expenses || [], targetYear, targetMonth);

        const summaryBytes = await makeSummaryPdf(household.name, targetYear, targetMonth, categoryTotals);
        const detailBytes = await makeDetailPdf(household.name, targetYear, targetMonth, categoryTotals, expenses || []);

        const base = `${household.id}/${targetYear}-${String(targetMonth).padStart(2, "0")}`;
        const summaryPath = `${base}-summary.pdf`;
        const detailPath = `${base}-detail.pdf`;

        await admin.storage.from("monthly-reports").upload(summaryPath, Buffer.from(summaryBytes), {
          contentType: "application/pdf",
          upsert: true,
        });
        await admin.storage.from("monthly-reports").upload(detailPath, Buffer.from(detailBytes), {
          contentType: "application/pdf",
          upsert: true,
        });

        await admin.from("monthly_reports").upsert(
          {
            household_id: household.id,
            year: targetYear,
            month: targetMonth,
            summary_path: summaryPath,
            detail_path: detailPath,
            is_read: false,
          },
          { onConflict: "household_id,year,month" }
        );

        results.push({ household: household.id, ok: true });
      } catch (err) {
        results.push({ household: household.id, ok: false, error: String(err) });
      }
    }

    return { statusCode: 200, body: JSON.stringify({ targetYear, targetMonth, results }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
