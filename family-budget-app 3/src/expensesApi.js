// Ausgaben liegen als einzelne Zeilen in der Tabelle "expenses" (statt als
// ein gemeinsames JSON-Array im Key-Value-Speicher). Dadurch können mehrere
// Familienmitglieder gleichzeitig Ausgaben erfassen, ohne sich gegenseitig
// zu überschreiben — jede Ausgabe ist ein eigener Insert/Delete.

import { supabase } from "./supabaseClient.js";
import { getHouseholdId } from "./storage.js";

function rowToExpense(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    date: row.date,
    position: row.position,
    ort: row.ort,
    einkaeufer: row.einkaeufer,
    betrag: Number(row.betrag) || 0,
    receiptPath: row.receipt_path || null,
    receiptHash: row.receipt_hash || null,
  };
}

export async function listExpenses() {
  const householdId = getHouseholdId();
  if (!householdId) return [];
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("household_id", householdId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToExpense);
}

export async function insertExpense(exp) {
  const householdId = getHouseholdId();
  if (!householdId) throw new Error("Kein Haushalt ausgewählt.");
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      household_id: householdId,
      category_id: exp.categoryId,
      date: exp.date,
      position: exp.position,
      ort: exp.ort,
      einkaeufer: exp.einkaeufer,
      betrag: exp.betrag,
      receipt_path: exp.receiptPath || null,
      receipt_hash: exp.receiptHash || null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToExpense(data);
}

export async function updateExpenseRow(id, exp) {
  const householdId = getHouseholdId();
  if (!householdId) throw new Error("Kein Haushalt ausgewählt.");
  const { data, error } = await supabase
    .from("expenses")
    .update({
      category_id: exp.categoryId,
      date: exp.date,
      position: exp.position,
      ort: exp.ort,
      einkaeufer: exp.einkaeufer,
      betrag: exp.betrag,
      // Beleg-Felder nur ändern, wenn sie explizit mitgegeben werden
      ...(exp.receiptPath !== undefined ? { receipt_path: exp.receiptPath, receipt_hash: exp.receiptHash ?? null } : {}),
    })
    .eq("id", id)
    .eq("household_id", householdId)
    .select()
    .single();
  if (error) throw error;
  return rowToExpense(data);
}

export async function removeExpense(id) {
  const householdId = getHouseholdId();
  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("household_id", householdId);
  if (error) throw error;
}
