import React, { useState, useEffect, useMemo, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Home, LayoutGrid, CalendarDays, Camera, Plus, ArrowLeft,
  Trash2, X, ChevronRight, Check, Loader2, Receipt,
  Settings as SettingsIcon, Copy, RefreshCw, Download, LogOut, Users,
  Bell, Pencil, RotateCcw,
} from "lucide-react";
import { storage } from "./storage.js";
import { listExpenses, insertExpense, removeExpense } from "./expensesApi.js";
import { updateHouseholdName, regenerateInviteCode, listMembers } from "./householdApi.js";
import { deleteOwnAccount } from "./accountApi.js";
import { supabase } from "./supabaseClient.js";

/* ============================== KONSTANTEN ============================== */

const DEFAULT_PERSONS = ["Person 1", "Person 2"];

const MONTHS_LONG = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const MONTHS_SHORT = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

const ALL_MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];

const DEFAULT_INCOME = { einkuenfte1: 0, einkuenfte2: 0, zusatzeinkuenfte: 0 };

// Ausgangsstruktur je Kategorie: nur Namen/Struktur als Vorlage, alle Beträge auf 0 —
// jede neu registrierte Familie muss mit einem leeren Budget starten.
// isFixed=true -> automatische monatl./jährl. Verrechnung (Häufigkeit/Monate im UI editierbar).
const DEFAULT_CATEGORIES = {
  wohnen: { name: "Wohnen", positions: [
    { name: "Wohnungsmiete", amount: 0, isFixed: true, type: "monthly", split: [] },
    { name: "Telefon", amount: 0, isFixed: true, type: "monthly", split: [] },
    { name: "Zweite Hypothek oder Miete", amount: 0, isFixed: false },
    { name: "Wasser- und Elektrizitätswerk", amount: 0, isFixed: false },
    { name: "TV + Internet", amount: 0, isFixed: false },
    { name: "Sonstiges", amount: 0, isFixed: false },
  ]},
  verkehr: { name: "Verkehrsmittel", positions: [
    { name: "Fahrzeugversicherung", amount: 0, isFixed: true, type: "monthly", split: [] },
    { name: "Zahlung Fahrzeug 1", amount: 0, isFixed: false },
    { name: "Zahlung Fahrzeug 2", amount: 0, isFixed: false },
    { name: "Bus-/Taxikosten", amount: 0, isFixed: false },
    { name: "Kfz-Steuer", amount: 0, isFixed: false },
    { name: "Kraftstoff", amount: 0, isFixed: false },
    { name: "Wartung", amount: 0, isFixed: false },
    { name: "Sonstiges", amount: 0, isFixed: false },
  ]},
  versicherung: { name: "Versicherung", positions: [
    { name: "Hausratversicherung", amount: 0, isFixed: true, type: "monthly", split: [] },
    { name: "Krankenversicherung", amount: 0, isFixed: true, type: "monthly", split: [
      { person: "Person 1", amount: 0 }, { person: "Person 2", amount: 0 },
    ] },
    { name: "Reiseversicherung", amount: 0, isFixed: true, type: "monthly", split: [] },
    { name: "Sonstige", amount: 0, isFixed: false },
  ]},
  essen: { name: "Essen", positions: [
    { name: "Lebensmittel", amount: 0, isFixed: false },
    { name: "Ausgehen", amount: 0, isFixed: false },
    { name: "Sonstige", amount: 0, isFixed: false },
  ]},
  kinder: { name: "Kinder", positions: [
    { name: "KITA-Kosten", amount: 0, isFixed: true, type: "monthly", split: [] },
    { name: "Arztkosten", amount: 0, isFixed: false },
    { name: "Kleidung", amount: 0, isFixed: false },
    { name: "Unterrichtsgebühren", amount: 0, isFixed: false },
    { name: "Schulmaterialien", amount: 0, isFixed: false },
    { name: "Vereinsbeiträge", amount: 0, isFixed: false },
    { name: "Mittagessen", amount: 0, isFixed: false },
    { name: "Spielzeug/Spiele", amount: 0, isFixed: false },
    { name: "Sonstige", amount: 0, isFixed: false },
  ]},
  rechtskosten: { name: "Rechtskosten", positions: [
    { name: "Anwalt", amount: 0, isFixed: false },
    { name: "Unterhalt", amount: 0, isFixed: false },
    { name: "Zahlungen", amount: 0, isFixed: false },
    { name: "Sonstige", amount: 0, isFixed: false },
  ]},
  ersparnisse: { name: "Ersparnisse/Investitionen", positions: [
    { name: "Altersvorsorge", amount: 0, isFixed: true, type: "monthly", split: [] },
    { name: "Langzeit-Investition", amount: 0, isFixed: true, type: "monthly", split: [
      { person: "Person 1", amount: 0 }, { person: "Person 2", amount: 0 },
    ] },
    { name: "Ferien", amount: 0, isFixed: false },
  ]},
  darlehen: { name: "Darlehen", positions: [
    { name: "Privat", amount: 0, isFixed: false },
    { name: "Studium", amount: 0, isFixed: false },
    { name: "Kreditkarte", amount: 0, isFixed: false },
    { name: "Sonstige", amount: 0, isFixed: false },
  ]},
  unterhaltung: { name: "Unterhaltung", positions: [
    { name: "Streaming-Apps", amount: 0, isFixed: false },
    { name: "Onlinespiele", amount: 0, isFixed: false },
    { name: "Filme", amount: 0, isFixed: false },
    { name: "Konzerte", amount: 0, isFixed: false },
    { name: "Sportveranstaltungen", amount: 0, isFixed: false },
    { name: "Theater", amount: 0, isFixed: false },
    { name: "Sonstige", amount: 0, isFixed: false },
  ]},
  steuern: { name: "Steuern", positions: [
    { name: "Kantons- + Bundessteuern", amount: 0, isFixed: false },
  ]},
  pflege: { name: "Persönliche Pflege", positions: [
    { name: "Sackgeld", amount: 0, isFixed: true, type: "monthly", split: [
      { person: "Person 1", amount: 0 }, { person: "Person 2", amount: 0 },
    ] },
    { name: "Arztkosten", amount: 0, isFixed: false },
    { name: "Haare/Nägel", amount: 0, isFixed: false },
    { name: "Kleidung", amount: 0, isFixed: false },
    { name: "Fitnesscenter", amount: 0, isFixed: false },
    { name: "Vereinsbeiträge", amount: 0, isFixed: false },
    { name: "Sonstige", amount: 0, isFixed: false },
  ]},
  geschenke: { name: "Geschenke und Spenden", positions: [
    { name: "Spenden 1", amount: 0, isFixed: false },
    { name: "Spenden 2", amount: 0, isFixed: false },
    { name: "Spenden 3", amount: 0, isFixed: false },
  ]},
  haustiere: { name: "Haustiere", positions: [
    { name: "Futter", amount: 0, isFixed: false },
    { name: "Arztkosten", amount: 0, isFixed: false },
    { name: "Fellpflege", amount: 0, isFixed: false },
    { name: "Spielzeuge", amount: 0, isFixed: false },
    { name: "Sonstige", amount: 0, isFixed: false },
  ]},
};

const LEGACY_NAME_MAP = {
  wohnen: "Wohnen", verkehr: "Verkehrsmittel", versicherung: "Versicherung", essen: "Essen", kinder: "Kinder",
  rechtskosten: "Rechtskosten", ersparnisse: "Ersparnisse/Investitionen", darlehen: "Darlehen",
  unterhaltung: "Unterhaltung", steuern: "Steuern", pflege: "Persönliche Pflege",
  geschenke: "Geschenke und Spenden", haustiere: "Haustiere",
};

const REPEAT_OPTIONS = [
  { value: "none", label: "Keine (einmalig)" },
  { value: "monthly", label: "Monatlich" },
  { value: "quarterly", label: "Vierteljährlich" },
  { value: "halfyearly", label: "Halbjährlich" },
  { value: "yearly", label: "Jährlich" },
];
const REPEAT_LABEL = Object.fromEntries(REPEAT_OPTIONS.map((r) => [r.value, r.label]));

const ALERT_OPTIONS = [
  { value: 28, label: "4 Wochen vorher" },
  { value: 21, label: "3 Wochen vorher" },
  { value: 14, label: "2 Wochen vorher" },
  { value: 7, label: "1 Woche vorher" },
  { value: 3, label: "3 Tage vorher" },
  { value: 1, label: "1 Tag vorher" },
];

/* ============================== HILFSFUNKTIONEN ============================== */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const formatCHF = (n) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(Number(n) || 0);

function getCategoryName(yearBudget, catId) {
  return yearBudget?.categories?.[catId]?.name || catId;
}

function normalizePosition(p) {
  return {
    id: p.id || uid(),
    name: p.name || "",
    amount: Number(p.amount) || 0,
    isFixed: !!p.isFixed,
    type: p.type === "yearly" ? "yearly" : "monthly",
    months: Array.isArray(p.months) && p.months.length ? p.months : [...ALL_MONTHS],
    yearlyMonth: p.yearlyMonth || 1,
    split: Array.isArray(p.split) ? p.split.map((s) => ({ person: s.person, amount: Number(s.amount) || 0 })) : [],
  };
}

function normalizeYearBudget(yb) {
  const categories = {};
  Object.entries(yb.categories || {}).forEach(([catId, catVal]) => {
    if (Array.isArray(catVal)) {
      categories[catId] = { name: LEGACY_NAME_MAP[catId] || catId, positions: catVal.map(normalizePosition) };
    } else {
      categories[catId] = { name: catVal.name || catId, positions: (catVal.positions || []).map(normalizePosition) };
    }
  });
  const startMonth = Number(yb.startMonth) >= 1 && Number(yb.startMonth) <= 12 ? Number(yb.startMonth) : 1;
  return { year: yb.year, startMonth, income: { ...DEFAULT_INCOME, ...(yb.income || {}) }, categories };
}

function migrateLegacyFixed(yb, legacyFixed) {
  if (!legacyFixed || !legacyFixed.length) return yb;
  const categories = { ...yb.categories };
  legacyFixed.forEach((f) => {
    if (!categories[f.categoryId]) categories[f.categoryId] = { name: LEGACY_NAME_MAP[f.categoryId] || f.categoryId, positions: [] };
    else categories[f.categoryId] = { ...categories[f.categoryId], positions: [...categories[f.categoryId].positions] };
    categories[f.categoryId].positions.push({
      id: f.id || uid(), name: f.name, amount: f.amount, isFixed: true,
      type: f.type, months: f.months, yearlyMonth: f.yearlyMonth, split: f.split,
    });
  });
  return { ...yb, categories };
}

function createDefaultYearBudget(year) {
  const categories = {};
  Object.entries(DEFAULT_CATEGORIES).forEach(([catId, cat]) => {
    categories[catId] = { name: cat.name, positions: cat.positions.map((p) => normalizePosition({ ...p, id: uid() })) };
  });
  // Startet die App im laufenden Jahr, z. B. im August, ist es praktisch, direkt
  // ab dem aktuellen Monat vorzuschlagen — lässt sich im Jahresbudget jederzeit ändern.
  const now = new Date();
  const defaultStartMonth = year === now.getFullYear() ? now.getMonth() + 1 : 1;
  return { year, startMonth: defaultStartMonth, income: { ...DEFAULT_INCOME }, categories };
}

function cloneYearBudget(source, newYear) {
  const categories = {};
  Object.entries(source.categories).forEach(([catId, cat]) => {
    categories[catId] = { name: cat.name, positions: cat.positions.map((p) => ({ ...p, id: uid(), split: p.split.map((s) => ({ ...s })) })) };
  });
  return { year: newYear, startMonth: 1, income: { ...source.income }, categories };
}

function fixedActiveInMonth(item, month) {
  if (item.type === "yearly") return item.yearlyMonth === month;
  return (item.months || []).includes(month);
}

function fixedAmountTotal(item) {
  if (item.split && item.split.length) return item.split.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return Number(item.amount) || 0;
}

// Planwert einer jährlichen Fixkosten-Position für EINEN Monat: immer gleichmässig
// auf 12 Monate verteilt (Betrag ÷ 12) — unabhängig vom Startmonat der Budgetrechnung.
// Der tatsächliche Betrag pro Jahr bleibt so korrekt (12 × Betrag/12 = Betrag); nur in
// welchen Monaten dieser Planwert überhaupt gezählt wird, hängt vom Startmonat ab
// (siehe computeMonthData: Monate vor dem Startmonat werden schlicht nicht mitgezählt).
// Der tatsächliche Abzug (Ist) erfolgt weiterhin voll im Fälligkeitsmonat.
function fixedYearlyPlanPerMonth(item) {
  return fixedAmountTotal(item) / 12;
}

function computeMonthData(yearBudget, expenses, year, month) {
  const cats = {};
  if (!yearBudget) return { byCategory: {}, planTotal: 0, istTotal: 0, remaining: 0 };
  const startMonth = yearBudget.startMonth || 1;
  Object.keys(yearBudget.categories).forEach((catId) => (cats[catId] = { planVar: 0, planFixed: 0, istVar: 0, istFixed: 0 }));

  Object.entries(yearBudget.categories).forEach(([catId, cat]) => {
    cat.positions.forEach((p) => {
      if (p.isFixed) {
        const amt = fixedAmountTotal(p);
        if (p.type === "yearly") {
          // Plan: Betrag/12, gezählt in jedem Monat ab dem Startmonat der Budgetrechnung.
          // Ist: voller Betrag im Fälligkeitsmonat.
          if (month >= startMonth) cats[catId].planFixed += fixedYearlyPlanPerMonth(p);
          if (p.yearlyMonth === month) cats[catId].istFixed += amt;
        } else if (fixedActiveInMonth(p, month)) {
          cats[catId].planFixed += amt;
          cats[catId].istFixed += amt;
        }
      } else if (month >= startMonth) {
        cats[catId].planVar += Number(p.amount) || 0;
      }
    });
  });

  expenses.forEach((e) => {
    const [ey, em] = e.date.split("-").map(Number);
    if (ey === year && em === month && cats[e.categoryId]) {
      cats[e.categoryId].istVar += Number(e.betrag) || 0;
    }
  });

  let planTotal = 0, istTotal = 0;
  const byCategory = {};
  Object.entries(cats).forEach(([catId, v]) => {
    const plan = v.planVar + v.planFixed;
    const ist = v.istVar + v.istFixed;
    byCategory[catId] = { ...v, plan, ist, remaining: plan - ist };
    planTotal += plan;
    istTotal += ist;
  });

  return { byCategory, planTotal, istTotal, remaining: planTotal - istTotal };
}

function computePositionIst(expenses, year, month, catId, positionName) {
  return expenses.reduce((s, e) => {
    const [ey, em] = e.date.split("-").map(Number);
    if (ey === year && em === month && e.categoryId === catId && e.position === positionName) {
      return s + (Number(e.betrag) || 0);
    }
    return s;
  }, 0);
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
}

function formatDateCH(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("de-CH");
}

function reminderStatus(reminder) {
  const days = daysUntil(reminder.deadline);
  const maxAlert = (reminder.alertIntervals || []).length ? Math.max(...reminder.alertIntervals) : 0;
  if (days < 0) return { tone: "negative", label: `Überfällig seit ${-days} Tag${-days === 1 ? "" : "en"}`, days };
  if (days === 0) return { tone: "warning", label: "Heute fällig", days };
  if (days <= maxAlert) return { tone: "warning", label: `In ${days} Tag${days === 1 ? "" : "en"}`, days };
  return { tone: "neutral", label: `In ${days} Tagen`, days };
}

function advanceDeadline(dateStr, repeat) {
  const d = new Date(dateStr + "T00:00:00");
  if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  else if (repeat === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (repeat === "halfyearly") d.setMonth(d.getMonth() + 6);
  else if (repeat === "yearly") d.setFullYear(d.getFullYear() + 1);
  else return dateStr;
  return d.toISOString().slice(0, 10);
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function scanReceipt(base64, mediaType) {
  // Ruft die Netlify-Function auf (siehe netlify/functions/scan-receipt.js).
  // Der Anthropic API-Key bleibt serverseitig als Umgebungsvariable, nie im Browser.
  const response = await fetch("/.netlify/functions/scan-receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mediaType }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Beleg-Erkennung fehlgeschlagen");
  }
  return response.json();
}

/* ============================== STYLES ============================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');

.fb-root{
  --ink:#4a2e1f; --paper:#f7ead6; --panel:#fffaf3; --accent:#d97a4f; --accent-soft:#f3ddc9;
  --positive:#5c7a44; --positive-soft:#e9edd9; --negative:#c14a3a; --negative-soft:#f7ddd4;
  --warning:#b8791f; --warning-soft:#f6e7c8;
  --muted:#8a7360; --border:#e6d6c1;
  font-family:'Inter',system-ui,sans-serif; color:var(--ink); background:var(--paper);
  min-height:100vh; display:flex; width:100%;
}
.fb-display{ font-family:'Fraunces',Georgia,serif; }
.fb-mono{ font-family:'IBM Plex Mono',monospace; font-variant-numeric:tabular-nums; }

.fb-sidebar{ width:220px; flex-shrink:0; background:var(--ink); color:#fff; padding:24px 14px; display:flex; flex-direction:column; gap:4px; position:sticky; top:0; height:100vh; }
.fb-sidebar-brand{ font-family:'Fraunces',serif; font-size:19px; margin:4px 8px 22px; display:flex; align-items:center; gap:8px; }
.fb-sidebar-brand .dot{ width:8px; height:8px; border-radius:50%; background:var(--accent); display:inline-block; }
.fb-nav-item{ display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:9px; cursor:pointer; color:rgba(255,255,255,.72); font-size:14px; }
.fb-nav-item:hover{ background:rgba(255,255,255,.08); color:#fff; }
.fb-nav-item.active{ background:var(--accent); color:#fff; }

.fb-main{ flex:1; min-width:0; padding:26px 30px 100px; }
.fb-topbar{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px; flex-wrap:wrap; gap:12px; }
.fb-title{ font-family:'Fraunces',serif; font-size:26px; margin:0; }
.fb-subtitle{ color:var(--muted); font-size:13px; margin-top:2px; }

.fb-card{ background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:20px; }
.fb-grid{ display:grid; gap:16px; }

.fb-stat-label{ font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin-bottom:6px; }
.fb-stat-value{ font-family:'IBM Plex Mono',monospace; font-size:32px; font-weight:600; }
.fb-stat-value.positive{ color:var(--positive); }
.fb-stat-value.negative{ color:var(--negative); }
.fb-stat-sub{ font-size:13px; color:var(--muted); margin-top:6px; }

.fb-btn{ background:var(--accent); color:#fff; border:none; border-radius:8px; padding:9px 15px; font-size:13.5px; cursor:pointer; font-weight:500; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
.fb-btn:hover{ opacity:.92; }
.fb-btn-secondary{ background:var(--accent-soft); color:var(--accent); }
.fb-btn-ghost{ background:transparent; color:var(--muted); border:1px solid var(--border); }
.fb-btn-danger{ background:var(--negative-soft); color:var(--negative); }
.fb-btn-icon{ padding:7px; border-radius:7px; }
.fb-btn:disabled{ opacity:.55; cursor:default; }
.fb-btn-sm{ padding:6px 11px; font-size:12.5px; }

.fb-input, .fb-select{ border:1px solid var(--border); border-radius:8px; padding:8px 10px; font-size:13.5px; font-family:inherit; width:100%; background:var(--panel); color:var(--ink); }
.fb-label{ font-size:12px; color:var(--muted); margin-bottom:4px; display:block; }
.fb-field{ margin-bottom:12px; }

.fb-table{ width:100%; border-collapse:collapse; font-size:13.5px; }
.fb-table th{ text-align:left; color:var(--muted); font-weight:500; font-size:11px; text-transform:uppercase; letter-spacing:.04em; padding:8px 10px; border-bottom:1px solid var(--border); }
.fb-table td{ padding:10px; border-bottom:1px solid var(--border); }
.fb-table tr:last-child td{ border-bottom:none; }

.fb-progress{ height:7px; border-radius:4px; background:var(--border); overflow:hidden; }
.fb-progress-fill{ height:100%; border-radius:4px; }

.fb-cat-card{ display:flex; align-items:center; justify-content:space-between; gap:14px; padding:16px 18px; flex-wrap:wrap; }
.fb-cat-card + .fb-cat-card{ border-top:1px solid var(--border); }
.fb-cat-actions{ display:flex; gap:8px; }

.fb-mobile-nav{ display:none; }

@media(max-width:840px){
  .fb-sidebar{ display:none; }
  .fb-main{ padding:16px 14px calc(88px + env(safe-area-inset-bottom, 0px)); width:100%; }
  .fb-mobile-nav{ display:flex; position:fixed; bottom:0; left:0; right:0; background:var(--ink); padding:6px 12px calc(6px + env(safe-area-inset-bottom, 0px)); justify-content:space-around; z-index:50; }
  .fb-mobile-nav-item{ display:flex; flex-direction:column; align-items:center; gap:2px; color:rgba(255,255,255,.6); font-size:10px; cursor:pointer; flex:1; padding:6px 0; min-width:0; }
  .fb-mobile-nav-item.active{ color:#fff; }
}

.fb-modal-backdrop{ position:fixed; inset:0; background:rgba(74,46,31,.5); display:flex; align-items:center; justify-content:center; z-index:100; padding:14px; }
.fb-modal{ background:var(--panel); border-radius:16px; padding:22px; max-width:460px; width:100%; max-height:88vh; overflow-y:auto; }
.fb-modal-head{ display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.fb-modal-head h3{ font-family:'Fraunces',serif; font-size:19px; margin:0; }

.fb-tabs{ display:flex; gap:4px; background:var(--paper); padding:4px; border-radius:10px; margin-bottom:16px; }
.fb-tab{ flex:1; text-align:center; padding:8px; border-radius:7px; font-size:13px; cursor:pointer; color:var(--muted); }
.fb-tab.active{ background:var(--panel); color:var(--ink); font-weight:500; box-shadow:0 1px 2px rgba(0,0,0,.08); }

.fb-badge{ font-size:11px; padding:3px 9px; border-radius:20px; font-weight:500; white-space:nowrap; }
.fb-badge.positive{ background:var(--positive-soft); color:var(--positive); }
.fb-badge.negative{ background:var(--negative-soft); color:var(--negative); }
.fb-badge.warning{ background:var(--warning-soft); color:var(--warning); }
.fb-badge.neutral{ background:var(--paper); color:var(--muted); }

.fb-toast{ position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--ink); color:#fff; padding:10px 18px; border-radius:30px; font-size:13px; z-index:200; }

.fb-empty{ text-align:center; color:var(--muted); padding:30px 10px; font-size:13.5px; }
.fb-spin{ animation:fb-spin 1s linear infinite; }
@keyframes fb-spin{ from{ transform:rotate(0deg);} to{ transform:rotate(360deg);} }

.fb-month-nav{ display:flex; align-items:center; gap:10px; }
.fb-month-nav button{ background:var(--panel); border:1px solid var(--border); border-radius:7px; width:30px; height:30px; cursor:pointer; color:var(--ink); }

.fb-checkrow{ display:flex; flex-wrap:wrap; gap:6px; }
.fb-check-pill{ border:1px solid var(--border); border-radius:20px; padding:5px 12px; font-size:12.5px; cursor:pointer; color:var(--muted); background:var(--panel); white-space:nowrap; }
.fb-check-pill.active{ background:var(--accent); border-color:var(--accent); color:#fff; }

.fb-pos-row{ display:flex; gap:8px; align-items:flex-start; margin-bottom:8px; }
.fb-pos-row .fb-input{ flex:1; }
.fb-pos-row .fb-amount{ width:100px; }

.fb-section-title{ font-family:'Fraunces',serif; font-size:16px; margin:22px 0 10px; }

.fb-donut-row{ display:flex; align-items:center; justify-content:center; gap:24px; flex-wrap:wrap; }
.fb-sub-row{ display:flex; align-items:center; justify-content:space-between; gap:14px; padding:14px 18px; flex-wrap:wrap; }
.fb-sub-row + .fb-sub-row{ border-top:1px solid var(--border); }
.fb-fixed-row{ display:flex; justify-content:space-between; font-size:13px; padding:6px 0; color:var(--muted); }

.fb-fixed-expand{ background:var(--accent-soft); border-radius:10px; padding:14px; margin:2px 0 12px; }
.fb-cat-name-input{ font-family:'Fraunces',serif; font-size:16px; font-weight:600; flex:1; max-width:340px; border:1px solid transparent; background:transparent; padding:4px 6px; border-radius:7px; }
.fb-cat-name-input:hover, .fb-cat-name-input:focus{ border-color:var(--border); background:var(--panel); outline:none; }
`;

/* ============================== KLEINE BAUSTEINE ============================== */

function StatCard({ label, value, positive, sub }) {
  return (
    <div className="fb-card">
      <div className="fb-stat-label">{label}</div>
      <div className={`fb-stat-value ${positive ? "positive" : "negative"}`}>{formatCHF(value)}</div>
      {sub && <div className="fb-stat-sub">{sub}</div>}
    </div>
  );
}

function ProgressBar({ plan, ist }) {
  const pct = plan > 0 ? Math.min(100, (ist / plan) * 100) : ist > 0 ? 100 : 0;
  const over = ist > plan;
  return (
    <div className="fb-progress">
      <div className="fb-progress-fill" style={{ width: `${pct}%`, background: over ? "var(--negative)" : "var(--accent)" }} />
    </div>
  );
}

function BudgetDonut({ plan, ist, size = 148 }) {
  const pct = plan > 0 ? (ist / plan) * 100 : ist > 0 ? 100 : 0;
  const over = ist > plan;
  const usedPct = Math.min(pct, 100);
  const data = over
    ? [{ name: "Verwendet", value: 1 }]
    : [{ name: "Verwendet", value: usedPct || 0.0001 }, { name: "Übrig", value: 100 - usedPct || 0.0001 }];
  const colors = over ? ["#c14a3a"] : ["#d97a4f", "#f3ddc9"];
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={size * 0.33} outerRadius={size * 0.5} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={colors[i]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <div className="fb-mono" style={{ fontSize: size * 0.19, fontWeight: 600, color: over ? "var(--negative)" : "var(--ink)" }}>{Math.round(pct)}%</div>
        <div style={{ fontSize: size * 0.075, color: "var(--muted)" }}>verwendet</div>
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return <div className="fb-toast">{message}</div>;
}

/* ============================== DASHBOARD ============================== */

function Dashboard({ yearBudget, expenses, year, month, setMonth, goCategories, openExpenseModal, reminders, openReminders }) {
  const monthData = useMemo(() => computeMonthData(yearBudget, expenses, year, month), [yearBudget, expenses, year, month]);

  const totalIncome = (yearBudget?.income?.einkuenfte1 || 0) + (yearBudget?.income?.einkuenfte2 || 0) + (yearBudget?.income?.zusatzeinkuenfte || 0);
  const monthSavings = totalIncome - monthData.istTotal;

  const dueReminders = useMemo(() => {
    return (reminders || [])
      .map((r) => ({ ...r, status: reminderStatus(r) }))
      .filter((r) => r.status.tone !== "neutral")
      .sort((a, b) => a.status.days - b.status.days);
  }, [reminders]);

  const startMonth = yearBudget?.startMonth || 1;
  const ytd = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    // Endmonat der YTD-Betrachtung: vergangenes Jahr -> Dezember, künftiges Jahr -> noch nichts,
    // aktuelles Jahr -> aktueller Monat. Beginnt erst ab dem Startmonat der Budgetrechnung.
    const endMonth = year < curYear ? 12 : year > curYear ? startMonth - 1 : curMonth;
    let plan = 0, ist = 0;
    for (let m = startMonth; m <= endMonth; m++) {
      const d = computeMonthData(yearBudget, expenses, year, m);
      plan += d.planTotal;
      ist += d.istTotal;
    }
    const monthsCounted = Math.max(0, endMonth - startMonth + 1);
    return { plan, ist, remaining: plan - ist, monthsCounted };
  }, [yearBudget, expenses, year, startMonth]);
  const ytdIncome = totalIncome * ytd.monthsCounted;
  const ytdSavings = ytdIncome - ytd.ist;

  return (
    <div>
      <div className="fb-topbar">
        <div>
          <h1 className="fb-title">Dashboard</h1>
          <div className="fb-subtitle">Übersicht Einnahmen &amp; Ausgaben</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="fb-month-nav">
            <button onClick={() => setMonth(month === 1 ? 12 : month - 1)}>‹</button>
            <div className="fb-mono" style={{ minWidth: 130, textAlign: "center" }}>{MONTHS_LONG[month - 1]} {year}</div>
            <button onClick={() => setMonth(month === 12 ? 1 : month + 1)}>›</button>
          </div>
          <button className="fb-btn" onClick={() => openExpenseModal({})}>
            <Plus size={15} /> Ausgabe erfassen
          </button>
        </div>
      </div>

      <div className="fb-section-title" style={{ marginTop: 0 }}>Aktueller Monat</div>
      <div className="fb-card fb-donut-row">
        <StatCard label="Budget übrig diesen Monat" value={monthData.remaining} positive={monthData.remaining >= 0}
          sub={`Plan ${formatCHF(monthData.planTotal)} · Ist ${formatCHF(monthData.istTotal)}`} />
        <StatCard label="Gespartes Geld diesen Monat" value={monthSavings} positive={monthSavings >= 0}
          sub={`Einnahmen ${formatCHF(totalIncome)} · Ausgaben ${formatCHF(monthData.istTotal)}`} />
        <BudgetDonut plan={monthData.planTotal} ist={monthData.istTotal} />
      </div>

      {dueReminders.length > 0 && (
        <div className="fb-card" style={{ marginTop: 16, padding: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={15} style={{ color: "var(--warning)" }} />
              <strong style={{ fontSize: 14 }}>Anstehende Erinnerungen</strong>
            </div>
            <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={openReminders}>Alle anzeigen</button>
          </div>
          {dueReminders.slice(0, 4).map((r) => (
            <div className="fb-sub-row" key={r.id} style={{ padding: "10px 18px" }}>
              <span style={{ fontSize: 13.5 }}>{r.title}</span>
              <span className={`fb-badge ${r.status.tone}`}>{r.status.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="fb-section-title">
        Jahresübersicht ({year}, year to date{startMonth > 1 ? ` · ab ${MONTHS_LONG[startMonth - 1]}` : ""})
      </div>
      <div className="fb-card fb-donut-row">
        <StatCard label="Budget übrig YTD" value={ytd.remaining} positive={ytd.remaining >= 0}
          sub={`Plan ${formatCHF(ytd.plan)} · Ist ${formatCHF(ytd.ist)}`} />
        <StatCard label="Gespartes Geld YTD" value={ytdSavings} positive={ytdSavings >= 0}
          sub={`Einnahmen ${formatCHF(ytdIncome)} · Ausgaben ${formatCHF(ytd.ist)}`} />
        <BudgetDonut plan={ytd.plan} ist={ytd.ist} />
      </div>

      <div style={{ marginTop: 18, textAlign: "right" }}>
        <button className="fb-btn fb-btn-secondary" onClick={goCategories}>
          Zur Detail-Übersicht <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

/* ============================== POSITIONEN-ÜBERSICHT (LEVEL 1) ============================== */

function CategoriesOverview({ yearBudget, expenses, year, month, openDetails, openBilling }) {
  const monthData = useMemo(() => computeMonthData(yearBudget, expenses, year, month), [yearBudget, expenses, year, month]);
  const categoryEntries = Object.entries(yearBudget?.categories || {});
  return (
    <div>
      <div className="fb-topbar">
        <div>
          <h1 className="fb-title">Budget-Positionen</h1>
          <div className="fb-subtitle">{MONTHS_LONG[month - 1]} {year} · Ist vs. Plan pro Position</div>
        </div>
      </div>
      <div className="fb-card" style={{ padding: 0 }}>
        {categoryEntries.map(([catId, cat]) => {
          const d = monthData.byCategory[catId] || { plan: 0, ist: 0 };
          const over = d.ist > d.plan;
          return (
            <div className="fb-cat-card" key={catId}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{cat.name}</strong>
                  <span className={`fb-badge ${over ? "negative" : "positive"}`}>
                    {formatCHF(d.plan - d.ist)} {over ? "über Budget" : "übrig"}
                  </span>
                </div>
                <ProgressBar plan={d.plan} ist={d.ist} />
                <div className="fb-stat-sub" style={{ marginTop: 5 }}>Plan {formatCHF(d.plan)} · Ist {formatCHF(d.ist)}</div>
              </div>
              <div className="fb-cat-actions">
                <button className="fb-btn fb-btn-secondary fb-btn-sm" onClick={() => openDetails(catId)}>
                  Details <ChevronRight size={13} />
                </button>
                <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={() => openBilling(catId, undefined)}>
                  <Receipt size={13} /> Abrechnung
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== UNTERTHEMEN (LEVEL 2) ============================== */

function CategorySubthemes({ catId, yearBudget, expenses, year, month, openBilling, goBack }) {
  const cat = yearBudget?.categories?.[catId];
  const positions = cat?.positions || [];

  return (
    <div>
      <div className="fb-topbar">
        <div>
          <button className="fb-btn fb-btn-ghost" onClick={goBack} style={{ marginBottom: 10 }}>
            <ArrowLeft size={14} /> Zurück
          </button>
          <h1 className="fb-title">{cat?.name || catId}</h1>
          <div className="fb-subtitle">{MONTHS_LONG[month - 1]} {year} · Unterthemen dieser Position</div>
        </div>
        <button className="fb-btn fb-btn-secondary" onClick={() => openBilling(catId, undefined)}>
          <Receipt size={15} /> Ganze Kategorie abrechnen
        </button>
      </div>

      <div className="fb-card" style={{ padding: 0 }}>
        {positions.length === 0 ? (
          <div className="fb-empty">Keine Unterthemen vorhanden.</div>
        ) : positions.map((p) => {
          if (p.isFixed) {
            const amt = fixedAmountTotal(p);
            return (
              <div className="fb-sub-row" key={p.id} style={{ opacity: .85 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontSize: 13.5 }}>{p.name}</strong>
                    <span className="fb-badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Fixkosten</span>
                  </div>
                  <div className="fb-stat-sub" style={{ marginTop: 5 }}>Automatisch verrechnet · {formatCHF(amt)}</div>
                </div>
              </div>
            );
          }
          const ist = computePositionIst(expenses, year, month, catId, p.name);
          const over = ist > p.amount;
          return (
            <div className="fb-sub-row" key={p.id}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                  <strong style={{ fontSize: 13.5 }}>{p.name}</strong>
                  <span className={`fb-badge ${over ? "negative" : "positive"}`}>
                    {formatCHF(p.amount - ist)} {over ? "über Budget" : "übrig"}
                  </span>
                </div>
                <ProgressBar plan={p.amount} ist={ist} />
                <div className="fb-stat-sub" style={{ marginTop: 5 }}>Plan {formatCHF(p.amount)} · Ist {formatCHF(ist)}</div>
              </div>
              <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={() => openBilling(catId, p.name)}>
                <Receipt size={13} /> Abrechnung
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== ABRECHNUNG (LEVEL 3) ============================== */

function Billing({ catId, position, yearBudget, expenses, deleteExpense, openExpenseModal, goBack }) {
  const rows = expenses
    .filter((e) => e.categoryId === catId && (!position || e.position === position))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <div className="fb-topbar">
        <div>
          <button className="fb-btn fb-btn-ghost" onClick={goBack} style={{ marginBottom: 10 }}>
            <ArrowLeft size={14} /> Zurück
          </button>
          <h1 className="fb-title">{getCategoryName(yearBudget, catId)}{position ? ` · ${position}` : ""}</h1>
          <div className="fb-subtitle">Abrechnung — alle erfassten Ausgaben</div>
        </div>
        <button className="fb-btn" onClick={() => openExpenseModal({ catId, position, lockCategory: true, lockPosition: !!position })}>
          <Plus size={15} /> Ausgabe erfassen
        </button>
      </div>

      <div className="fb-card" style={{ overflowX: "auto" }}>
        {rows.length === 0 ? (
          <div className="fb-empty">Noch keine Ausgaben erfasst.</div>
        ) : (
          <table className="fb-table">
            <thead>
              <tr><th>Datum</th><th>Einkaufsort</th><th>Einkäufer</th><th>Position</th><th style={{ textAlign: "right" }}>Wert</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="fb-mono">{r.date}</td>
                  <td>{r.ort}</td>
                  <td>{r.einkaeufer}</td>
                  <td>{r.position}</td>
                  <td className="fb-mono" style={{ textAlign: "right" }}>{formatCHF(r.betrag)}</td>
                  <td>
                    <button className="fb-btn fb-btn-ghost fb-btn-icon" onClick={() => deleteExpense(r.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============================== AUSGABE ERFASSEN (MODAL) ============================== */

function ExpenseModal({ yearBudget, persons, defaultCategoryId, defaultPosition, lockCategory, lockPosition, onClose, onSave }) {
  const categoryIds = Object.keys(yearBudget?.categories || {});
  const [tab, setTab] = useState("manual");
  const [categoryId, setCategoryId] = useState(defaultCategoryId || categoryIds[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const positionsForCat = (yearBudget?.categories?.[categoryId]?.positions || []).filter((p) => !p.isFixed);
  const [position, setPosition] = useState(defaultPosition || positionsForCat[0]?.name || "Sonstiges");
  const [ort, setOrt] = useState("");
  const [einkaeufer, setEinkaeufer] = useState(persons[0] || "");
  const [betrag, setBetrag] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanned, setScanned] = useState(false);
  const fileInputRef = useRef(null);

  function handleCategoryChange(cid) {
    setCategoryId(cid);
    if (!lockPosition) {
      const pos = (yearBudget?.categories?.[cid]?.positions || []).filter((p) => !p.isFixed);
      setPosition(pos[0]?.name || "Sonstiges");
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanError("");
    try {
      const base64 = await fileToBase64(file);
      const result = await scanReceipt(base64, file.type || "image/jpeg");
      if (result.datum) setDate(result.datum);
      if (result.ort) setOrt(result.ort);
      if (result.betrag != null) setBetrag(String(result.betrag));
      setScanned(true);
    } catch (err) {
      setScanError("Beleg konnte nicht automatisch gelesen werden. Bitte manuell ergänzen.");
    } finally {
      setScanning(false);
    }
  }

  function submit() {
    if (!betrag || !ort || !einkaeufer) return;
    onSave({ categoryId, date, position, ort, einkaeufer, betrag: Number(betrag) });
  }

  return (
    <div className="fb-modal-backdrop" onClick={onClose}>
      <div className="fb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fb-modal-head">
          <h3>Ausgabe erfassen</h3>
          <button className="fb-btn fb-btn-ghost fb-btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="fb-tabs">
          <div className={`fb-tab ${tab === "manual" ? "active" : ""}`} onClick={() => setTab("manual")}>Manuell</div>
          <div className={`fb-tab ${tab === "photo" ? "active" : ""}`} onClick={() => setTab("photo")}>Foto</div>
        </div>

        {tab === "photo" && (
          <div style={{ marginBottom: 14 }}>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
            <button className="fb-btn fb-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => fileInputRef.current?.click()} disabled={scanning}>
              {scanning ? <><Loader2 size={15} className="fb-spin" /> Beleg wird gelesen…</> : <><Camera size={15} /> Beleg fotografieren / hochladen</>}
            </button>
            {scanError && <div style={{ color: "var(--negative)", fontSize: 12.5, marginTop: 8 }}>{scanError}</div>}
            {scanned && !scanError && <div style={{ color: "var(--positive)", fontSize: 12.5, marginTop: 8 }}><Check size={13} style={{ verticalAlign: "-2px" }} /> Daten übernommen — bitte prüfen und Einkäufer/Position ergänzen.</div>}
          </div>
        )}

        {!lockCategory && (
          <div className="fb-field">
            <label className="fb-label">Kategorie</label>
            <select className="fb-select" value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
              {categoryIds.map((cid) => <option key={cid} value={cid}>{yearBudget.categories[cid].name}</option>)}
            </select>
          </div>
        )}

        <div className="fb-field">
          <label className="fb-label">Datum</label>
          <input className="fb-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="fb-field">
          <label className="fb-label">Position</label>
          {lockPosition ? (
            <div className="fb-input" style={{ background: "#f3e8da", color: "var(--muted)" }}>{position}</div>
          ) : (
            <select className="fb-select" value={position} onChange={(e) => setPosition(e.target.value)}>
              {positionsForCat.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              <option value="Sonstiges">Sonstiges / Neu</option>
            </select>
          )}
        </div>

        <div className="fb-field">
          <label className="fb-label">Einkaufsort</label>
          <input className="fb-input" value={ort} onChange={(e) => setOrt(e.target.value)} placeholder="z. B. Migros" />
        </div>
        <div className="fb-field">
          <label className="fb-label">Einkäufer</label>
          <select className="fb-select" value={einkaeufer} onChange={(e) => setEinkaeufer(e.target.value)}>
            {persons.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="fb-field">
          <label className="fb-label">Wert (CHF)</label>
          <input className="fb-input" type="number" step="0.05" value={betrag} onChange={(e) => setBetrag(e.target.value)} placeholder="0.00" />
        </div>

        <button className="fb-btn" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={submit} disabled={!betrag || !ort}>
          Speichern
        </button>
      </div>
    </div>
  );
}

/* ============================== JAHRESBUDGET (inkl. Fixkosten) ============================== */

function PositionRow({ p, prevAmt, persons, onUpdate, onToggleFixed, onRemove, onToggleMonth, onAddSplit, onUpdateSplit, onRemoveSplit }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="fb-pos-row" style={{ marginBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <input className="fb-input" value={p.name} onChange={(e) => onUpdate("name", e.target.value)} />
          {prevAmt != null && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Vorjahr: {formatCHF(prevAmt)}</div>}
        </div>
        <input className="fb-input fb-amount" type="number" value={p.amount} onChange={(e) => onUpdate("amount", e.target.value)} />
        <div className={`fb-check-pill ${p.isFixed ? "active" : ""}`} onClick={onToggleFixed} style={{ marginTop: 2 }}>Fixkosten</div>
        <button className="fb-btn fb-btn-ghost fb-btn-icon" onClick={onRemove}><Trash2 size={14} /></button>
      </div>

      {p.isFixed && (
        <div className="fb-fixed-expand">
          <div className="fb-field" style={{ marginBottom: 10 }}>
            <label className="fb-label">Häufigkeit</label>
            <div className="fb-checkrow">
              <div className={`fb-check-pill ${p.type === "monthly" ? "active" : ""}`} onClick={() => onUpdate("type", "monthly")}>Monatlich</div>
              <div className={`fb-check-pill ${p.type === "yearly" ? "active" : ""}`} onClick={() => onUpdate("type", "yearly")}>Jährlich</div>
            </div>
          </div>

          {p.type === "monthly" ? (
            <div className="fb-field" style={{ marginBottom: 10 }}>
              <label className="fb-label">Fällige Monate</label>
              <div className="fb-checkrow">
                {MONTHS_SHORT.map((m, i) => (
                  <div key={m} className={`fb-check-pill ${p.months.includes(i + 1) ? "active" : ""}`} onClick={() => onToggleMonth(i + 1)}>{m}</div>
                ))}
              </div>
            </div>
          ) : (
            <div className="fb-field" style={{ maxWidth: 220, marginBottom: 10 }}>
              <label className="fb-label">Fälligkeitsmonat</label>
              <select className="fb-select" value={p.yearlyMonth} onChange={(e) => onUpdate("yearlyMonth", Number(e.target.value))}>
                {MONTHS_LONG.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}

          <div className="fb-field" style={{ marginBottom: 0 }}>
            <label className="fb-label">Aufteilung auf Personen (optional)</label>
            {(p.split || []).map((s, idx) => (
              <div className="fb-pos-row" key={idx}>
                <select className="fb-select" style={{ flex: 1 }} value={s.person} onChange={(e) => onUpdateSplit(idx, "person", e.target.value)}>
                  {persons.map((pn) => <option key={pn} value={pn}>{pn}</option>)}
                </select>
                <input className="fb-input fb-amount" type="number" value={s.amount} onChange={(e) => onUpdateSplit(idx, "amount", e.target.value)} />
                <button className="fb-btn fb-btn-ghost fb-btn-icon" onClick={() => onRemoveSplit(idx)}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={onAddSplit}><Plus size={12} /> Person hinzufügen</button>
          </div>
        </div>
      )}
    </div>
  );
}

function YearBudgetPage({ yearBudget, prevYearBudget, years, year, setYear, persistYearBudget, addYear, persons }) {
  const [draft, setDraft] = useState(yearBudget);
  const [newYearOpen, setNewYearOpen] = useState(false);

  useEffect(() => setDraft(yearBudget), [yearBudget]);

  const prevMap = useMemo(() => {
    const m = {};
    if (prevYearBudget) {
      Object.entries(prevYearBudget.categories).forEach(([cid, cat]) => {
        m[cid] = {};
        (cat.positions || []).forEach((p) => { m[cid][p.name] = p.amount; });
      });
    }
    return m;
  }, [prevYearBudget]);

  if (!draft) return null;

  function updateCategoryName(catId, name) {
    setDraft((d) => ({ ...d, categories: { ...d.categories, [catId]: { ...d.categories[catId], name } } }));
  }
  function addCategory() {
    const id = uid();
    setDraft((d) => ({ ...d, categories: { ...d.categories, [id]: { name: "Neue Kategorie", positions: [] } } }));
  }
  function removeCategory(catId) {
    const name = draft.categories[catId]?.name || catId;
    if (typeof window !== "undefined" && window.confirm && !window.confirm(`Kategorie „${name}" wirklich löschen? Alle Positionen gehen verloren.`)) return;
    setDraft((d) => { const c = { ...d.categories }; delete c[catId]; return { ...d, categories: c }; });
  }
  function updatePosition(catId, posId, field, value) {
    setDraft((d) => ({
      ...d,
      categories: {
        ...d.categories,
        [catId]: {
          ...d.categories[catId],
          positions: d.categories[catId].positions.map((p) => (p.id === posId ? { ...p, [field]: field === "amount" || field === "yearlyMonth" ? Number(value) : value } : p)),
        },
      },
    }));
  }
  function togglePositionFixed(catId, posId) {
    setDraft((d) => ({
      ...d,
      categories: {
        ...d.categories,
        [catId]: {
          ...d.categories[catId],
          positions: d.categories[catId].positions.map((p) => (p.id === posId ? { ...p, isFixed: !p.isFixed } : p)),
        },
      },
    }));
  }
  function toggleMonth(catId, posId, m) {
    setDraft((d) => ({
      ...d,
      categories: {
        ...d.categories,
        [catId]: {
          ...d.categories[catId],
          positions: d.categories[catId].positions.map((p) => {
            if (p.id !== posId) return p;
            const has = p.months.includes(m);
            return { ...p, months: has ? p.months.filter((x) => x !== m) : [...p.months, m].sort((a, b) => a - b) };
          }),
        },
      },
    }));
  }
  function addPosition(catId) {
    setDraft((d) => ({ ...d, categories: { ...d.categories, [catId]: { ...d.categories[catId], positions: [...d.categories[catId].positions, { id: uid(), name: "Neue Position", amount: 0, isFixed: false, type: "monthly", months: [...ALL_MONTHS], yearlyMonth: 1, split: [] }] } } }));
  }
  function removePosition(catId, posId) {
    setDraft((d) => ({ ...d, categories: { ...d.categories, [catId]: { ...d.categories[catId], positions: d.categories[catId].positions.filter((p) => p.id !== posId) } } }));
  }
  function addSplit(catId, posId) {
    setDraft((d) => ({
      ...d,
      categories: {
        ...d.categories,
        [catId]: {
          ...d.categories[catId],
          positions: d.categories[catId].positions.map((p) => (p.id === posId ? { ...p, split: [...(p.split || []), { person: persons[0] || "", amount: 0 }] } : p)),
        },
      },
    }));
  }
  function updateSplit(catId, posId, idx, field, value) {
    setDraft((d) => ({
      ...d,
      categories: {
        ...d.categories,
        [catId]: {
          ...d.categories[catId],
          positions: d.categories[catId].positions.map((p) => {
            if (p.id !== posId) return p;
            const split = p.split.map((s, i) => (i === idx ? { ...s, [field]: field === "amount" ? Number(value) : value } : s));
            return { ...p, split };
          }),
        },
      },
    }));
  }
  function removeSplit(catId, posId, idx) {
    setDraft((d) => ({
      ...d,
      categories: {
        ...d.categories,
        [catId]: {
          ...d.categories[catId],
          positions: d.categories[catId].positions.map((p) => (p.id === posId ? { ...p, split: p.split.filter((_, i) => i !== idx) } : p)),
        },
      },
    }));
  }
  function updateIncome(field, value) {
    setDraft((d) => ({ ...d, income: { ...d.income, [field]: Number(value) } }));
  }
  function updateStartMonth(value) {
    setDraft((d) => ({ ...d, startMonth: Number(value) }));
  }
  function resetAllToZero() {
    if (
      typeof window !== "undefined" && window.confirm &&
      !window.confirm(`Wirklich alle Beträge für ${year} auf 0 setzen? Betrifft alle Positionen und Einkünfte (Namen/Struktur/Fixkosten-Einstellungen bleiben erhalten). Bereits erfasste Ausgaben sind davon NICHT betroffen. Kann nicht rückgängig gemacht werden.`)
    ) return;
    const resetCategories = {};
    Object.entries(draft.categories).forEach(([catId, cat]) => {
      resetCategories[catId] = {
        ...cat,
        positions: cat.positions.map((p) => ({
          ...p,
          amount: 0,
          split: (p.split || []).map((s) => ({ ...s, amount: 0 })),
        })),
      };
    });
    persistYearBudget({ ...draft, income: { einkuenfte1: 0, einkuenfte2: 0, zusatzeinkuenfte: 0 }, categories: resetCategories });
  }

  const totalIncome = (draft.income.einkuenfte1 || 0) + (draft.income.einkuenfte2 || 0) + (draft.income.zusatzeinkuenfte || 0);
  const allPositions = Object.values(draft.categories).flatMap((c) => c.positions);
  const totalVar = allPositions.filter((p) => !p.isFixed).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalFixed = allPositions.filter((p) => p.isFixed).reduce((s, p) => s + fixedAmountTotal(p), 0);

  return (
    <div>
      <div className="fb-topbar">
        <div>
          <h1 className="fb-title">Jahresbudget</h1>
          <div className="fb-subtitle">Alle Positionen inkl. Fixkosten — Fixkosten-Toggle kalkuliert den Betrag automatisch jeden fälligen Monat</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select className="fb-select" style={{ width: "auto" }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="fb-btn fb-btn-ghost" onClick={resetAllToZero}><RotateCcw size={14} /> Alle Beträge auf 0 setzen</button>
          <button className="fb-btn fb-btn-secondary" onClick={() => setNewYearOpen(true)}>+ Neues Jahr</button>
          <button className="fb-btn" onClick={() => persistYearBudget(draft)}>Speichern</button>
        </div>
      </div>

      {prevYearBudget && (
        <div className="fb-stat-sub" style={{ marginBottom: 14 }}>
          Vorjahreswerte ({prevYearBudget.year}) werden zu jeder Position als Referenz angezeigt.
        </div>
      )}

      <div className="fb-card" style={{ marginBottom: 18 }}>
        <div className="fb-section-title" style={{ marginTop: 0 }}>Start der Budgetrechnung</div>
        <div className="fb-field" style={{ maxWidth: 260, marginBottom: 6 }}>
          <label className="fb-label">Ab welchem Monat soll {year} berechnet werden?</label>
          <select className="fb-select" value={draft.startMonth || 1} onChange={(e) => updateStartMonth(e.target.value)}>
            {MONTHS_LONG.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="fb-stat-sub">
          Nützlich, wenn ihr erst unter dem Jahr startet — z. B. ab August: Dashboard und Jahresübersicht
          rechnen dann nur ab diesem Monat bis Jahresende. Jährliche Fixkosten (z. B. Steuern) werden
          weiterhin durch 12 geteilt und gleichmässig eingerechnet — nur in den Monaten vor dem
          Startmonat wird nichts davon gezählt. Eine sauber vollständige Jahresabrechnung für die Monate
          davor gibt es dadurch nicht, aber die Budgetrechnung ab jetzt stimmt.
        </div>
      </div>

      <div className="fb-card" style={{ marginBottom: 18 }}>
        <div className="fb-section-title" style={{ marginTop: 0 }}>Monatliche Einkünfte</div>
        <div className="fb-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          <div className="fb-field" style={{ margin: 0 }}>
            <label className="fb-label">Einkünfte 1</label>
            <input className="fb-input" type="number" value={draft.income.einkuenfte1} onChange={(e) => updateIncome("einkuenfte1", e.target.value)} />
            {prevYearBudget && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Vorjahr: {formatCHF(prevYearBudget.income.einkuenfte1)}</div>}
          </div>
          <div className="fb-field" style={{ margin: 0 }}>
            <label className="fb-label">Einkünfte 2</label>
            <input className="fb-input" type="number" value={draft.income.einkuenfte2} onChange={(e) => updateIncome("einkuenfte2", e.target.value)} />
            {prevYearBudget && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Vorjahr: {formatCHF(prevYearBudget.income.einkuenfte2)}</div>}
          </div>
          <div className="fb-field" style={{ margin: 0 }}>
            <label className="fb-label">Zusatzeinkünfte</label>
            <input className="fb-input" type="number" value={draft.income.zusatzeinkuenfte} onChange={(e) => updateIncome("zusatzeinkuenfte", e.target.value)} />
            {prevYearBudget && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Vorjahr: {formatCHF(prevYearBudget.income.zusatzeinkuenfte)}</div>}
          </div>
        </div>
        <div className="fb-stat-sub" style={{ marginTop: 12 }}>Summe monatliche Einkünfte: <strong className="fb-mono">{formatCHF(totalIncome)}</strong></div>
      </div>

      {Object.entries(draft.categories).map(([catId, cat]) => {
        const positions = cat.positions;
        const variableSum = positions.filter((p) => !p.isFixed).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const fixedSum = positions.filter((p) => p.isFixed).reduce((s, p) => s + fixedAmountTotal(p), 0);
        return (
          <div className="fb-card" key={catId} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
              <input className="fb-cat-name-input" value={cat.name} onChange={(e) => updateCategoryName(catId, e.target.value)} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="fb-mono" style={{ fontSize: 13.5, color: "var(--muted)" }}>Total: {formatCHF(variableSum + fixedSum)}</span>
                <button className="fb-btn fb-btn-ghost fb-btn-icon" onClick={() => removeCategory(catId)}><Trash2 size={15} /></button>
              </div>
            </div>

            {positions.map((p) => (
              <PositionRow
                key={p.id}
                p={p}
                prevAmt={prevMap[catId]?.[p.name]}
                persons={persons}
                onUpdate={(field, value) => updatePosition(catId, p.id, field, value)}
                onToggleFixed={() => togglePositionFixed(catId, p.id)}
                onRemove={() => removePosition(catId, p.id)}
                onToggleMonth={(m) => toggleMonth(catId, p.id, m)}
                onAddSplit={() => addSplit(catId, p.id)}
                onUpdateSplit={(idx, field, value) => updateSplit(catId, p.id, idx, field, value)}
                onRemoveSplit={(idx) => removeSplit(catId, p.id, idx)}
              />
            ))}

            <button className="fb-btn fb-btn-secondary" onClick={() => addPosition(catId)}><Plus size={13} /> Position hinzufügen</button>
            <div className="fb-stat-sub" style={{ marginTop: 10 }}>Variabel: {formatCHF(variableSum)} · Fixkosten: {formatCHF(fixedSum)}</div>
          </div>
        );
      })}

      <button className="fb-btn fb-btn-secondary" onClick={addCategory} style={{ marginBottom: 18 }}>
        <Plus size={14} /> Neue Hauptposition
      </button>

      <div className="fb-card">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
          <span>Variable Positionen (alle Kategorien)</span><span className="fb-mono">{formatCHF(totalVar)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginTop: 4 }}>
          <span>Fixkosten (alle Kategorien)</span><span className="fb-mono">{formatCHF(totalFixed)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, marginTop: 8, fontWeight: 600, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          <span>Total Ausgaben (Plan)</span><span className="fb-mono">{formatCHF(totalVar + totalFixed)}</span>
        </div>
      </div>

      {newYearOpen && (
        <NewYearModal
          years={years}
          currentDraft={draft}
          onClose={() => setNewYearOpen(false)}
          onCreate={(y, base) => { addYear(y, base); setNewYearOpen(false); }}
        />
      )}
    </div>
  );
}

function NewYearModal({ years, currentDraft, onClose, onCreate }) {
  const [y, setY] = useState(Math.max(...years) + 1);
  const [base, setBase] = useState("copy");
  return (
    <div className="fb-modal-backdrop" onClick={onClose}>
      <div className="fb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fb-modal-head"><h3>Neues Jahr anlegen</h3><button className="fb-btn fb-btn-ghost fb-btn-icon" onClick={onClose}><X size={16} /></button></div>
        <div className="fb-field">
          <label className="fb-label">Jahr</label>
          <input className="fb-input" type="number" value={y} onChange={(e) => setY(Number(e.target.value))} />
        </div>
        <div className="fb-field">
          <label className="fb-label">Grundlage</label>
          <div className="fb-checkrow">
            <div className={`fb-check-pill ${base === "copy" ? "active" : ""}`} onClick={() => setBase("copy")}>Aktuelles Jahr kopieren</div>
            <div className={`fb-check-pill ${base === "default" ? "active" : ""}`} onClick={() => setBase("default")}>Standard-Vorlage</div>
          </div>
        </div>
        <div className="fb-stat-sub" style={{ marginBottom: 12 }}>Nach dem Erstellen wird das aktuelle Jahr als Vorjahres-Referenz zu jeder Position angezeigt.</div>
        <button className="fb-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => onCreate(y, base === "copy" ? currentDraft : null)}>Jahr erstellen</button>
      </div>
    </div>
  );
}

/* ============================== ERINNERUNGEN ============================== */

function ReminderModal({ initial, onClose, onSave }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [deadline, setDeadline] = useState(initial?.deadline || new Date().toISOString().slice(0, 10));
  const [repeat, setRepeat] = useState(initial?.repeat || "none");
  const [alertIntervals, setAlertIntervals] = useState(initial?.alertIntervals || [14, 7]);

  function toggleAlert(v) {
    setAlertIntervals((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => b - a)));
  }

  function submit() {
    if (!title.trim() || !deadline) return;
    onSave({
      id: initial?.id || uid(),
      title: title.trim(),
      deadline,
      repeat,
      alertIntervals,
    });
  }

  return (
    <div className="fb-modal-backdrop" onClick={onClose}>
      <div className="fb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fb-modal-head">
          <h3>{initial ? "Erinnerung bearbeiten" : "Erinnerung erstellen"}</h3>
          <button className="fb-btn fb-btn-ghost fb-btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="fb-field">
          <label className="fb-label">Titel</label>
          <input className="fb-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Überprüfung Krankenkasse" />
        </div>

        <div className="fb-field">
          <label className="fb-label">Deadline</label>
          <input className="fb-input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>

        <div className="fb-field">
          <label className="fb-label">Wiederholung</label>
          <select className="fb-select" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            {REPEAT_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="fb-field" style={{ marginBottom: 6 }}>
          <label className="fb-label">Erinnerungs-/Warnintervall (Mehrfachauswahl)</label>
          <div className="fb-checkrow">
            {ALERT_OPTIONS.map((a) => (
              <div key={a.value} className={`fb-check-pill ${alertIntervals.includes(a.value) ? "active" : ""}`} onClick={() => toggleAlert(a.value)}>
                {a.label}
              </div>
            ))}
          </div>
        </div>

        <button className="fb-btn" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={submit} disabled={!title.trim() || !deadline}>
          Speichern
        </button>
      </div>
    </div>
  );
}

function RemindersPage({ reminders, persistReminders }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const sorted = [...reminders].sort((a, b) => (a.deadline < b.deadline ? -1 : 1));

  function saveReminder(r) {
    const exists = reminders.some((x) => x.id === r.id);
    const updated = exists ? reminders.map((x) => (x.id === r.id ? r : x)) : [...reminders, r];
    persistReminders(updated);
    setModalOpen(false);
    setEditing(null);
  }

  function removeReminder(id) {
    persistReminders(reminders.filter((r) => r.id !== id));
  }

  function markNext(r) {
    const updated = reminders.map((x) => (x.id === r.id ? { ...x, deadline: advanceDeadline(x.deadline, x.repeat) } : x));
    persistReminders(updated);
  }

  return (
    <div>
      <div className="fb-topbar">
        <div>
          <h1 className="fb-title">Erinnerungen</h1>
          <div className="fb-subtitle">Wichtige Fristen und Termine — mit Wiederholung und Vorwarnung</div>
        </div>
        <button className="fb-btn" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={15} /> Erinnerung erstellen
        </button>
      </div>

      <div className="fb-card" style={{ padding: 0 }}>
        {sorted.length === 0 ? (
          <div className="fb-empty">Noch keine Erinnerungen erfasst.</div>
        ) : sorted.map((r) => {
          const status = reminderStatus(r);
          return (
            <div className="fb-sub-row" key={r.id}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{r.title}</strong>
                  <span className={`fb-badge ${status.tone}`}>{status.label}</span>
                </div>
                <div className="fb-stat-sub">
                  Fällig am {formatDateCH(r.deadline)} · {REPEAT_LABEL[r.repeat] || "Keine (einmalig)"}
                  {r.alertIntervals?.length > 0 && (
                    <> · Warnung: {[...r.alertIntervals].sort((a, b) => b - a).map((v) => `${v}d`).join(", ")} vorher</>
                  )}
                </div>
              </div>
              <div className="fb-cat-actions">
                {r.repeat !== "none" && (
                  <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={() => markNext(r)} title="Nächste Fälligkeit setzen">
                    <RotateCcw size={13} /> Nächste Fälligkeit
                  </button>
                )}
                <button className="fb-btn fb-btn-secondary fb-btn-sm" onClick={() => { setEditing(r); setModalOpen(true); }}>
                  <Pencil size={13} />
                </button>
                <button className="fb-btn fb-btn-ghost fb-btn-icon" onClick={() => removeReminder(r.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <ReminderModal
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={saveReminder}
        />
      )}
    </div>
  );
}

/* ============================== PROFIL / EINSTELLUNGEN ============================== */

function SettingsPage({ householdName, inviteCode, userEmail, persons, persistPersons, expenses, yearBudget, onLogout }) {
  const [nameDraft, setNameDraft] = useState(householdName || "");
  const [personsDraft, setPersonsDraft] = useState(persons);
  const [members, setMembers] = useState(null);
  const [copyLabel, setCopyLabel] = useState("Kopieren");
  const [regenLoading, setRegenLoading] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => setNameDraft(householdName || ""), [householdName]);
  useEffect(() => setPersonsDraft(persons), [persons]);
  useEffect(() => {
    listMembers().then(setMembers).catch(() => setMembers([]));
  }, [inviteCode]);

  function updatePersonName(idx, value) {
    setPersonsDraft((list) => list.map((p, i) => (i === idx ? value : p)));
  }
  function addPerson() {
    setPersonsDraft((list) => [...list, `Person ${list.length + 1}`]);
  }
  function removePerson(idx) {
    setPersonsDraft((list) => list.filter((_, i) => i !== idx));
  }

  const [nameMsg, setNameMsg] = useState("");
  async function saveName() {
    setNameMsg("");
    try {
      await updateHouseholdName(nameDraft.trim() || householdName);
      setNameMsg("Gespeichert.");
      setTimeout(() => setNameMsg(""), 2000);
    } catch (err) {
      setNameMsg(err.message || "Speichern fehlgeschlagen.");
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyLabel("Kopiert!");
      setTimeout(() => setCopyLabel("Kopieren"), 1800);
    } catch {}
  }

  const [regenMsg, setRegenMsg] = useState("");
  async function handleRegenerate() {
    if (typeof window !== "undefined" && window.confirm && !window.confirm("Neuen Einladungscode erstellen? Der alte Code funktioniert danach nicht mehr.")) return;
    setRegenLoading(true);
    setRegenMsg("");
    try {
      await regenerateInviteCode();
    } catch (err) {
      setRegenMsg(err.message || "Fehler beim Erstellen des Codes.");
    } finally {
      setRegenLoading(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError("");
    setPwMsg("");
    if (pw1.length < 6) { setPwError("Mindestens 6 Zeichen."); return; }
    if (pw1 !== pw2) { setPwError("Passwörter stimmen nicht überein."); return; }
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPwMsg("Passwort geändert.");
      setPw1(""); setPw2("");
    } catch (err) {
      setPwError(err.message || "Fehler beim Ändern des Passworts.");
    }
  }

  function exportCsv() {
    const header = ["Datum", "Kategorie", "Position", "Einkaufsort", "Einkäufer", "Betrag"];
    const rows = expenses.map((e) => [
      e.date, getCategoryName(yearBudget, e.categoryId), e.position || "", e.ort || "", e.einkaeufer || "", e.betrag,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ausgaben_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await deleteOwnAccount();
      await supabase.auth.signOut();
    } catch (err) {
      setDeleteError(err.message || "Löschen fehlgeschlagen.");
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      <div className="fb-topbar">
        <div>
          <h1 className="fb-title">Profil &amp; Einstellungen</h1>
          <div className="fb-subtitle">Familie, Mitglieder und Konto verwalten</div>
        </div>
      </div>

      <div className="fb-card" style={{ marginBottom: 14 }}>
        <div className="fb-section-title" style={{ marginTop: 0 }}>Familienname</div>
        <div className="fb-pos-row">
          <input className="fb-input" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
          <button className="fb-btn" onClick={saveName}>Speichern</button>
        </div>
        {nameMsg && <div className="fb-stat-sub">{nameMsg}</div>}
      </div>

      <div className="fb-card" style={{ marginBottom: 14 }}>
        <div className="fb-section-title" style={{ marginTop: 0 }}>Familienmitglieder</div>
        <div className="fb-stat-sub" style={{ marginBottom: 10 }}>
          Werden bei "Einkäufer" und bei der Aufteilung von Fixkosten zur Auswahl angezeigt.
        </div>
        {personsDraft.map((name, idx) => (
          <div className="fb-pos-row" key={idx}>
            <input className="fb-input" value={name} onChange={(e) => updatePersonName(idx, e.target.value)} />
            <button className="fb-btn fb-btn-ghost fb-btn-icon" onClick={() => removePerson(idx)}><Trash2 size={14} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="fb-btn fb-btn-secondary" onClick={addPerson}><Plus size={13} /> Person hinzufügen</button>
          <button className="fb-btn" onClick={() => persistPersons(personsDraft)}>Speichern</button>
        </div>
      </div>

      <div className="fb-card" style={{ marginBottom: 14 }}>
        <div className="fb-section-title" style={{ marginTop: 0 }}>Einladungscode</div>
        <div className="fb-stat-sub" style={{ marginBottom: 10 }}>
          Weitere Familienmitglieder können mit diesem Code beitreten (Registrieren → "Code beitreten").
        </div>
        <div className="fb-pos-row" style={{ alignItems: "center" }}>
          <div className="fb-input fb-mono" style={{ background: "#f3e8da", flex: 1 }}>{inviteCode}</div>
          <button className="fb-btn fb-btn-secondary" onClick={copyCode}><Copy size={14} /> {copyLabel}</button>
          <button className="fb-btn fb-btn-ghost" onClick={handleRegenerate} disabled={regenLoading}>
            <RefreshCw size={14} /> {regenLoading ? "…" : "Neu generieren"}
          </button>
        </div>
        {regenMsg && <div className="fb-stat-sub" style={{ color: "var(--negative)" }}>{regenMsg}</div>}
      </div>

      <div className="fb-card" style={{ marginBottom: 14 }}>
        <div className="fb-section-title" style={{ marginTop: 0 }}><Users size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Mitglieder</div>
        {members === null ? (
          <div className="fb-stat-sub">Wird geladen…</div>
        ) : members.length === 0 ? (
          <div className="fb-stat-sub">Keine Mitglieder gefunden.</div>
        ) : (
          <table className="fb-table">
            <tbody>
              {members.map((m, i) => (
                <tr key={i}>
                  <td>{m.email}</td>
                  <td style={{ textAlign: "right", color: "var(--muted)" }}>{new Date(m.joined_at).toLocaleDateString("de-CH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="fb-card" style={{ marginBottom: 14 }}>
        <div className="fb-section-title" style={{ marginTop: 0 }}>Konto</div>
        <div className="fb-stat-sub" style={{ marginBottom: 10 }}>Angemeldet als {userEmail}</div>
        <form onSubmit={changePassword}>
          <div className="fb-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", marginBottom: 10 }}>
            <div className="fb-field" style={{ margin: 0 }}>
              <label className="fb-label">Neues Passwort</label>
              <input className="fb-input" type="password" minLength={6} value={pw1} onChange={(e) => setPw1(e.target.value)} />
            </div>
            <div className="fb-field" style={{ margin: 0 }}>
              <label className="fb-label">Wiederholen</label>
              <input className="fb-input" type="password" minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
          </div>
          {pwError && <div style={{ color: "var(--negative)", fontSize: 12.5, marginBottom: 10 }}>{pwError}</div>}
          {pwMsg && <div style={{ color: "var(--positive)", fontSize: 12.5, marginBottom: 10 }}>{pwMsg}</div>}
          <button className="fb-btn fb-btn-secondary" type="submit">Passwort ändern</button>
        </form>
      </div>

      <div className="fb-card" style={{ marginBottom: 14 }}>
        <div className="fb-section-title" style={{ marginTop: 0 }}>Daten</div>
        <button className="fb-btn fb-btn-secondary" onClick={exportCsv}><Download size={14} /> Ausgaben als CSV exportieren</button>
      </div>

      <div className="fb-card" style={{ marginBottom: 14 }}>
        <button className="fb-btn fb-btn-danger" onClick={onLogout}><LogOut size={14} /> Abmelden</button>
      </div>

      <div className="fb-card" style={{ borderColor: "var(--negative)" }}>
        <div className="fb-section-title" style={{ marginTop: 0, color: "var(--negative)" }}>Account löschen</div>
        <div className="fb-stat-sub" style={{ marginBottom: 12 }}>
          Löscht dein Konto endgültig. Falls du das letzte Mitglied dieser Familie bist, werden dabei auch das
          Jahresbudget und alle erfassten Ausgaben unwiderruflich gelöscht. Sind noch andere Familienmitglieder
          vorhanden, bleiben deren Daten erhalten — es wird nur dein eigenes Konto entfernt.
        </div>
        {deleteStep === 0 ? (
          <button className="fb-btn fb-btn-danger" onClick={() => setDeleteStep(1)}>Account löschen</button>
        ) : (
          <div>
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              Bist du sicher? Diese Aktion kann nicht rückgängig gemacht werden.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="fb-btn fb-btn-ghost" onClick={() => { setDeleteStep(0); setDeleteError(""); }} disabled={deleteLoading}>
                Abbrechen
              </button>
              <button className="fb-btn fb-btn-danger" onClick={handleDeleteAccount} disabled={deleteLoading}>
                {deleteLoading ? "Wird gelöscht…" : "Ja, endgültig löschen"}
              </button>
            </div>
            {deleteError && <div style={{ color: "var(--negative)", fontSize: 12.5, marginTop: 8 }}>{deleteError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== APP ============================== */

export default function BudgetApp({ householdName, inviteCode, userEmail, onLogout, syncVersion }) {
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [yearBudget, setYearBudget] = useState(null);
  const [prevYearBudget, setPrevYearBudget] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [persons, setPersons] = useState(DEFAULT_PERSONS);
  const [reminders, setReminders] = useState([]);
  const [view, setView] = useState({ name: "dashboard" });
  const [toast, setToast] = useState("");
  const [expenseModalConfig, setExpenseModalConfig] = useState(null);
  const legacyFixedRef = useRef(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  async function loadYearBudget(y) {
    let parsed = null;
    try {
      const r = await storage.get(`year-budget:${y}`);
      parsed = r ? JSON.parse(r.value) : null;
    } catch { parsed = null; }
    if (!parsed) return createDefaultYearBudget(y);
    const withLegacyFixed = migrateLegacyFixed(parsed, legacyFixedRef.current);
    return normalizeYearBudget(withLegacyFixed);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);

      try {
        const r = await storage.get("fixed-costs");
        legacyFixedRef.current = r ? JSON.parse(r.value) : null;
      } catch { legacyFixedRef.current = null; }

      try {
        const list = await storage.list("year-budget:");
        let yrs = (list?.keys || [])
          .map((k) => parseInt(k.split(":")[1], 10))
          .filter((n) => !isNaN(n))
          .sort((a, b) => a - b);

        const curYear = new Date().getFullYear();
        if (!yrs.includes(curYear)) {
          const def = createDefaultYearBudget(curYear);
          await storage.set(`year-budget:${curYear}`, JSON.stringify(def));
          yrs = [...yrs, curYear].sort((a, b) => a - b);
        }
        setYears(yrs);
        setYear(curYear);
      } catch {
        const curYear = new Date().getFullYear();
        setYears([curYear]);
        setYear(curYear);
      }

      try {
        const exp = await listExpenses();
        setExpenses(exp);
      } catch {
        setExpenses([]);
      }

      try {
        const r = await storage.get("persons");
        const list = r ? JSON.parse(r.value) : DEFAULT_PERSONS;
        setPersons(Array.isArray(list) && list.length ? list : DEFAULT_PERSONS);
      } catch {
        setPersons(DEFAULT_PERSONS);
      }

      try {
        const r = await storage.get("reminders");
        setReminders(r ? JSON.parse(r.value) : []);
      } catch {
        setReminders([]);
      }

      setLoading(false);
    })();
    // Nur beim allerersten Mount: Jahres-Discovery inkl. Anlegen des aktuellen Jahres.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Läuft erneut, sobald ein anderes Familienmitglied Daten geändert hat (Realtime),
  // damit die Ausgabenliste und die Jahresliste aktuell bleiben — ohne die aktuell
  // gewählte Ansicht/Jahr des Nutzers zurückzusetzen.
  useEffect(() => {
    (async () => {
      try {
        const list = await storage.list("year-budget:");
        const yrs = (list?.keys || [])
          .map((k) => parseInt(k.split(":")[1], 10))
          .filter((n) => !isNaN(n))
          .sort((a, b) => a - b);
        if (yrs.length) setYears(yrs);
      } catch {}
      try {
        const exp = await listExpenses();
        setExpenses(exp);
      } catch {
        setExpenses([]);
      }
      try {
        const r = await storage.get("persons");
        const list = r ? JSON.parse(r.value) : DEFAULT_PERSONS;
        setPersons(Array.isArray(list) && list.length ? list : DEFAULT_PERSONS);
      } catch {
        setPersons(DEFAULT_PERSONS);
      }
      try {
        const r = await storage.get("reminders");
        setReminders(r ? JSON.parse(r.value) : []);
      } catch {
        setReminders([]);
      }
    })();
  }, [syncVersion]);

  useEffect(() => {
    if (!year) return;
    (async () => {
      const yb = await loadYearBudget(year);
      setYearBudget(yb);
      try {
        const rp = await storage.get(`year-budget:${year - 1}`);
        if (rp) {
          const prevParsed = migrateLegacyFixed(JSON.parse(rp.value), legacyFixedRef.current);
          setPrevYearBudget(normalizeYearBudget(prevParsed));
        } else {
          setPrevYearBudget(null);
        }
      } catch {
        setPrevYearBudget(null);
      }
    })();
  }, [year, syncVersion]);

  async function persistYearBudget(updated) {
    setYearBudget(updated);
    try {
      await storage.set(`year-budget:${updated.year}`, JSON.stringify(updated));
      showToast("Jahresbudget gespeichert");
    } catch { showToast("Speichern fehlgeschlagen"); }
  }

  async function addYear(newYear, baseDraft) {
    const nb = baseDraft ? cloneYearBudget(baseDraft, newYear) : createDefaultYearBudget(newYear);
    try {
      await storage.set(`year-budget:${newYear}`, JSON.stringify(nb));
      setYears((y) => Array.from(new Set([...y, newYear])).sort((a, b) => a - b));
      setYear(newYear);
      showToast(`Jahr ${newYear} erstellt`);
    } catch { showToast("Erstellen fehlgeschlagen"); }
  }

  async function persistPersons(updated) {
    const cleaned = updated.map((p) => p.trim()).filter(Boolean);
    const finalList = cleaned.length ? cleaned : DEFAULT_PERSONS;
    setPersons(finalList);
    try {
      await storage.set("persons", JSON.stringify(finalList));
      showToast("Familienmitglieder gespeichert");
    } catch { showToast("Speichern fehlgeschlagen"); }
  }

  async function persistReminders(updated) {
    setReminders(updated);
    try {
      await storage.set("reminders", JSON.stringify(updated));
      showToast("Erinnerung gespeichert");
    } catch { showToast("Speichern fehlgeschlagen"); }
  }

  async function addExpense(exp) {
    try {
      const inserted = await insertExpense(exp);
      setExpenses((prev) => [inserted, ...prev]);
      showToast("Ausgabe erfasst");
    } catch { showToast("Speichern fehlgeschlagen"); }
  }

  async function deleteExpense(id) {
    const prevExpenses = expenses;
    setExpenses((cur) => cur.filter((e) => e.id !== id));
    try {
      await removeExpense(id);
    } catch {
      setExpenses(prevExpenses);
      showToast("Löschen fehlgeschlagen");
    }
  }

  function openExpenseModal(cfg) {
    setExpenseModalConfig({
      catId: cfg.catId,
      position: cfg.position,
      lockCategory: !!cfg.lockCategory,
      lockPosition: !!cfg.lockPosition,
    });
  }

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: Home },
    { key: "categories", label: "Positionen", icon: LayoutGrid },
    { key: "yearBudget", label: "Jahresbudget", icon: CalendarDays },
    { key: "reminders", label: "Erinnerungen", icon: Bell },
    { key: "settings", label: "Profil", icon: SettingsIcon },
  ];
  const categoriesActive = ["categories", "categoryDetail", "billing"].includes(view.name);

  if (loading) {
    return (
      <div className="fb-root" style={{ alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div className="fb-subtitle">Family-Budget wird geladen…</div>
      </div>
    );
  }

  return (
    <div className="fb-root">
      <style>{CSS}</style>

      <aside className="fb-sidebar">
        <div className="fb-sidebar-brand"><span className="dot" />Family-Budget</div>
        {navItems.map((n) => (
          <div key={n.key} className={`fb-nav-item ${(n.key === "categories" ? categoriesActive : view.name === n.key) ? "active" : ""}`}
            onClick={() => setView({ name: n.key })}>
            <n.icon size={16} /> {n.label}
          </div>
        ))}
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.12)" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{householdName || "Familie"}</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.6)", marginTop: 2, wordBreak: "break-all" }}>{userEmail}</div>
          <button className="fb-btn fb-btn-ghost fb-btn-sm" style={{ marginTop: 12, width: "100%", justifyContent: "center", color: "rgba(255,255,255,.75)", borderColor: "rgba(255,255,255,.25)" }} onClick={onLogout}>
            Abmelden
          </button>
        </div>
      </aside>

      <main className="fb-main">
        {view.name === "dashboard" && (
          <Dashboard yearBudget={yearBudget} expenses={expenses} year={year} month={month}
            setMonth={setMonth} goCategories={() => setView({ name: "categories" })} openExpenseModal={openExpenseModal}
            reminders={reminders} openReminders={() => setView({ name: "reminders" })} />
        )}
        {view.name === "categories" && (
          <CategoriesOverview yearBudget={yearBudget} expenses={expenses} year={year} month={month}
            openDetails={(catId) => setView({ name: "categoryDetail", catId })}
            openBilling={(catId, position) => setView({ name: "billing", catId, position })} />
        )}
        {view.name === "categoryDetail" && (
          <CategorySubthemes catId={view.catId} yearBudget={yearBudget} expenses={expenses} year={year} month={month}
            openBilling={(catId, position) => setView({ name: "billing", catId, position })}
            goBack={() => setView({ name: "categories" })} />
        )}
        {view.name === "billing" && (
          <Billing catId={view.catId} position={view.position} yearBudget={yearBudget} expenses={expenses} deleteExpense={deleteExpense}
            openExpenseModal={openExpenseModal}
            goBack={() => (view.position
              ? setView({ name: "categoryDetail", catId: view.catId })
              : setView({ name: "categories" }))} />
        )}
        {view.name === "yearBudget" && (
          <YearBudgetPage yearBudget={yearBudget} prevYearBudget={prevYearBudget} years={years} year={year} setYear={setYear}
            persistYearBudget={persistYearBudget} addYear={addYear} persons={persons} />
        )}
        {view.name === "reminders" && (
          <RemindersPage reminders={reminders} persistReminders={persistReminders} />
        )}
        {view.name === "settings" && (
          <SettingsPage householdName={householdName} inviteCode={inviteCode} userEmail={userEmail}
            persons={persons} persistPersons={persistPersons} expenses={expenses} yearBudget={yearBudget} onLogout={onLogout} />
        )}
      </main>

      <nav className="fb-mobile-nav">
        {navItems.map((n) => (
          <div key={n.key} className={`fb-mobile-nav-item ${(n.key === "categories" ? categoriesActive : view.name === n.key) ? "active" : ""}`}
            onClick={() => setView({ name: n.key })}>
            <n.icon size={18} /> {n.label}
          </div>
        ))}
      </nav>

      {expenseModalConfig && (
        <ExpenseModal
          yearBudget={yearBudget}
          persons={persons}
          defaultCategoryId={expenseModalConfig.catId}
          defaultPosition={expenseModalConfig.position}
          lockCategory={expenseModalConfig.lockCategory}
          lockPosition={expenseModalConfig.lockPosition}
          onClose={() => setExpenseModalConfig(null)}
          onSave={(exp) => { addExpense(exp); setExpenseModalConfig(null); }}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
