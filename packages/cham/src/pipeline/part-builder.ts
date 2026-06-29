// ─── Part Builder ──────────────────────────────────────────────
// Builds OutputPart from a ChamPart (a part-document within a piece).

import type { ChamPart, OutputPart } from '../types.js'
import {
  buildPartAnnotations, buildAnnotationsText,
} from './annotation-builder.js'

/**
 * Builds an OutputPart from a parsed part document.
 * Includes verses, annotations (with `pieceId.partNum-N` IDs), and rendered
 * annotation text suitable for display.
 */
export function buildPartOutput(partDoc: ChamPart, pieceId: number): OutputPart {
  const verses = partDoc.textBlocks.map(b => ({ text: b.text }))
  const partNum = partDoc.meta.part
  const annotations = buildPartAnnotations(partDoc, pieceId)

  return {
    num: partNum,
    ...(partDoc.meta.group ? { group: partDoc.meta.group } : {}),
    ...(partDoc.meta.title ? { title: partDoc.meta.title } : {}),
    ...(partDoc.meta.source ? { source: partDoc.meta.source } : {}),
    verses,
    annotations,
    annotationText: buildAnnotationsText(partDoc, annotations) || undefined,
  }
}
