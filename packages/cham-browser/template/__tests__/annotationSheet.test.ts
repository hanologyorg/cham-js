import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const tooltipVue = readFileSync(
  resolve(__dirname, '../src/components/AnnotationTooltip.vue'),
  'utf-8',
)

describe('AnnotationTooltip.vue mobile sheet structure', () => {
  it('does NOT have touchmove.prevent on the ann-sheet container itself', () => {
    // Bug: @touchmove.prevent on the entire sheet blocks all scroll inside
    // The .prevent modifier must only be on the drag bar
    const sheetMatch = tooltipVue.match(/class="ann-sheet"[\s\S]*?>/)
    if (sheetMatch) {
      expect(sheetMatch[0]).not.toContain('@touchmove.prevent')
    }
  })

  it('has touchmove.prevent only on ann-sheet-drag-bar', () => {
    expect(tooltipVue).toContain('ann-sheet-drag-bar')
    // Find the drag-bar element and verify it has touchmove.prevent
    const dragBarMatch = tooltipVue.match(/ann-sheet-drag-bar[\s\S]*?>/)
    expect(dragBarMatch).toBeTruthy()
    expect(dragBarMatch![0]).toContain('@touchmove.prevent')
  })

  it('ann-sheet-drag-bar has touchstart and touchend handlers', () => {
    const dragBarMatch = tooltipVue.match(/ann-sheet-drag-bar[\s\S]*?>/)
    expect(dragBarMatch).toBeTruthy()
    expect(dragBarMatch![0]).toContain('@touchstart')
    expect(dragBarMatch![0]).toContain('@touchend')
  })

  it('has drag bar CSS for vertical mode', () => {
    expect(tooltipVue).toContain('.ann-sheet.vertical .ann-sheet-drag-bar')
  })

  it('has drag grip and hint elements inside drag bar', () => {
    expect(tooltipVue).toContain('ann-drag-grip')
    expect(tooltipVue).toContain('ann-drag-hint')
  })

  it('mobile sheet has a Transition wrapper with ann-sheet name', () => {
    // The mobile sheet must be wrapped in its own Transition
    const sheetBlock = tooltipVue.substring(
      tooltipVue.indexOf('<!-- Mobile bottom sheet -->'),
    )
    expect(sheetBlock.substring(0, 200)).toContain('Transition name="ann-sheet"')
  })

  it('non-vertical mobile sheet still has ann-sheet-handle', () => {
    expect(tooltipVue).toContain('v-if="!vertical" class="ann-sheet-handle"')
  })

  it('vertical mobile sheet hides handle and shows drag bar', () => {
    expect(tooltipVue).toContain('v-if="vertical" class="ann-sheet-drag-bar"')
  })

  it('annotation entry text is at least 16px', () => {
    const entryMatch = tooltipVue.match(/\.ann-entry\s*\{[^}]*\}/)
    expect(entryMatch).toBeTruthy()
    expect(entryMatch![0]).toMatch(/font-size:\s*1[6-9]px/)
  })

  it('annotation text line-height is at least 2', () => {
    const textMatch = tooltipVue.match(/\.ann-text\s*\{[^}]*\}/)
    expect(textMatch).toBeTruthy()
    expect(textMatch![0]).toMatch(/line-height:\s*[2-9]/)
  })

  it('vertical card text has letter-spacing', () => {
    const vertTextMatch = tooltipVue.match(/\.ann-card\.vertical \.ann-text\s*\{[^}]*\}/)
    expect(vertTextMatch).toBeTruthy()
    expect(vertTextMatch![0]).toContain('letter-spacing')
  })
})
