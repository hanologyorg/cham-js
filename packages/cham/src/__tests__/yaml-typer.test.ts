import { describe, it, expect } from 'vitest'
import {
  asRecord,
  asArrayOfRecords,
  pickString,
  pickNumber,
  pickBoolean,
  pickStringArray,
  pickRecord,
} from '../yaml-typer.js'

// ─── asRecord ──────────────────────────────────────────────────

describe('asRecord', () => {
  it('returns the record for a plain object', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 })
  })

  it('returns undefined for null', () => {
    expect(asRecord(null)).toBeUndefined()
  })

  it('returns undefined for primitives', () => {
    expect(asRecord(42)).toBeUndefined()
    expect(asRecord('hi')).toBeUndefined()
    expect(asRecord(true)).toBeUndefined()
  })

  it('returns undefined for arrays', () => {
    expect(asRecord([1, 2, 3])).toBeUndefined()
  })
})

// ─── asArrayOfRecords ──────────────────────────────────────────

describe('asArrayOfRecords', () => {
  it('returns records for an array of objects', () => {
    expect(asArrayOfRecords([{ a: 1 }, { b: 2 }])).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('returns undefined for a non-array', () => {
    expect(asArrayOfRecords({ a: 1 })).toBeUndefined()
    expect(asArrayOfRecords('hi')).toBeUndefined()
  })

  it('returns undefined when any element is not a record', () => {
    expect(asArrayOfRecords([{ a: 1 }, 42, { c: 3 }])).toBeUndefined()
  })

  it('returns [] for an empty array', () => {
    expect(asArrayOfRecords([])).toEqual([])
  })
})

// ─── pickString / pickNumber / pickBoolean ─────────────────────

describe('pickString', () => {
  it('returns the value when it is a string', () => {
    expect(pickString({ name: 'Alice' }, 'name')).toBe('Alice')
  })
  it('returns undefined when the value is missing or non-string', () => {
    expect(pickString({}, 'name')).toBeUndefined()
    expect(pickString({ name: 42 }, 'name')).toBeUndefined()
    expect(pickString({ name: null }, 'name')).toBeUndefined()
    expect(pickString({ name: true }, 'name')).toBeUndefined()
  })
})

describe('pickNumber', () => {
  it('returns the value when it is a finite number', () => {
    expect(pickNumber({ age: 42 }, 'age')).toBe(42)
  })
  it('rejects NaN, Infinity, and non-numbers', () => {
    expect(pickNumber({ age: NaN }, 'age')).toBeUndefined()
    expect(pickNumber({ age: Infinity }, 'age')).toBeUndefined()
    expect(pickNumber({ age: '42' }, 'age')).toBeUndefined()
    expect(pickNumber({}, 'age')).toBeUndefined()
  })
})

describe('pickBoolean', () => {
  it('returns the value when it is a boolean', () => {
    expect(pickBoolean({ flag: true }, 'flag')).toBe(true)
    expect(pickBoolean({ flag: false }, 'flag')).toBe(false)
  })
  it('rejects non-booleans', () => {
    expect(pickBoolean({ flag: 1 }, 'flag')).toBeUndefined()
    expect(pickBoolean({ flag: 'true' }, 'flag')).toBeUndefined()
  })
})

// ─── pickStringArray / pickRecord ──────────────────────────────

describe('pickStringArray', () => {
  it('returns the array when all items are strings', () => {
    expect(pickStringArray({ tags: ['a', 'b'] }, 'tags')).toEqual(['a', 'b'])
  })
  it('filters out non-string items', () => {
    expect(pickStringArray({ tags: ['a', 42, 'b'] }, 'tags')).toEqual(['a', 'b'])
  })
  it('returns undefined for non-array values', () => {
    expect(pickStringArray({ tags: 'a' }, 'tags')).toBeUndefined()
    expect(pickStringArray({}, 'tags')).toBeUndefined()
  })
})

describe('pickRecord', () => {
  it('returns the nested record', () => {
    expect(pickRecord({ date: { era: 'Kaiyuan' } }, 'date')).toEqual({ era: 'Kaiyuan' })
  })
  it('returns undefined for non-object values', () => {
    expect(pickRecord({ date: 'Kaiyuan' }, 'date')).toBeUndefined()
    expect(pickRecord({ date: [1, 2] }, 'date')).toBeUndefined()
    expect(pickRecord({}, 'date')).toBeUndefined()
  })
})
