/**
 * Client minimal de l'API Gemini (Google) : texte + images, réponse JSON structurée.
 * Appel REST direct (pas de SDK) : https://ai.google.dev/api/generate-content
 */
export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } }

export class GeminiClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  get modelName() {
    return this.model
  }

  /**
   * Demande une réponse JSON conforme à `schema`.
   * Réflexion minimale : beaucoup plus rapide (≈ 2 s) et suffisant pour lire une image.
   */
  async json<T>(parts: GeminiPart[], schema: Record<string, unknown>, timeoutMs = 20_000, thinking: 'minimal' | 'low' | 'medium' | 'high' = 'minimal'): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0,
            thinkingConfig: { thinkingLevel: thinking },
          },
        }),
      })
      const data = (await res.json()) as {
        error?: { message: string }
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      if (!res.ok || data.error) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      // Avec la réflexion activée, la réponse est la dernière partie texte
      const text = data.candidates?.[0]?.content?.parts?.filter((p) => p.text).at(-1)?.text
      if (!text) throw new Error('Réponse vide')
      return JSON.parse(text) as T
    } finally {
      clearTimeout(timer)
    }
  }
}
