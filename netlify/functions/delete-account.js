// Löscht den Account des aufrufenden Nutzers. Läuft serverseitig mit dem
// Supabase Service-Role-Key (nie im Browser), da das Löschen eines Auth-Users
// Admin-Rechte braucht, die der öffentliche anon-Key bewusst nicht hat.
//
// Ablauf:
// 1. Access-Token aus dem Authorization-Header prüfen -> ergibt die User-ID.
// 2. Falls der Nutzer das letzte Mitglied seines Haushalts ist: den ganzen
//    Haushalt löschen (kaskadiert automatisch zu app_data/expenses/members).
//    Sind noch andere Mitglieder da, bleibt der Haushalt für sie erhalten.
// 3. Den Auth-User selbst löschen.

import { createClient } from "@supabase/supabase-js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server nicht korrekt konfiguriert (SUPABASE_SERVICE_ROLE_KEY fehlt)." }),
    };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: "Nicht angemeldet." }) };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: "Ungültige oder abgelaufene Sitzung." }) };
    }
    const userId = userData.user.id;

    const { data: membership } = await admin
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (membership?.household_id) {
      const { count } = await admin
        .from("household_members")
        .select("*", { count: "exact", head: true })
        .eq("household_id", membership.household_id);
      if (count === 1) {
        await admin.from("households").delete().eq("id", membership.household_id);
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) };
  }
}
