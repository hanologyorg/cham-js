// ─── Range Builder ─────────────────────────────────────────────
// Converts AnnotationTarget → OutputRange by resolving the target
// against a ChamDocument. Uses the resolver cache for text-quote targets.

import type {
  AnnotationEntry, ChamDocument, OutputRange,
} from '../types.js'
import { TargetResolver } from '../resolver.js'

// Per-document resolver cache. WeakMap so GC'd when the doc is.
const resolverCache = new WeakMap<ChamDocument, TargetResolver>()

function getResolver(doc: ChamDocument): TargetResolver | undefined {
  let r = resolverCache.get(doc)
  if (r) return r
  if (doc.textBlocks.length === 0) return undefined
  r = new TargetResolver(doc.markers, doc.textBlocks)
  resolverCache.set(doc, r)
  return r
}

/**
 * Builds an OutputRange from an AnnotationEntry by resolving its target
 * against the given document.
 *
 * For marker targets: looks up the marker table.
 * For verse targets: validates the position.
 * For text targets: resolves via TextIndex search.
 * For title/full: returns a fixed title-scope range.
 *
 * Returns null if the target cannot be resolved (missing marker,
 * unresolvable text quote, etc.). Callers should skip entries with null ranges.
 */
export function entryToRange(entry: AnnotationEntry, doc: ChamDocument): OutputRange | null {
  switch (entry.target.type) {
    case 'title':
      return { type: 'range', scope: 'title', start: 0, end: 1 }

    case 'full':
      return { type: 'range', scope: 'title', start: 0, end: 0 }

    case 'marker': {
      const marker = doc.markers.get(entry.target.markerId)
      if (!marker) return null
      return {
        type: 'range',
        scope: 'verse',
        verseIndex: marker.blockIndex,
        start: marker.offset,
        end: marker.offset + marker.length,
      }
    }

    case 'verse':
      return {
        type: 'range',
        scope: 'verse',
        verseIndex: entry.target.line,
        start: entry.target.char,
        end: entry.target.end ?? entry.target.char + 1,
      }

    case 'verse-all': {
      const block = doc.textBlocks[entry.target.line]
      if (!block) return null
      return {
        type: 'range',
        scope: 'verse',
        verseIndex: entry.target.line,
        start: 0,
        end: block.text.length,
      }
    }

    case 'text': {
      const resolver = getResolver(doc)
      const resolved = resolver?.tryResolve(entry.target)
      if (!resolved) return null
      return {
        type: 'range',
        scope: resolved.scope,
        verseIndex: resolved.verseIndex >= 0 ? resolved.verseIndex : undefined,
        start: resolved.charStart,
        end: resolved.charEnd,
      }
    }
  }
}
