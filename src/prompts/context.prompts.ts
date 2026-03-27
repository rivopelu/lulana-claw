/** Markdown header for the auto-generated global knowledge context document */
export const AUTO_GLOBAL_CONTEXT_HEADER =
  "# Pengetahuan Global Luna (Auto-Generated)\n\nBerikut adalah pengetahuan penting yang dikumpulkan secara otomatis dari percakapan Luna.";

/** Name of the auto-generated global context document */
export const AUTO_GLOBAL_CONTEXT_NAME = "auto:global";

/** Prefix pattern for auto-generated session contexts */
export const AUTO_SESSION_CONTEXT_PREFIX = "auto:";

/** Name of the platform capabilities context seeded at startup */
export const PLATFORM_CAPABILITIES_CONTEXT_NAME = "Luna Platform Capabilities";

/** Content describing Luna's social media publishing capabilities */
export const LUNA_PLATFORM_CAPABILITIES = `Luna memiliki kemampuan untuk membuat dan mempublikasikan konten ke platform media sosial berikut:

**Instagram**
- Luna dapat membuat draft konten Instagram (tema, mood, visual concept, caption, hashtag)
- Luna dapat memposting foto dan video ke Instagram Business Account
- Konten dijadwalkan melalui dashboard Content Studio

**Threads**
- Luna dapat memposting teks, foto, dan video ke Threads
- Threads menggunakan access token terpisah dari Instagram
- Postingan teks dapat dilakukan tanpa media/gambar

**Alur Kerja Konten:**
1. Luna generate draft konten otomatis setiap hari atau saat diminta
2. Pemilik/admin review dan approve draft di dashboard
3. Setelah di-approve, konten diposting ke Instagram dan/atau Threads
4. Luna juga bisa langsung posting saat approve dengan opsi "Post Sekarang"

**Media Gallery:**
- Luna memiliki galeri media (foto/video) yang bisa digunakan untuk konten
- Semua media tersimpan di Supabase Storage dan dapat diakses kapan saja`;

/**
 * Build a timestamped knowledge entry appended to the auto-global context.
 * @param timestamp - Human-readable timestamp string (e.g. from toLocaleString)
 * @param knowledge - The knowledge content to append
 */
export function buildGlobalContextEntry(timestamp: string, knowledge: string): string {
  return `\n\n---\n*Diperbarui: ${timestamp}*\n${knowledge}`;
}

/**
 * Build the markdown file content for a context stored on disk.
 * @param name - Context name
 * @param type - Context type (global/client/session)
 * @param category - Context category
 * @param content - The actual context content
 */
export function buildContextFileContent(
  name: string,
  type: string,
  category: string,
  content: string,
): string {
  return `# ${name}\n\n**Type**: ${type}\n**Category**: ${category}\n\n${content}`;
}
