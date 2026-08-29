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
    })
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
