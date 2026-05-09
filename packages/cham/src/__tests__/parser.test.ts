import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import { serialize } from '../serializer.js'

describe('parser', () => {
  it('parses a minimal primary document', () => {
    const src = [
      '---',
      'type: primary',
      'id: 1',
      'title: 測試',
      '---',
      '',
      '正文內容',
    ].join('\n')

    const doc = parse(src)
    expect(doc.meta.type).toBe('primary')
    expect((doc.meta as any).title).toBe('測試')
    expect(doc.textBlocks).toHaveLength(1)
    expect(doc.textBlocks[0].text).toBe('正文內容')
  })

  it('round-trips through serialize', () => {
    const src = [
      '---',
      'type: primary',
      'id: 1',
      'title: 測試',
      '---',
      '',
      '第一行',
      '第二行',
    ].join('\n')

    const doc = parse(src)
    const result = serialize(doc)
    expect(result).toContain('第一行')
    expect(result).toContain('第二行')
  })
})
