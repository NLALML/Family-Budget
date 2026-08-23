import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase-Umgebungsvariablen fehlen (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). " +
      "Siehe README.md für die Einrichtung."
  );
}

export const supabase = createClient(url, anonKey);
