import { supabase } from "./supabaseClient.js";

export async function deleteOwnAccount() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Nicht angemeldet.");

  const response = await fetch("/.netlify/functions/delete-account", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Account konnte nicht gelöscht werden.");
  }
  return true;
}
