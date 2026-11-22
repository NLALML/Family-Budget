// Beleg-Dateien (Fotos/PDFs) liegen im privaten Supabase-Storage-Bucket
// "receipts", getrennt pro Haushalt: {household_id}/{zufällige-id}.{ext}
// Zusätzlich wird ein SHA-256-Hash der Originaldatei berechnet, um doppelt
// hochgeladene Belege zu erkennen.

import { supabase } from "./supabaseClient.js";
import { getHouseholdId } from "./storage.js";

const BUCKET = "receipts";

export async function hashFile(file) {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

// Verkleinert Fotos (max. 1600 px, JPEG) für schnelleres Hochladen/Laden.
// PDFs und nicht lesbare Formate bleiben unverändert.
export async function compressImage(file, maxSize = 1600, quality = 0.8) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], "beleg.jpg", { type: "image/jpeg" });
  } catch {
    return file; // z. B. HEIC ohne Browser-Support: Original hochladen
  }
}

export async function uploadReceipt(file) {
  const householdId = getHouseholdId();
  if (!householdId) throw new Error("Kein Haushalt ausgewählt.");
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/jpeg" ? "jpg" : (file.type.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "");
  const path = `${householdId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return path;
}

export async function removeReceiptFile(path) {
  if (!path) return;
  try { await supabase.storage.from(BUCKET).remove([path]); } catch {}
}

// Mehrere signierte URLs auf einmal (1 Stunde gültig) -> { path: url }
export async function getReceiptUrls(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, 3600);
  if (error) throw error;
  const out = {};
  (data || []).forEach((d) => { if (d.signedUrl) out[d.path] = d.signedUrl; });
  return out;
}
