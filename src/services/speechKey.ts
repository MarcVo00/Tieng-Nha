/** Canonical form of a spoken text: NFC, trimmed. Must match `normalizeSpeechText` in scripts/tts. */
export function normalizeSpeechText(text: string): string {
  return text.normalize("NFC").trim();
}

/** First 16 hex chars of SHA-256 over the UTF-8 bytes of the normalised text (file name of a voice-pack MP3). */
export async function speechKey(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeSpeechText(text));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}
