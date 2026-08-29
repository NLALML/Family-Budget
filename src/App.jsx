import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import { setHouseholdId, subscribeRemoteChanges } from "./storage.js";
import BudgetApp from "./BudgetApp.jsx";

const CSS = `
.fb-auth-wrap{ min-height:100vh; display:flex; align-items:center; justify-content:center; padding:16px;
  font-family:'Inter',system-ui,sans-serif; background:#f7ead6; color:#4a2e1f; }
.fb-auth-card{ width:100%; max-width:380px; background:#fffaf3; border-radius:16px; padding:28px; border:1px solid #e6d6c1; }
.fb-auth-title{ font-family:Georgia,serif; font-size:24px; margin:0 0 4px; }
.fb-auth-sub{ color:#8a7360; font-size:13.5px; margin-bottom:20px; }
.fb-auth-field{ margin-bottom:14px; }
.fb-auth-label{ font-size:12px; color:#8a7360; display:block; margin-bottom:4px; }
.fb-auth-input{ width:100%; padding:9px 11px; border-radius:8px; border:1px solid #e6d6c1; font-size:14px; font-family:inherit; }
.fb-auth-btn{ width:100%; background:#d97a4f; color:#fff; border:none; border-radius:8px; padding:10px 0; font-weight:500; cursor:pointer; font-size:14px; }
.fb-auth-btn:disabled{ opacity:.6; cursor:default; }
.fb-auth-link{ margin-top:14px; background:none; border:none; color:#d97a4f; font-size:13px; cursor:pointer; display:block; }
.fb-auth-error{ color:#c14a3a; font-size:13px; margin-bottom:12px; }
.fb-auth-info{ color:#5c7a44; font-size:13px; margin-bottom:12px; }
.fb-auth-tabs{ display:flex; gap:6px; background:#f7ead6; padding:4px; border-radius:10px; margin-bottom:18px; }
.fb-auth-tab{ flex:1; padding:8px; border-radius:7px; border:none; cursor:pointer; background:transparent; font-size:13.5px; color:#8a7360; }
.fb-auth-tab.active{ background:#fffaf3; color:#4a2e1f; font-weight:500; }
`;

function Centered({ children }) {
  return (
    <div className="fb-auth-wrap">
      <style>{CSS}</style>
      <div className="fb-auth-card">{children}</div>
    </div>
  );
}

function LoadingScreen({ text }) {
  return (
    <Centered>
      <div style={{ textAlign: "center", color: "#8a7360", fontSize: 14 }}>{text}</div>
    </Centered>
  );
}

function AuthForm() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Konto erstellt. Falls eine Bestätigungs-E-Mail nötig ist, prüfe dein Postfach — danach einfach anmelden.");
        setMode("login");
      }
    } catch (err) {
      setError(err.message || "Fehler bei der Anmeldung.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Centered>
      <h1 className="fb-auth-title">Family-Budget</h1>
      <p className="fb-auth-sub">Melde dich an oder erstelle ein Konto für deine Familie.</p>

      <div className="fb-auth-tabs">
        <button type="button" className={`fb-auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setError(""); setInfo(""); }}>Anmelden</button>
        <button type="button" className={`fb-auth-tab ${mode === "signup" ? "active" : ""}`} onClick={() => { setMode("signup"); setError(""); setInfo(""); }}>Registrieren</button>
      </div>

      <form onSubmit={submit}>
        <div className="fb-auth-field">
          <label className="fb-auth-label">E-Mail</label>
          <input className="fb-auth-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="fb-auth-field">
          <label className="fb-auth-label">Passwort</label>
          <input className="fb-auth-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="fb-auth-error">{error}</div>}
        {info && <div className="fb-auth-info">{info}</div>}
        <button className="fb-auth-btn" type="submit" disabled={loading}>
          {loading ? "Bitte warten…" : mode === "login" ? "Anmelden" : "Konto erstellen"}
        </button>
      </form>
    </Centered>
  );
}

function HouseholdSetup({ onReady }) {
  const [mode, setMode] = useState("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "create") {
        const { data, error } = await supabase.rpc("create_household", { household_name: name });
        if (error) throw error;
        onReady(data);
      } else {
        const { data, error } = await supabase.rpc("join_household", { code: code.trim() });
        if (error) throw error;
        onReady(data);
      }
    } catch (err) {
      setError(err.message || "Fehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Centered>
      <h1 className="fb-auth-title" style={{ fontSize: 22 }}>Familie einrichten</h1>
      <p className="fb-auth-sub">Erstelle eine neue Familie oder tritt mit einem Einladungscode einer bestehenden bei.</p>

      <div className="fb-auth-tabs">
        <button type="button" className={`fb-auth-tab ${mode === "create" ? "active" : ""}`} onClick={() => { setMode("create"); setError(""); }}>Neu erstellen</button>
        <button type="button" className={`fb-auth-tab ${mode === "join" ? "active" : ""}`} onClick={() => { setMode("join"); setError(""); }}>Code beitreten</button>
      </div>

      <form onSubmit={submit}>
        {mode === "create" ? (
          <div className="fb-auth-field">
            <label className="fb-auth-label">Familienname</label>
            <input className="fb-auth-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Familie Lüthi" />
          </div>
        ) : (
          <div className="fb-auth-field">
            <label className="fb-auth-label">Einladungscode</label>
            <input className="fb-auth-input" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="z. B. a1b2c3d4" />
          </div>
        )}
        {error && <div className="fb-auth-error">{error}</div>}
        <button className="fb-auth-btn" type="submit" disabled={loading}>
          {loading ? "Bitte warten…" : mode === "create" ? "Familie erstellen" : "Beitreten"}
        </button>
      </form>
    </Centered>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined=lädt, null=nicht eingeloggt
  const [householdId, setHouseholdIdState] = useState(undefined); // undefined=lädt, null=keiner
  const [householdDetails, setHouseholdDetails] = useState(null);
  const [syncVersion, setSyncVersion] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (!sess) {
        setHouseholdIdState(undefined);
        setHouseholdDetails(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setHouseholdIdState(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setHouseholdIdState(data?.household_id || null);
    })();
  }, [session]);

  useEffect(() => {
    if (!householdId) {
      setHouseholdDetails(null);
      return;
    }
    (async () => {
      const { data } = await supabase.from("households").select("name, invite_code").eq("id", householdId).maybeSingle();
      setHouseholdDetails(data ? { name: data.name, inviteCode: data.invite_code } : null);
    })();
    // Läuft erneut, wenn sich Name/Einladungscode geändert haben (eigene Änderung oder Realtime).
  }, [householdId, syncVersion]);

  useEffect(() => {
    if (!householdId) return;
    setHouseholdId(householdId);
    const unsubscribe = subscribeRemoteChanges(() => setSyncVersion((v) => v + 1));
    return unsubscribe;
  }, [householdId]);

  if (session === undefined || (session && householdId === undefined)) {
    return <LoadingScreen text="Wird geladen…" />;
  }
  if (!session) return <AuthForm />;
  if (!householdId) return <HouseholdSetup onReady={(id) => setHouseholdIdState(id)} />;
  if (!householdDetails) return <LoadingScreen text="Familie wird geladen…" />;

  return (
    <BudgetApp
      householdName={householdDetails.name}
      inviteCode={householdDetails.inviteCode}
      userEmail={session.user.email}
      syncVersion={syncVersion}
      onLogout={() => supabase.auth.signOut()}
    />
  );
}
