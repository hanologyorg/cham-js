// ─── Annotation Layer Builder ──────────────────────────────────
// Parses commentary layer files and builds OutputAnnotationLayer[]
// by combining layer annotations with book.yaml layer configuration.

import type {
  BookConfig, ChamDocument,
  OutputAnnotation, OutputAnnotationLayer,
} from '../types.js'
import { parse } from '../parser.js'
import { buildAnnotationsFromLayer } from './annotation-builder.js'

/**
 * Parses all secondary `.cham.md` files into a layer→annotations mapping.
 * The layer ID is derived from the filename (e.g., `guopu.cham.md` → `guopu`).
 */
export function parseCommentaryLayers(
  files: ReadonlyMap<string, string>,
  primaryDoc: ChamDocument,
): Record<string, OutputAnnotation[]> {
  const layers: Record<string, OutputAnnotation[]> = {}
  for (const [filename, content] of files) {
    if (!filename.endsWith('.cham.md') || filename === 'text.cham.md') continue
    const layerDoc = parse(content)
    if (layerDoc.meta.type !== 'secondary') continue
    const layerId = filename.replace('.cham.md', '')
    layers[layerId] = buildAnnotationsFromLayer(layerDoc, primaryDoc, layerId)
  }
  return layers
}

/**
 * Builds OutputAnnotationLayer[] from a layer-annotations mapping and book config.
 *
 * Output order:
 * 1. A synthetic `default` layer (empty annotations) — represents the primary text.
 * 2. One layer per book.yaml layer definition, in displayOrder.
 *
 * Layers with no corresponding file in `layerAnnotations` are included with empty arrays,
 * so the frontend always knows what layers exist.
 */
export function buildAnnotationLayers(
  layerAnnotations: Record<string, OutputAnnotation[]>,
  bookConfig: BookConfig,
): OutputAnnotationLayer[] {
  const bookLayers = bookConfig.layers || []
  if (bookLayers.length === 0 && Object.keys(layerAnnotations).length === 0) return []

  const result: OutputAnnotationLayer[] = []

  result.push({
    id: 'default',
    label: bookConfig.annotation?.defaultLabel || '原文',
    shortLabel: bookConfig.annotation?.defaultShortLabel || '文',
    contributor: bookConfig.contributors?.[0]?.ref || '',
    role: 'author',
    nature: 'annotation',
    displayOrder: 0,
    enabled: true,
    annotations: [],
  })

  for (const bookLayer of bookLayers) {
    const annotations = layerAnnotations[bookLayer.id] || []
    result.push({
      id: bookLayer.id,
      label: bookLayer.label,
      shortLabel: bookLayer.shortLabel || bookLayer.label.charAt(0),
      contributor: bookLayer.contributor,
      role: bookLayer.role || 'commentator',
      nature: bookLayer.nature || 'commentary',
      displayOrder: bookLayer.displayOrder ?? result.length,
      enabled: bookLayer.enabled !== false,
      annotations,
    })
  }

  return result
}
