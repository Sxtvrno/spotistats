export type AiPlaylistPlan = {
  name: string;
  description?: string;
  queries: string[];
};

function parseJsonPlan(text: string): AiPlaylistPlan {
  try {
    return JSON.parse(text);
  } catch {}
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (block) return JSON.parse(block[1].trim());
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }
  throw new Error("La IA no devolvió JSON válido.");
}

export async function generatePlaylistPlan(
  prompt: string
): Promise<AiPlaylistPlan> {
  // Modo prueba: sin IA externa
  const testMode = import.meta.env.VITE_AI_TEST_MODE === "1";
  if (testMode) {
    return {
      name: "Synthwave Night Drive",
      description: "Playlist generada en modo prueba.",
      queries: [
        "Kavinsky - Nightcall",
        "The Midnight - Sunset",
        "FM-84 - Running in the Night",
        "Timecop1983 - Back to You",
        "Gunship - Tech Noir",
      ],
    };
  }

  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  const model =
    (import.meta.env.VITE_DEEPSEEK_MODEL as string) || "deepseek-chat";
  if (!apiKey)
    throw new Error("Configura VITE_DEEPSEEK_API_KEY para usar DeepSeek.");

  const messages = [
    {
      role: "system",
      content:
        "Eres un generador de playlists. Devuelve SOLO JSON con claves: name (string), description (string), queries (array de strings, mínimo 30 elementos). No añadas texto fuera del JSON.",
    },
    {
      role: "user",
      content:
        `Genera un plan de playlist basado en este prompt.\n` +
        `Las queries deben ser términos de búsqueda de canciones (por ejemplo "Artist - Track" o "Track Artist").\n` +
        `Incluye al menos 30 queries para maximizar coincidencias.\n\n` +
        `Prompt: ${prompt}`,
    },
  ];

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    let msg = `Fallo IA (HTTP ${res.status}).`;
    try {
      const j = await res.json();
      msg = j?.error?.message || msg;
    } catch {
      const t = await res.text();
      if (t) msg = `${msg} ${t}`;
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("La IA no devolvió contenido.");

  const parsed = parseJsonPlan(text);
  if (!parsed?.name || !Array.isArray(parsed?.queries)) {
    throw new Error("Respuesta IA inválida: falta name/queries.");
  }
  return {
    name: String(parsed.name).slice(0, 80),
    description: (parsed.description ?? "").slice(0, 300),
    queries: parsed.queries.map(String).filter(Boolean).slice(0, 25),
  };
}
