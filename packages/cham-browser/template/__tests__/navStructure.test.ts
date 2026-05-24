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

  it('has section navigation in vertical inline-nav', () => {
    expect(pieceView).toContain('v-sec-nav-v')
    expect(pieceView).toContain('v-sec-btn')
  })

  it('has font size controls in vertical inline-nav', () => {
    expect(pieceView).toContain('v-font-nav-v')
    expect(pieceView).toContain('v-inav-font')
  })

  it('sectionNavItems includes annotations and prose sections', () => {
    // Must reference annotation section check
    expect(pieceView).toContain("key: 'annotations'")
    expect(pieceView).toContain('sectionNavItems')
    expect(pieceView).toContain('scrollToSection')
  })

  it('section blocks have data-section-key for scroll targeting', () => {
    expect(pieceView).toContain(':data-section-key')
  })

  it('scrollToSection handles both annotations and prose sections', () => {
    const scrollFn = pieceView.match(/function scrollToSection[\s\S]*?^}/m)
    expect(scrollFn).toBeTruthy()
    expect(scrollFn![0]).toContain('annotations')
    expect(scrollFn![0]).toContain('data-section-key')
  })

  it('imports FONT_SIZES from useReadingMode', () => {
    expect(pieceView).toMatch(/import.*FONT_SIZES.*useReadingMode/)
  })

  it('font size buttons use setMainFontSize from useReadingMode', () => {
    expect(pieceView).toContain('setMainFontSize')
  })
})
