// ─── Annotation Builder ────────────────────────────────────────
// Converts parsed AnnotationEntries into OutputAnnotations suitable
// for the rendering pipeline.

import type {
  ChamDocument, ChamPart, AnnotationEntry,
  OutputAnnotation, PrimaryMeta,
} from '../types.js'
import { entryToRange } from './range-builder.js'
import { AnnotationKindRegistry } from '../model.js'

const KIND_REGISTRY = AnnotationKindRegistry.DEFAULT

/** Default mapping from CHAM kind to output kind. */
export function mapKind(kind: string): string {
  return KIND_REGISTRY.mapToOutput(kind)
}

/**
 * Builds output annotations from a primary document's own annotation sections.
 * Annotation IDs are `${pieceId}-${n}`.
 *
 * Section-level `@contributor` is propagated to each annotation.
 */
export function buildAnnotations(doc: ChamDocument, pieceId: number): OutputAnnotation[] {
  const annotations: OutputAnnotation[] = []
  let annId = 1
  for (const section of doc.sections) {
    const contributor = section.meta.contributor
    for (const entry of section.entries) {
      const range = entryToRange(entry, doc)
      if (!range) continue
      annotations.push(makeAnnotation(`${pieceId}-${annId++}`, entry, range, contributor, true))
    }
  }
  return annotations
}

/**
 * Builds output annotations from a secondary (commentary) layer document.
 * Targets are resolved against the PRIMARY document, not the layer itself.
 * Annotation IDs are `${layerId}-${n}`.
 *
 * Contributor priority: section.meta.contributor → file-level contributor.
 */
export function buildAnnotationsFromLayer(
  layerDoc: ChamDocument,
  primaryDoc: ChamDocument,
  layerId: string,
): OutputAnnotation[] {
  const annotations: OutputAnnotation[] = []
  let annId = 1
  const fileContributor = layerDoc.meta.type === 'secondary' ? layerDoc.meta.contributor : undefined
  for (const section of layerDoc.sections) {
    const contributor = section.meta.contributor ?? fileContributor
    for (const entry of section.entries) {
      const range = entryToRange(entry, primaryDoc)
      if (!range) continue
      annotations.push(makeAnnotation(`${layerId}-${annId++}`, entry, range, contributor, false))
    }
  }
  return annotations
}

/**
 * Builds output annotations for a part document.
 * Annotation IDs are `${pieceId}.${partNum}-${n}`.
 */
export function buildPartAnnotations(
  partDoc: ChamPart,
  pieceId: number,
): OutputAnnotation[] {
  const partNum = partDoc.meta.part
  const annotations: OutputAnnotation[] = []
  let annId = 1
  for (const section of partDoc.sections) {
    const contributor = section.meta.contributor
    for (const entry of section.entries) {
      const range = entryToRange(entry, partDoc)
      if (!range) continue
      annotations.push(makeAnnotation(`${pieceId}.${partNum}-${annId++}`, entry, range, contributor, true))
    }
  }
  return annotations
}

/**
 * Constructs a single OutputAnnotation from components.
 * `trim` controls whether the value is trimmed (primary/part) or not (layer).
 */
function makeAnnotation(
  id: string,
  entry: AnnotationEntry,
  range: ReturnType<typeof entryToRange> & {},
  contributor: string | undefined,
  trim: boolean,
): OutputAnnotation {
  return {
    id,
    range: range!,
    kind: mapKind(entry.kind),
    ...(entry.params.lang ? { lang: entry.params.lang } : {}),
    text: trim ? entry.value.trim() : entry.value,
    source: 'cham',
    ...(contributor ? { contributor } : {}),
  }
}

// ─── Headword Extraction ───────────────────────────────────────

/**
 * Extracts the headword (annotated text) from a document for a given annotation.
 * Returns the title slice for title-scope annotations, or the verse text slice.
 */
export function getHeadword(doc: ChamDocument, ann: OutputAnnotation): string {
  if (ann.range.scope === 'title') {
    return (doc.meta as PrimaryMeta).title.slice(ann.range.start, ann.range.end)
  }
  if (ann.range.scope === 'verse' && ann.range.verseIndex !== undefined) {
    const block = doc.textBlocks[ann.range.verseIndex]
    if (block) return block.text.slice(ann.range.start, ann.range.end)
  }
  return ''
}

// ─── Annotation Text Rendering ─────────────────────────────────

/**
 * Renders a plain-text annotations summary suitable for display under each verse.
 * Groups by position; prefixes pronunciation annotations with ○普 or ○粵.
 */
export function buildAnnotationsText(
  doc: ChamDocument,
  annotations: OutputAnnotation[],
): string {
  if (!annotations.length) return ''

  const groups = new Map<string, { headword: string; pron: OutputAnnotation[]; meaning: OutputAnnotation[] }>()
  for (const ann of annotations) {
    const key = `${ann.range.scope}:${ann.range.verseIndex ?? ''}:${ann.range.start}:${ann.range.end}`
    if (!groups.has(key)) {
      groups.set(key, { headword: getHeadword(doc, ann), pron: [], meaning: [] })
    }
    const g = groups.get(key)!
    if (ann.kind === 'pronunciation') g.pron.push(ann)
    else g.meaning.push(ann)
  }

  const lines: string[] = []
  let num = 1
  for (const [, g] of groups) {
    const parts: string[] = []
    if (g.pron.length) {
      const pronParts = g.pron.map(a => {
        const lang = a.lang === 'yue' ? '粵' : '普'
        return `○${lang}${a.text}`
      })
      parts.push(pronParts.join('；'))
    }
    for (const m of g.meaning) {
      parts.push(m.text)
    }
    lines.push(`${num}.${g.headword}：${parts.join('。')}`)
    num++
  }

  return lines.join('\n')
}
