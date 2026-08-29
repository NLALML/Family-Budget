# Family-Budget

Familien-Budget-App (React + Vite) mit Login, geteiltem Haushalt (Supabase),
Dashboard, Jahresbudget/Fixkosten und Beleg-Erfassung per Foto.

## Wie das Teilen funktioniert

- Jede Person registriert sich mit E-Mail + Passwort.
- Die erste Person erstellt eine **Familie** (Haushalt) und bekommt einen
  **Einladungscode**.
- Alle weiteren Familienmitglieder treten mit diesem Code bei.
- Alle Mitglieder desselben Haushalts sehen dieselben Daten (Jahresbudget,
  Fixkosten, erfasste Ausgaben) — Änderungen werden per Supabase Realtime
  automatisch an alle offenen Geräte verteilt, ohne dass jemand neu laden
  muss.

## 1. Supabase-Projekt einrichten

1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt erstellen.
2. Im Dashboard unter **SQL Editor** den kompletten Inhalt von
   `supabase/schema.sql` einfügen und ausführen. Das legt alle Tabellen,
   Sicherheitsregeln (Row Level Security) und die Funktionen zum
   Erstellen/Beitreten einer Familie an und aktiviert Realtime.

   **Falls du bereits ein Supabase-Projekt für diese App eingerichtet hast:**
   Führe NICHT die komplette `schema.sql` erneut aus (das gibt Fehler wegen
   bereits existierender Policies). Führe stattdessen nur diesen Nachtrag im
   SQL Editor aus, um die Profil-Funktionen (Einladungscode neu generieren,
   Haushaltsname ändern) nachzurüsten:

   ```sql
   create policy "update own household" on households
     for update using (is_household_member(id));

   create or replace function regenerate_invite_code()
   returns text
   language plpgsql
   security definer
   set search_path = public
   as $$
   declare
     hid uuid;
     new_code text;
   begin
     select household_id into hid from household_members where user_id = auth.uid() limit 1;
     if hid is null then
       raise exception 'Kein Haushalt gefunden';
     end if;
     new_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
     update households set invite_code = new_code where id = hid;
     return new_code;
   end;
   $$;

   alter publication supabase_realtime add table households;
   ```
3. Unter **Authentication → Providers** ist E-Mail/Passwort standardmässig
   aktiv. Für den Start empfiehlt es sich, unter **Authentication → Settings**
   die E-Mail-Bestätigung testweise zu deaktivieren (sonst muss jede Person
   ihre Registrierungs-Mail bestätigen, bevor sie sich einloggen kann).
4. Unter **Project Settings → API** findest du `Project URL` und den
   `anon public` Key — die brauchst du im nächsten Schritt.

## 2. Lokale Entwicklung

```bash
cp .env.example .env
# .env mit deinen Supabase-Werten ausfüllen
npm install
npm run dev
```

Für die Foto-Beleg-Erkennung lokal zusätzlich (läuft über eine Netlify
Function):

```bash
npm install -g netlify-cli
netlify dev
```

## 3. Deployment auf Netlify

1. Projekt zu GitHub/GitLab/Bitbucket pushen (oder Ordner direkt per
   `netlify deploy` / Drag & Drop hochladen).
2. In Netlify ein neues Site aus dem Repo erstellen. Build-Einstellungen
   kommen automatisch aus `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
3. **Umgebungsvariablen setzen** (Site configuration → Environment variables):
   - `VITE_SUPABASE_URL` = deine Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = dein Supabase anon public Key
   - `SUPABASE_SERVICE_ROLE_KEY` = dein Supabase **service_role** Key (Project
     Settings → API → "service_role secret") — wird nur serverseitig für die
     Account-Löschung im Tab "Profil" gebraucht, landet nie im Browser.
     **Diesen Key niemals mit `VITE_`-Präfix versehen**, sonst würde er im
     Frontend-Code landen und öffentlich sichtbar sein.
   - `ANTHROPIC_API_KEY` = dein Anthropic API-Key (für die Foto-Beleg-Erkennung;
     ohne diesen funktioniert alles andere normal, nur die Foto-Erfassung
     zeigt einen Fehler)
4. Deploy auslösen.

Die `VITE_...`-Variablen werden beim Build in den Frontend-Code eingebettet
— das ist bei Supabase so vorgesehen, der `anon` Key ist bewusst öffentlich
und wird durch die Row-Level-Security-Regeln in `supabase/schema.sql`
abgesichert (nur Mitglieder eines Haushalts können dessen Daten lesen/
schreiben). Der `ANTHROPIC_API_KEY` und der `SUPABASE_SERVICE_ROLE_KEY`
dagegen bleiben serverseitig in den Netlify Functions und landen nie im
Browser.

## Datenmodell & Grenzen

- Erinnerungen (Tab "Erinnerungen") liegen wie Jahresbudget/Fixkosten im
  `app_data`-Speicher unter dem Schlüssel `reminders` und synchronisieren
  sich automatisch zwischen allen Familienmitgliedern.
- Jede neu registrierte Familie startet mit einem **leeren Budget** (alle
  Beträge 0) und **generischen Personennamen** ("Person 1", "Person 2") —
  diese lassen sich im Tab **"Profil"** umbenennen/ergänzen und werden dann
  bei "Einkäufer" und bei der Aufteilung von Fixkosten zur Auswahl angeboten.
- Im Tab **"Profil"** lässt sich zudem der Familienname ändern, ein neuer
  Einladungscode generiert werden (der alte wird dabei ungültig), alle
  Haushaltsmitglieder eingesehen, das eigene Passwort geändert, die
  Ausgaben als CSV exportiert und man kann sich abmelden.

- Jahresbudget und Fixkosten liegen weiterhin in `app_data` (Key-Value pro
  Haushalt, z. B. `year-budget:2026`).
- **Ausgaben liegen jetzt in einer eigenen Tabelle `expenses`** — eine Zeile
  pro erfasster Ausgabe, nicht mehr als gemeinsames JSON-Array. Dadurch
  können mehrere Familienmitglieder gleichzeitig Ausgaben erfassen oder
  löschen, ohne dass sich Schreibvorgänge gegenseitig überschreiben können —
  jeder Eintrag ist ein eigenständiger Insert/Delete.

## Beleg-Foto-Erkennung

`netlify/functions/scan-receipt.js` ruft serverseitig die Anthropic API auf.
Das verwendete Modell ist dort als `model: "claude-sonnet-5"` hinterlegt —
bei Bedarf anpassen.
