// ─── Frontmatter Parser ────────────────────────────────────────
// Parses the YAML frontmatter block at the top of a CHAM document
// into a typed ChamMeta object.

import type {
  ChamMeta, PrimaryMeta, SecondaryMeta, PartMeta,
  ChamContributor, ChamDate, PieceSource, HierarchyLevel,
} from '../types.js'
import { parseYaml as parseYamlSimple } from '../yaml.js'
import {
  asRecord, asArrayOfRecords,
  pickString, pickNumber, pickBoolean, pickRecord,
} from '../yaml-typer.js'

// ─── Errors ────────────────────────────────────────────────────

export class ChamParseError extends Error {
  constructor(message: string, readonly line?: number) {
    super(line != null ? `Line ${line}: ${message}` : message)
    this.name = 'ChamParseError'
  }
}

// ─── Frontmatter Splitting ─────────────────────────────────────

/**
 * Splits a CHAM document source into frontmatter YAML and body markdown.
 * Strips a leading BOM if present. Returns empty meta if no frontmatter.
 */
export function splitFrontmatter(source: string): { meta: string; body: string } {
  const trimmed = source.replace(/^﻿/, '')
  if (!trimmed.startsWith('---')) return { meta: '', body: trimmed }
  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) return { meta: '', body: trimmed }
  const meta = trimmed.slice(3, end)
  const body = trimmed.slice(end + 4)
  return { meta, body: body.startsWith('\n') ? body.slice(1) : body }
}

// ─── Meta Construction ─────────────────────────────────────────

/**
 * Constructs a typed ChamMeta from raw YAML data.
 * Discriminates between primary, secondary, and part metadata
 * based on the presence of `base` (secondary) or `part` (part) fields.
 */
export function buildMeta(raw: unknown): ChamMeta {
  const record = asRecord(raw)
  if (!record) {
    throw new ChamParseError('Frontmatter must be a YAML mapping')
  }
  const base = pickString(record, 'base')
  if (base) return buildSecondaryMeta(record, base)
  const partNum = pickNumber(record, 'part')
  if (partNum !== undefined) return buildPartMeta(record, partNum)
  return buildPrimaryMeta(record)
}

function buildSecondaryMeta(raw: Record<string, unknown>, base: string): SecondaryMeta {
  return {
    type: 'secondary',
    base,
    contributor: pickString(raw, 'contributor'),
    role: pickString(raw, 'role'),
    dynasty: pickString(raw, 'dynasty'),
    era: pickString(raw, 'era'),
    era_year: pickNumber(raw, 'era_year'),
    iso: pickNumber(raw, 'iso'),
    nature: pickString(raw, 'nature'),
  }
}

function buildPartMeta(raw: Record<string, unknown>, part: number): PartMeta {
  const source = pickRecord(raw, 'source')
  return {
    type: 'part',
    part,
    group: pickString(raw, 'group'),
    title: pickString(raw, 'title'),
    ...(source ? { source: buildPieceSource(source) } : {}),
  }
}

function buildPrimaryMeta(raw: Record<string, unknown>): PrimaryMeta {
  const contributorsRaw = asArrayOfRecords(raw.contributors)
  const dateRaw = pickRecord(raw, 'date')
  const sourceRaw = pickRecord(raw, 'source')
  const hierarchyRaw = asArrayOfRecords(raw.hierarchy)

  const id = raw.id
  const title = pickString(raw, 'title')
  if (id !== undefined && typeof id !== 'number' && typeof id !== 'string') {
    throw new ChamParseError(`Primary meta "id" must be number or string, got ${typeof id}`)
  }
  if (title === undefined) {
    throw new ChamParseError('Primary meta missing required field: title')
  }

  return {
    type: 'primary',
    id: id as number | string,
    title,
    ...(contributorsRaw?.length ? { contributors: contributorsRaw.map(buildContributor) } : {}),
    ...(dateRaw ? { date: buildDate(dateRaw) } : {}),
    ...(raw.genre ? { genre: raw.genre as PrimaryMeta['genre'] } : {}),
    ...(sourceRaw ? { source: buildPieceSource(sourceRaw) } : {}),
    ...(hierarchyRaw ? { hierarchy: hierarchyRaw.map(buildHierarchyLevel) } : {}),
  }
}

function buildContributor(c: Record<string, unknown>): ChamContributor {
  const ref = pickString(c, 'ref')
  if (!ref) {
    throw new ChamParseError('Contributor missing required field: ref')
  }
  const role = pickString(c, 'role')
  if (!role) {
    throw new ChamParseError(`Contributor "${ref}" missing required field: role`)
  }
  const title = pickString(c, 'title')
  return { ref, role: role as ChamContributor['role'], ...(title ? { title } : {}) }
}

function buildDate(date: Record<string, unknown>): ChamDate {
  const out: ChamDate = {
    dynasty: pickString(date, 'dynasty'),
    era: pickString(date, 'era'),
    eraCode: pickString(date, 'eraCode'),
    era_year: pickNumber(date, 'era_year'),
    sexagenary: pickString(date, 'sexagenary'),
    iso: pickNumber(date, 'iso'),
    circa: pickBoolean(date, 'circa'),
  }
  // Drop undefined keys for a cleaner object shape.
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as ChamDate
}

function buildPieceSource(source: Record<string, unknown>): PieceSource {
  const rangeRaw = pickRecord(source, 'range')
  const relation = pickString(source, 'relation') ?? 'standalone'
  return {
    text: pickString(source, 'text'),
    textRef: pickString(source, 'textRef'),
    pieceRef: pickNumber(source, 'pieceRef'),
    edition: pickString(source, 'edition'),
    publisher: pickString(source, 'publisher'),
    page: pickString(source, 'page'),
    relation: relation as PieceSource['relation'],
    ...(rangeRaw ? { range: rangeRaw as PieceSource['range'] } : {}),
  }
}

function buildHierarchyLevel(h: Record<string, unknown>): HierarchyLevel {
  const level = pickString(h, 'level')
  const index = pickNumber(h, 'index')
  if (!level) throw new ChamParseError('Hierarchy level missing required field: level')
  if (index === undefined) throw new ChamParseError(`Hierarchy level "${level}" missing required field: index`)
  const label = pickString(h, 'label')
  const parent = h.parent
  return {
    level,
    index,
    ...(label ? { label } : {}),
    ...(parent !== undefined && (typeof parent === 'number' || typeof parent === 'string')
      ? { parent }
      : {}),
  }
}
