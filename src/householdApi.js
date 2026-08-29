import { supabase } from "./supabaseClient.js";
import { getHouseholdId } from "./storage.js";

export async function updateHouseholdName(name) {
  const householdId = getHouseholdId();
  if (!householdId) throw new Error("Kein Haushalt ausgewählt.");
  const { error } = await supabase.from("households").update({ name }).eq("id", householdId);
  if (error) throw error;
}

export async function regenerateInviteCode() {
  const { data, error } = await supabase.rpc("regenerate_invite_code");
  if (error) throw error;
  return data;
}

export async function listMembers() {
  const householdId = getHouseholdId();
  if (!householdId) return [];
  const { data, error } = await supabase
    .from("household_members")
    .select("email, joined_at")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
