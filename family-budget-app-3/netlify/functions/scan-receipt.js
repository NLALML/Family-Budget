// Netlify Function: nimmt ein Beleg-Foto (Base64) entgegen, schickt es an die
// Anthropic API und gibt {datum, ort, betrag} zurück. Der API-Key bleibt
// serverseitig in der Umgebungsvariable ANTHROPIC_API_KEY (Netlify-Einstellungen
// -> Site configuration -> Environment variables) und wird nie an den Browser
// ausgeliefert.

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY ist nicht gesetzt (Netlify Umgebungsvariable fehlt)." }),
    };
  }

  let image, mediaType;
  try {
    const body = JSON.parse(event.body || "{}");
    image = body.image;
    mediaType = body.mediaType || "image/jpeg";
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Ungültiger Request-Body." }) };
  }

  if (!image) {
    return { statusCode: 400, body: JSON.stringify({ error: "Kein Bild übermittelt." }) };
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Passe das Modell bei Bedarf an das, was dein API-Key nutzen darf/soll.
        model: "claude-sonnet-5",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
              {
                type: "text",
                text: 'Das ist ein Kassenbeleg/eine Quittung. Antworte NUR mit einem JSON-Objekt, ohne Markdown, ohne weiteren Text, im Format {"datum":"YYYY-MM-DD oder null","ort":"Geschäftsname oder null","betrag":Zahl oder null}. Nimm den Gesamtbetrag (Total) des Belegs.',
              },
            ],
          },
        ],
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return {
        statusCode: anthropicRes.status,
        body: JSON.stringify({ error: data?.error?.message || "Anthropic API Fehler" }),
      };
    }

    const text = (data.content || []).map((b) => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = { datum: null, ort: null, betrag: null };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}
