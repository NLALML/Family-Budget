// Rein lokale, geräteweite Einstellung (localStorage) — nicht Teil der
// geteilten Haushaltsdaten. Jede Person stellt einmal auf ihrem eigenen
// Gerät ein, welcher Name aus der Familienliste "sie selbst" ist. Damit
// wird bei "Einkäufer" automatisch diese Person vorausgewählt.

const KEY = "family-budget:my-person-name";

export function getMyPersonName() {
  try {
    return window.localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setMyPersonName(name) {
  try {
    window.localStorage.setItem(KEY, name);
  } catch {
    // localStorage nicht verfügbar (z. B. privater Modus) — einfach ignorieren.
  }
}
