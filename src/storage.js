// Ersetzt die vorherige localStorage-Version 1:1 in der API (get/set/delete/list),
// speichert die Daten aber in Supabase (Tabelle app_data), gescoped auf den
// aktuell eingeloggten Haushalt. Dadurch sehen alle Mitglieder desselben
// Haushalts dieselben Daten — und über subscribeRemoteChanges() live Updates,
// wenn ein anderes Familienmitglied etwas ändert.

import { supabase } from "./supabaseClient.js";

let householdId = null;

export function setHouseholdId(id) {
  householdId = id;
}

export function getHouseholdId() {
  return householdId;
}

// Abonniert Änderungen an app_data UND expenses für den aktuellen Haushalt.
// Ruft `callback` bei jedem Insert/Update/Delete auf (auch durch die eigene
// Session ausgelöste, das ist bewusst einfach gehalten). Gibt eine
// Unsubscribe-Funktion zurück.
export function subscribeRemoteChanges(callback) {
  if (!householdId) return () => {};
  const channel = supabase
    .channel(`household_${householdId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_data", filter: `household_id=eq.${householdId}` },
      () => callback && callback()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "expenses", filter: `household_id=eq.${householdId}` },
      () => callback && callback()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "households", filter: `id=eq.${householdId}` },
      () => callback && callback()
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

function requireHousehold() {
  if (!householdId) throw new Error("Kein Haushalt ausgewählt.");
}

export const storage = {
  // value wird als bereits JSON.stringify'ter String übergeben (wie beim
  // vorherigen window.storage) und hier als jsonb gespeichert.
  async get(key) {
    requireHousehold();
    const { data, error } = await supabase
      .from("app_data")
      .select("value")
      .eq("household_id", householdId)
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Kein Wert für Schlüssel "${key}" gefunden`);
    return { key, value: JSON.stringify(data.value) };
  },

  async set(key, value) {
    requireHousehold();
    const { error } = await supabase.from("app_data").upsert(
      {
        household_id: householdId,
        key,
        value: JSON.parse(value),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "household_id,key" }
    );
    if (error) throw error;
    return { key, value };
  },

  async delete(key) {
    requireHousehold();
    const { error } = await supabase.from("app_data").delete().eq("household_id", householdId).eq("key", key);
    if (error) throw error;
    return { key, deleted: true };
  },

  async list(prefix = "") {
    requireHousehold();
    let query = supabase.from("app_data").select("key").eq("household_id", householdId);
    if (prefix) query = query.like("key", `${prefix}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { keys: (data || []).map((r) => r.key) };
  },
};
