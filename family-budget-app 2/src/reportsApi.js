import { supabase } from "./supabaseClient.js";
import { getHouseholdId } from "./storage.js";

export async function listReports() {
  const householdId = getHouseholdId();
  if (!householdId) return [];
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("*")
    .eq("household_id", householdId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function markReportRead(id) {
  const { error } = await supabase.from("monthly_reports").update({ is_read: true }).eq("id", id);
  if (error) throw error;
}

export async function getReportDownloadUrl(path) {
  const { data, error } = await supabase.storage.from("monthly-reports").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
