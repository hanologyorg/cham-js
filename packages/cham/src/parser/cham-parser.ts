// ─── CHAM Document Parser ──────────────────────────────────────
// The ChamParser class orchestrates the parsing of a CHAM document:
// frontmatter → text blocks + markers → annotation sections.
// Also handles parsing a complete piece (primary + secondary files).

import type {
  ChamDocument, ChamPart, ChamMeta, PrimaryMeta, BookConfig,
} from '../types.js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { ChamParseError, splitFrontmatter, buildMeta } from './frontmatter-parser.js'
import { buildTextBlocksAndMarkers, splitBodyAndAnnotations } from './text-parser.js'
import { parseAnnotationSections } from './annotation-parser.js'
import { parseYaml as parseYamlSimple } from '../yaml.js'

/**
 * CHAM document parser.
 *
 * Use {@link ChamParser.parse} for a single source string (primary or secondary).
 * Use {@link ChamParser.parsePiece} for a complete piece directory
 * (reads text.cham.md + all secondary files).
 */
export class ChamParser {
  /**
   * Parses a single CHAM document source string.
   * Handles both primary and secondary documents based on frontmatter.
   */
  parse(source: string): ChamDocument {
    const { meta: metaStr, body } = splitFrontmatter(source)
    const raw = parseYamlSimple(metaStr)
    const meta: ChamMeta = buildMeta(raw)

    const { textBody, annotationBody, bodyLineOffset } = splitBodyAndAnnotations(body)
    const { textBlocks, markers, textSections } = buildTextBlocksAndMarkers(textBody, bodyLineOffset)
    const sections = parseAnnotationSections(annotationBody)

    return { meta, textBlocks, markers, textSections, sections }
  }

  /**
   * Parses a complete piece directory: primary text + all secondary files.
   *
   * - Reads `text.cham.md` as the primary document.
   * - Reads all other `*.cham.md` as secondary documents (annotation layers).
   * - Reads `part-*.cham.md` as part documents.
   * - Validates that secondary marker references exist in the primary.
   * - Merges secondary sections into the primary document.
   * - Applies book config defaults when piece-level fields are missing.
   */
  parsePiece(pieceDir: string, bookConfig?: BookConfig): ChamDocument {
    const chamPath = join(pieceDir, 'text.cham.md')
    if (!existsSync(chamPath)) throw new ChamParseError(`Missing text.cham.md in ${pieceDir}`)

    const primary = this.parse(readFileSync(chamPath, 'utf-8'))
    if (primary.meta.type !== 'primary') {
      throw new ChamParseError(`Expected primary frontmatter type in ${chamPath}`)
    }

    const mergedSections = [...primary.sections]

    for (const f of readdirSync(pieceDir).sort()) {
      if (!f.endsWith('.cham.md') || f === 'text.cham.md') continue
      const filePath = join(pieceDir, f)
      const src = readFileSync(filePath, 'utf-8')
      const sub = this.parse(src)

      if (sub.meta.type !== 'secondary') continue

      for (const entry of sub.sections.flatMap(s => s.entries)) {
        if (entry.target.type === 'marker' && !primary.markers.has(entry.target.markerId)) {
          throw new ChamParseError(
            `Subordinate ${f} references marker {${entry.target.markerId}} not in primary text`,
          )
        }
      }

      mergedSections.push(...sub.sections)
    }

    // Merge book-level defaults into the primary meta without mutating
    // the originally-parsed `primary.meta`. The merged meta is used only
    // for the returned document; callers that still hold `primary` see
    // the unmodified snapshot.
    const mergedMeta: PrimaryMeta = bookConfig
      ? applyBookDefaults(primary.meta, bookConfig)
      : primary.meta

    // Discover and parse part files
    const parts = this.parseParts(pieceDir, primary.meta.id as number)

    return {
      ...primary,
      meta: mergedMeta,
      sections: mergedSections,
      textSections: primary.textSections,
      ...(parts.length ? { parts } : {}),
    }
  }

  /**
   * Parses all `part-*.cham.md` files in a piece directory.
   * Returns parts sorted by part number.
   */
  private parseParts(pieceDir: string, _pieceId: number): ChamPart[] {
    const parts: ChamPart[] = []
    for (const f of readdirSync(pieceDir).sort()) {
      if (!f.startsWith('part-') || !f.endsWith('.cham.md')) continue
      const partDoc = this.parse(readFileSync(join(pieceDir, f), 'utf-8'))
      if (partDoc.meta.type !== 'part') continue
      parts.push(partDoc as ChamPart)
    }
    parts.sort((a, b) => a.meta.part - b.meta.part)
    return parts
  }
}

/**
 * Convenience function: parse a CHAM source string.
 * Equivalent to `new ChamParser().parse(source)`.
 */
export function parse(source: string): ChamDocument {
  return new ChamParser().parse(source)
}

/**
 * Returns a new PrimaryMeta with book-level defaults applied for any
 * fields the primary meta leaves unset. The input meta is not modified.
 */
function applyBookDefaults(meta: PrimaryMeta, bookConfig: BookConfig): PrimaryMeta {
  const contributors = meta.contributors?.length
    ? meta.contributors
    : bookConfig.contributors?.length
      ? bookConfig.contributors
      : undefined
  const genre = meta.genre ?? bookConfig.genre
  const date = meta.date ?? bookConfig.date
  return {
    ...meta,
    ...(contributors ? { contributors } : {}),
    ...(genre ? { genre } : {}),
    ...(date ? { date } : {}),
  }
}
