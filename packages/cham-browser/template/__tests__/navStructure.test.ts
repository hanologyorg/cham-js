import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const pieceView = readFileSync(
  resolve(__dirname, '../src/views/PieceView.vue'),
  'utf-8',
)

describe('PieceView.vue nav structure', () => {
  it('has section navigation buttons in horizontal mode', () => {
    expect(pieceView).toContain('h-section-nav')
    expect(pieceView).toContain('h-sec-btn')
    expect(pieceView).toContain('sectionNavItems')
  })

  it('has font size controls in horizontal mode', () => {
    expect(pieceView).toContain('h-font-btns')
    expect(pieceView).toContain('fontSizeUp')
    expect(pieceView).toContain('fontSizeDown')
  })

  it('has bottom section bar for vertical mode', () => {
    expect(pieceView).toContain('v-section-bar')
    expect(pieceView).toContain('v-sec-item')
  })

  it('has TOC bar and panel for vertical mode', () => {
    expect(pieceView).toContain('v-toc-bar')
    expect(pieceView).toContain('v-toc-panel')
    expect(pieceView).toContain('v-toc-item')
    expect(pieceView).toContain('tocOpen')
  })

  it('sectionNavItems includes verse, annotations and prose sections', () => {
    expect(pieceView).toContain("'verse'")
    expect(pieceView).toContain("'annotations'")
    expect(pieceView).toContain('sectionNavItems')
    expect(pieceView).toContain('scrollToSection')
  })

  it('section blocks have data-section-key for scroll targeting', () => {
    expect(pieceView).toContain(':data-section-key')
  })

  it('scrollToSection handles verse, annotations and prose sections', () => {
    expect(pieceView).toContain("'verse'")
    expect(pieceView).toContain("'annotations'")
    expect(pieceView).toContain('data-section-key')
  })

  it('imports FONT_SIZES from useReadingMode', () => {
    expect(pieceView).toMatch(/import.*FONT_SIZES.*useReadingMode/)
  })

  it('tracks current section via scroll observer', () => {
    expect(pieceView).toContain('currentSection')
    expect(pieceView).toContain('updateCurrentSection')
  })
})
