export type AiPlaylistPlan = {
  name: string;
  description?: string;
  queries: string[];
};

export async function generatePlaylistPlan(
  prompt: string
): Promise<AiPlaylistPlan> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const model = import.meta.env.VITE_GEMINI_MODEL || "gemini-1.5-flash";

  if (!apiKey) {
    throw new Error("Configura VITE_GEMINI_API_KEY para usar Gemini.");
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `Genera un plan de playlist basado en este prompt.\n` +
              `Devuelve SOLO JSON con las claves: name (string), description (string), queries (array de strings).\n` +
              `Las queries deben ser términos de búsqueda de canciones (por ejemplo "Artist - Track" o "Track Artist").\n\n` +
              `Prompt: ${prompt}`,
          },
        ],
      },
    ],
    response_mime_type: "application/json",
    // Opcional: esquema para mayor robustez (si tu cuenta soporta schema)
    // response_schema: {
    //   type: "object",
    //   properties: {
    //     name: { type: "string" },
    //     description: { type: "string" },
    //     queries: { type: "array", items: { type: "string" } },
    //   },
    //   required: ["name", "queries"],
    // },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) throw new Error("Fallo al generar playlist con IA (Gemini).");

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let parsed: AiPlaylistPlan | null = null;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("La IA no devolvió JSON válido.");
  }

  if (!parsed?.name || !Array.isArray(parsed?.queries)) {
    throw new Error("Respuesta IA inválida: falta name/queries.");
  }

  // Sanitiza y limita tamaño
  return {
    name: String(parsed.name).slice(0, 80),
    description: (parsed.description ?? "").slice(0, 300),
    queries: parsed.queries.map(String).filter(Boolean).slice(0, 25),
  };
}
