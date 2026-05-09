import { describe, it, expect } from 'vitest'
import { parseYaml, parseYamlValue } from '../yaml.js'

describe('parseYamlValue', () => {
  it('parses booleans', () => {
    expect(parseYamlValue('true')).toBe(true)
    expect(parseYamlValue('false')).toBe(false)
  })

  it('parses null', () => {
    expect(parseYamlValue('null')).toBeNull()
    expect(parseYamlValue('~')).toBeNull()
  })

  it('parses integers', () => {
    expect(parseYamlValue('42')).toBe(42)
    expect(parseYamlValue('-7')).toBe(-7)
  })

  it('parses floats', () => {
    expect(parseYamlValue('3.14')).toBe(3.14)
  })

  it('parses quoted strings', () => {
    expect(parseYamlValue('"hello"')).toBe('hello')
    expect(parseYamlValue("'world'")).toBe('world')
  })

  it('parses inline arrays', () => {
    expect(parseYamlValue('[a, b, c]')).toEqual(['a', 'b', 'c'])
  })

  it('passes through plain strings', () => {
    expect(parseYamlValue('hello')).toBe('hello')
  })
})

describe('parseYaml', () => {
  it('parses simple key-value pairs', () => {
    const result = parseYaml('id: test\nvalue: 42')
    expect(result.id).toBe('test')
    expect(result.value).toBe(42)
  })

  it('skips comments', () => {
    const result = parseYaml('# comment\nid: test')
    expect(result.id).toBe('test')
  })

  it('skips blank lines', () => {
    const result = parseYaml('\nid: test\n\n')
    expect(result.id).toBe('test')
  })

  it('parses nested objects', () => {
    const result = parseYaml('date:\n  dynasty: 唐\n  era: 貞觀')
    expect(result.date).toEqual({ dynasty: '唐', era: '貞觀' })
  })

  it('parses array items with nested objects', () => {
    const result = parseYaml([
      'contributors:',
      '  - ref: A',
      '    role: author',
      '  - ref: B',
      '    role: editor',
    ].join('\n'))
    expect(result.contributors).toEqual([
      { ref: 'A', role: 'author' },
      { ref: 'B', role: 'editor' },
    ])
  })

  it('parses simple array items', () => {
    const result = parseYaml([
      'hero:',
      '  - img1.jpg',
      '  - img2.jpg',
    ].join('\n'))
    expect(result.hero).toEqual(['img1.jpg', 'img2.jpg'])
  })

  it('parses dot-notation keys', () => {
    const result = parseYaml('source.relation: standalone')
    expect((result.source as any).relation).toBe('standalone')
  })

  it('handles empty input', () => {
    const result = parseYaml('')
    expect(Object.keys(result)).toHaveLength(0)
  })
})
