// ─── Piece Builder ─────────────────────────────────────────────
// Builds a complete OutputPiece from a parsed primary document + layers + parts.

import type {
  BookConfig, AuthorRecord,
  OutputPiece, PieceContributor, PrimaryMeta,
  OutputPart,
} from '../types.js'
import { parse } from '../parser.js'
import { resolveDynastyLabel } from '../date-utils.js'
import type { ChamPart, ChamDocument } from '../types.js'
import {
  buildAnnotations, buildAnnotationsText,
} from './annotation-builder.js'
import { groupBlocksIntoVerses, remapAnnotationVerses } from './verse-grouper.js'
import {
  parseCommentaryLayers, buildAnnotationLayers,
} from './layer-builder.js'
import { parseProseSections } from './prose-parser.js'
import { buildPartOutput } from './part-builder.js'

/**
 * Builds an OutputPiece from a primary CHAM source and its companion files.
 *
 * Inputs:
 *   - chamSource: the primary text.cham.md content
 *   - proseFiles: Map<filename, content> for prose .md files
 *   - layerFiles: Map<filename, content> for secondary .cham.md files
 *   - partFiles: optional Map<filename, content> for part-*.cham.md files
 *
 * Returns null if `chamSource` is not a primary document.
 *
 * Output includes:
 *   - verses (grouped from text blocks via zero-width markers)
 *   - annotations (primary + layers, with verse-index remapping)
 *   - sections (prose + rendered annotation text)
 *   - annotationLayers (per book.yaml layer config)
 *   - parts (if any)
 */
export function buildPieceFromCham(
  chamSource: string,
  bookConfig: BookConfig,
  authors: Record<string, AuthorRecord>,
  bookId: string,
  proseFiles: ReadonlyMap<string, string>,
  layerFiles: ReadonlyMap<string, string>,
  partFiles?: ReadonlyMap<string, string>,
): OutputPiece | null {
  const doc = parse(chamSource)
  if (doc.meta.type !== 'primary') return null

  // After the type narrow above, doc.meta is PrimaryMeta — no cast needed.
  const pmeta = doc.meta
  const pieceId = typeof pmeta.id === 'number'
    ? pmeta.id
    : parseInt(String(pmeta.id), 10)
  if (!Number.isFinite(pieceId)) {
    throw new Error(`Piece "${pmeta.title}" has non-numeric id "${pmeta.id}" — pipeline requires numeric IDs`)
  }

  const { verses, blockToVerse, verseCharOffset } = groupBlocksIntoVerses(doc.textBlocks, doc.markers)
  const annotations = buildAnnotations(doc, pieceId)
  const remappedAnnotations = remapAnnotationVerses(annotations, blockToVerse, verseCharOffset)
  const annText = buildAnnotationsText(doc, remappedAnnotations)

  const { sections, structuredSections } = parseProseSections(proseFiles)
  if (annText) sections['annotations'] = annText

  const partDocs = parsePartDocs(partFiles)
  const contributors = resolveContributors(pmeta, bookConfig, authors)
  const authorId = contributors[0]?.id || ''
  const authorName = contributors[0]?.name || ''
  const date = pmeta.date || bookConfig.date
  const dynastyName = resolveDynastyLabel(authors[authorId]?.dynasty || date?.dynasty || '')
  const eraName = authors[authorId]?.era || date?.era || dynastyName

  // Build layers with remapped verse indices
  const layers = parseCommentaryLayers(layerFiles, doc)
  for (const layerId of Object.keys(layers)) {
    layers[layerId] = remapAnnotationVerses(layers[layerId], blockToVerse, verseCharOffset)
  }
  const annotationLayers = buildAnnotationLayers(layers, bookConfig)

  const parts = resolveParts(partDocs, doc, pieceId)

  return {
    bookId,
    num: pieceId,
    title: pmeta.title,
    author: authorName,
    authorId,
    ...(contributors.length > 1 ? { contributors } : {}),
    dynasty: dynastyName,
    era: eraName,
    eraCode: authors[authorId]?.eraCode,
    genre: pmeta.genre || bookConfig.genre || 'poetry',
    verses,
    sections,
    annotations: remappedAnnotations,
    ...(Object.keys(layers).length > 0 ? { layers } : {}),
    ...(annotationLayers.length > 0 ? { annotationLayers } : {}),
    ...(pmeta.source ? { source: pmeta.source } : {}),
    ...(structuredSections.length > 0 ? { structuredSections } : {}),
    ...(parts?.length ? { parts } : {}),
  }
}

/** Parses optional part files into ChamPart[]. */
function parsePartDocs(partFiles?: ReadonlyMap<string, string>): ChamPart[] {
  if (!partFiles) return []
  return [...partFiles.entries()]
    .map(([, src]) => {
      const d = parse(src)
      return d.meta.type === 'part' ? d as ChamPart : null
    })
    .filter(Boolean) as ChamPart[]
}

/** Resolves contributors from piece meta, falling back to book config. */
function resolveContributors(
  pmeta: PrimaryMeta,
  bookConfig: BookConfig,
  authors: Record<string, AuthorRecord>,
): PieceContributor[] {
  const rawContributors = pmeta.contributors?.length
    ? pmeta.contributors
    : bookConfig.contributors || []
  return rawContributors.map(c => ({
    id: c.ref,
    name: authors[c.ref]?.name || c.ref,
    role: c.role,
    ...(c.title ? { title: c.title } : {}),
  }))
}

/** Resolves parts from either parsed part docs or primary doc's parts. */
function resolveParts(
  partDocs: ChamPart[],
  doc: ChamDocument,
  pieceId: number,
): OutputPart[] | undefined {
  if (partDocs.length > 0) {
    return partDocs
      .sort((a, b) => a.meta.part - b.meta.part)
      .map(p => buildPartOutput(p, pieceId))
  }
  return doc.parts?.map(p => buildPartOutput(p, pieceId))
}
