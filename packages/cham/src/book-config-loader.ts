// ─── Book Config Loader ────────────────────────────────────────
// Loads and merges book.yaml files from a directory hierarchy,
// producing a typed BookConfig. Uses yaml-typer accessors at every
// field read — malformed YAML surfaces as undefined rather than
// silently coercing to the wrong type.
//
// The directory walk is the only I/O this module does; the shape
// transform (`parseBookConfig`) is pure and independently testable.

import { existsSync } from 'fs'
import { join, basename, dirname } from 'path'
import { loadYaml } from './yaml.js'
import {
  asRecord, pickString, pickStringArray, pickRecord,
} from './yaml-typer.js'
import type { BookConfig } from './types.js'

/**
 * Walks `bookDir` and its ancestors, merging every `book.yaml` found.
 * Files closer to `bookDir` override their parents. `contributors` and
 * `layers` arrays are *replaced* (not concatenated) when redefined; the
 * `date` mapping is *deep-merged*.
 *
 * Returns the merged raw record. Use {@link parseBookConfig} to coerce
 * to a typed `BookConfig`.
 */
export function loadBookConfigHierarchy(bookDir: string): Record<string, unknown> {
  const configs: Record<string, unknown>[] = []
  let dir = bookDir

  while (dir && dir !== '/' && existsSync(dir)) {
    const yamlPath = join(dir, 'book.yaml')
    if (existsSync(yamlPath)) {
      const raw = asRecord(loadYaml(yamlPath)) ?? {}
      configs.unshift(raw)
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return configs.reduce<Record<string, unknown>>((merged, cfg) => {
    const out: Record<string, unknown> = { ...merged, ...cfg }
    if (cfg.contributors !== undefined) out.contributors = cfg.contributors
    if (cfg.layers !== undefined) out.layers = cfg.layers
    if (cfg.date !== undefined) {
      const mergedDate = asRecord(merged.date) ?? {}
      const cfgDate = asRecord(cfg.date) ?? {}
      out.date = { ...mergedDate, ...cfgDate }
    }
    return out
  }, {})
}

/**
 * Coerces a raw YAML record into a typed `BookConfig`. Pure — no I/O.
 *
 * Field-by-field reads use `yaml-typer` accessors, so a malformed value
 * (e.g. `contributors: "Alice"` instead of a list) becomes `undefined`
 * rather than propagating as the wrong type.
 *
 * Literal-union fields (`genre`, `contributors`, `date`, `layers`,
 * `annotation`) still need casts — TS can't narrow from `unknown` to a
 * specific literal union without a runtime validator per type.
 */
export function parseBookConfig(raw: Record<string, unknown>, fallbackId: string): BookConfig {
  return {
    id: pickString(raw, 'id') ?? fallbackId,
    title: pickString(raw, 'title') ?? '',
    subtitle: pickString(raw, 'subtitle'),
    'title-en': pickString(raw, 'title-en'),
    publisher: pickString(raw, 'publisher'),
    genre: pickString(raw, 'genre') as BookConfig['genre'],
    contributors: raw.contributors as BookConfig['contributors'],
    date: pickRecord(raw, 'date') as BookConfig['date'],
    hero: pickStringArray(raw, 'hero'),
    layers: raw.layers as BookConfig['layers'],
    annotation: raw.annotation as BookConfig['annotation'],
  }
}

/** Loads, merges, and parses book.yaml from `bookDir` and ancestors. */
export function loadBookConfig(bookDir: string): BookConfig {
  return parseBookConfig(loadBookConfigHierarchy(bookDir), basename(bookDir))
}
