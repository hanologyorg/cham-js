// ─── ePub Utilities ───────────────────────────────────────────
// Small string-manipulation helpers used by the XHTML parser and the
// annotation splitter. No domain knowledge — just text transforms.

import type { SkqsVariant } from '../types.js'

/** Decode XML/HTML entities in plain text. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/** Strip all HTML tags and decode entities. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ''))
}

/**
 * Extract the textual content from a CHAM-style `<small>` annotation
 * span, dropping the transparency-noisy spans and `<img alt>` markers
 * before stripping tags.
 */
export function extractAnnotationText(smallHtml: string): string {
  let text = smallHtml.replace(/<span style="color:transparent;font-size:0px">[〈〉]<\/span>/g, '')
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '$1')
  text = stripTags(text)
  return text.trim()
}

/** Pull `<img resource="./File:SKQSfont.pdf" alt=… src=…>` entries into SkqsVariant records. */
export function extractSkqsImages(html: string): SkqsVariant[] {
  const images: SkqsVariant[] = []
  const re = /<img[^>]*resource="\.\/File:SKQSfont\.pdf"[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    images.push({ imageFile: m[2], altText: m[1] })
  }
  return images
}

/** Escape regex metacharacters so a literal string can be safely embedded in a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Zero-pad an integer to 3 digits — used for piece directory names like 001_title. */
export function padNum(n: number): string {
  return String(n).padStart(3, '0')
}