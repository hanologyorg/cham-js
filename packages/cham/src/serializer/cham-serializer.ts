// ─── CHAM Document Serializer ──────────────────────────────────
// The ChamSerializer class orchestrates serialization of a ChamDocument:
// frontmatter → text blocks + markers → annotation sections.

import type { ChamDocument } from '../types.js'
import {
  serializeFrontmatter,
} from './frontmatter-serializer.js'
import { serializeTextBlocks } from './text-serializer.js'
import { serializeSection } from './annotation-serializer.js'

/**
 * CHAM document serializer.
 *
 * Use {@link ChamSerializer.serialize} to produce canonical CHAM markdown
 * from a ChamDocument. Round-trip safe: parse → serialize → parse yields
 * equivalent data.
 */
export class ChamSerializer {
  /**
   * Serializes a ChamDocument into a CHAM markdown string.
   * Output order: frontmatter → blank → text body → blank → annotation sections.
   */
  serialize(doc: ChamDocument): string {
    const parts: string[] = [serializeFrontmatter(doc.meta)]

    const textPart = serializeTextBlocks(doc.textBlocks, doc.markers, doc.textSections ?? [])
    if (textPart) parts.push(textPart)

    for (const section of doc.sections) {
      parts.push('')
      parts.push(serializeSection(section))
    }

    return parts.join('\n\n')
  }
}

/**
 * Convenience function: serialize a ChamDocument.
 * Equivalent to `new ChamSerializer().serialize(doc)`.
 */
export function serialize(doc: ChamDocument): string {
  return new ChamSerializer().serialize(doc)
}
