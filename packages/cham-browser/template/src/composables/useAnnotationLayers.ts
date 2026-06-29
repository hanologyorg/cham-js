// ─── useAnnotationLayers ──────────────────────────────────────
// Owns annotation layer state: which layers are active, the merged
// annotation list across active layers, the side-pane visibility, and
// per-annotation headword resolution.
//
// Extracted from PieceView.vue to remove layer-toggle + pane logic
// from the view's god-script. Single-responsibility: given a piece,
// expose the pieces PieceView's template needs.

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { Annotation, AnnotationLayer, Piece } from '../types'

export interface UseAnnotationLayers {
  /** All layers declared on the piece, in display order. */
  readonly layers: ComputedRef<readonly AnnotationLayer[]>
  /** True when the piece has more than one layer (i.e. toggling makes sense). */
  readonly hasLayers: ComputedRef<boolean>
  /** Layers that the user can toggle (excludes the default layer). */
  readonly toggleableLayers: ComputedRef<readonly AnnotationLayer[]>
  /** Currently active layer ids. Empty = no layers active. */
  readonly activeLayerIds: Ref<readonly string[]>
  /** Toggle a layer on/off; when going from N>0 to 0, also dismisses the pane. */
  toggleLayer(id: string): void
  /** Annotations visible to the reader: all if no layers, or merged active layers. */
  readonly mergedAnnotations: ComputedRef<readonly Annotation[]>
  /** Map of annotation id → headword text (stripped prefix). */
  readonly headwords: ComputedRef<Record<string, string>>
  /** Whether the side annotation pane is visible. */
  readonly paneVisible: Ref<boolean>
  /** The id of the annotation whose pane is active. */
  readonly paneActiveId: Ref<string>
  /** Programmatically open the pane and focus a specific annotation. */
  showPaneFor(ann: Annotation): void
  /** Programmatically close the pane. */
  hidePane(): void
  /** Flash-scroll to the DOM element tagged with `ann.id` (read from `data-ann-ids`). */
  scrollToAnnotation(ann: Annotation): void
}

/** Extracts the headword (the leading 1-character or 2-character subject) from an annotation. */
function getHeadwordFrom(ann: Annotation): string {
  const m = ann.text.match(/^([一-鿿]{1,2})/)
  return m ? m[1] : ''
}

export function useAnnotationLayers(
  pieceRef: ComputedRef<Piece | undefined>,
  annotationsVisible: Ref<boolean>,
): UseAnnotationLayers {
  const layers = computed<readonly AnnotationLayer[]>(() => pieceRef.value?.annotationLayers || [])
  const hasLayers = computed(() => layers.value.length > 1)
  const toggleableLayers = computed(() => layers.value.filter(l => l.id !== 'default'))
  const activeLayerIds = ref<string[]>([])
  const paneVisible = ref(false)
  const paneActiveId = ref('')

  function toggleLayer(id: string) {
    const current = activeLayerIds.value
    if (current.includes(id)) {
      const next = current.filter(x => x !== id)
      activeLayerIds.value = next
      if (next.length === 0) annotationsVisible.value = false
    } else {
      activeLayerIds.value = [...current, id]
      annotationsVisible.value = true
    }
  }

  function showPaneFor(ann: Annotation) {
    paneActiveId.value = ann.id
    paneVisible.value = true
  }

  function hidePane() {
    paneVisible.value = false
  }

  function scrollToAnnotation(ann: Annotation) {
    const el = document.querySelector(`[data-ann-ids*="${ann.id}"]`) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      el.classList.add('ann-flash')
      setTimeout(() => el.classList.remove('ann-flash'), 1500)
    }
  }

  // Initialize active layers: all enabled layers, if any layers exist.
  watch(layers, (newLayers) => {
    if (newLayers.length > 1 && activeLayerIds.value.length === 0) {
      activeLayerIds.value = newLayers.filter(l => l.enabled).map(l => l.id)
    }
  }, { immediate: true })

  const mergedAnnotations = computed<Annotation[]>(() => {
    if (!annotationsVisible.value) return []
    if (!hasLayers.value) return pieceRef.value?.annotations || []
    const result: Annotation[] = []
    for (const layer of layers.value) {
      if (!activeLayerIds.value.includes(layer.id)) continue
      for (const ann of layer.annotations) {
        result.push(ann)
      }
    }
    return result
  })

  const headwords = computed<Record<string, string>>(() => {
    const result: Record<string, string> = {}
    for (const ann of mergedAnnotations.value) {
      result[ann.id] = getHeadwordFrom(ann)
    }
    return result
  })

  return {
    layers,
    hasLayers,
    toggleableLayers,
    activeLayerIds,
    toggleLayer,
    mergedAnnotations,
    headwords,
    paneVisible,
    paneActiveId,
    showPaneFor,
    hidePane,
    scrollToAnnotation,
  }
}
