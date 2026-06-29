import { join } from 'path'
import { existsSync } from 'fs'
import { loadYaml } from './yaml.js'
import {
  asRecord, asArrayOfRecords,
  pickString, pickNumber, pickStringArray,
} from './yaml-typer.js'
import type {
  ChamRegistries, AuthorRecord, DynastyRecord, EraRecord,
  SexagenaryRecord, PlaceRecord, EventRecord, LexiconEntry, WorkRecord,
  SourceRecord,
} from './types.js'

export interface RegistryLoadOptions {
  dataDir: string
  authors?: boolean
  dynasties?: boolean
  eras?: boolean
  sexagenary?: boolean
  places?: boolean
  events?: boolean
  lexicon?: boolean
  works?: boolean
  sources?: boolean
}

/**
 * Picks known optional string fields from a record, omitting
 * undefined/null values. Coerces non-strings to strings (rare in
 * practice; defensive against malformed YAML).
 */
function pickOptionalStrings(
  raw: Record<string, unknown>,
  ...fields: readonly string[]
): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {}
  for (const f of fields) {
    const v = raw[f]
    if (v === undefined || v === null) continue
    out[f] = typeof v === 'string' ? v : String(v)
  }
  return out
}

function loadAuthors(dataDir: string): Record<string, AuthorRecord> {
  const top = asRecord(loadYaml(join(dataDir, 'authors.yaml')))
  if (!top) return {}
  const result: Record<string, AuthorRecord> = {}

  // Format (a): `authors:` array with explicit `id` fields.
  const arrayForm = asArrayOfRecords(top.authors)
  if (arrayForm) {
    for (const item of arrayForm) {
      const id = pickString(item, 'id')
      if (!id) continue
      result[id] = {
        name: pickString(item, 'name') ?? id,
        ...pickOptionalStrings(item,
          'dynasty', 'era', 'eraCode', 'bio',
          'born', 'died', 'courtesyName', 'artName',
          'wikidata', 'ctextId', 'wikipediaZh', 'wikipediaEn',
        ),
      }
    }
    return result
  }

  // Format (b): top-level mapping of id → record.
  for (const [id, val] of Object.entries(top)) {
    const item = asRecord(val)
    if (!item || !('name' in item)) continue
    result[id] = {
      name: pickString(item, 'name') ?? id,
      ...pickOptionalStrings(item,
        'dynasty', 'era', 'eraCode', 'bio',
        'born', 'died', 'courtesyName', 'artName',
        'wikidata', 'ctextId', 'wikipediaZh', 'wikipediaEn',
      ),
    }
  }
  return result
}

function loadDynasties(dataDir: string): DynastyRecord[] {
  const top = asRecord(loadYaml(join(dataDir, 'dynasties.yaml')))
  if (!top) return []

  const arrayForm = asArrayOfRecords(top.dynasties)
  if (arrayForm) {
    return arrayForm.map(d => ({
      id: pickString(d, 'id') ?? '',
      label: pickString(d, 'label') ?? '',
      start: pickNumber(d, 'start'),
      end: pickNumber(d, 'end'),
      gbCode: pickString(d, 'gb_code'),
    }))
  }

  const result: DynastyRecord[] = []
  for (const [key, val] of Object.entries(top)) {
    const d = asRecord(val)
    if (!d) continue
    if (!('code' in d) && !('start' in d)) continue
    result.push({
      id: key,
      label: key,
      code: pickString(d, 'code'),
      start: pickNumber(d, 'start'),
      end: pickNumber(d, 'end'),
      parent: pickString(d, 'parent'),
      note: pickString(d, 'note'),
    })
  }
  return result
}

function loadEras(dataDir: string): EraRecord[] {
  const top = asRecord(loadYaml(join(dataDir, 'eras.yaml')))
  if (!top) return []
  const arrayForm = asArrayOfRecords(top.eras)
  if (!arrayForm) return []
  return arrayForm.map(e => ({
    dynasty: pickString(e, 'dynasty') ?? '',
    era: pickString(e, 'era') ?? '',
    eraCode: pickString(e, 'eraCode'),
    label: pickString(e, 'label') ?? '',
    start: pickNumber(e, 'start'),
    end: pickNumber(e, 'end'),
  }))
}

function loadSexagenary(dataDir: string): SexagenaryRecord[] {
  const top = asRecord(loadYaml(join(dataDir, 'sexagenary.yaml')))
  if (!top) return []
  const arrayForm = asArrayOfRecords(top.entries)
  if (!arrayForm) return []
  return arrayForm.map(e => ({
    stem: pickString(e, 'stem') ?? '',
    branch: pickString(e, 'branch') ?? '',
    label: pickString(e, 'label') ?? '',
  }))
}

function loadPlaces(dataDir: string): Record<string, PlaceRecord> {
  const top = asRecord(loadYaml(join(dataDir, 'places.yaml')))
  if (!top) return {}
  const result: Record<string, PlaceRecord> = {}

  const arrayForm = asArrayOfRecords(top.places)
  if (arrayForm) {
    for (const item of arrayForm) {
      const id = pickString(item, 'id')
      if (!id) continue
      result[id] = {
        id,
        label: pickString(item, 'label') ?? '',
        modern: pickString(item, 'modern'),
        lat: pickNumber(item, 'lat'),
        lon: pickNumber(item, 'lon'),
      }
    }
    return result
  }

  for (const [id, val] of Object.entries(top)) {
    const item = asRecord(val)
    if (!item) continue
    if (!('name' in item) && !('label' in item)) continue
    const geo = item.geo
    const coords = extractLatLon(geo)
    result[id] = {
      id,
      label: pickString(item, 'name') ?? pickString(item, 'label') ?? '',
      modern: pickString(item, 'modern'),
      ...coords,
    }
  }
  return result
}

/** Reads `[lat, lon]` from a geo array, or returns `{}` if malformed. */
function extractLatLon(geo: unknown): { lat?: number; lon?: number } {
  if (!Array.isArray(geo) || geo.length < 2) return {}
  const lat = geo[0]
  const lon = geo[1]
  if (typeof lat !== 'number' || typeof lon !== 'number') return {}
  return { lat, lon }
}

function loadEvents(dataDir: string): Record<string, EventRecord> {
  const top = asRecord(loadYaml(join(dataDir, 'events.yaml')))
  if (!top) return {}
  const result: Record<string, EventRecord> = {}

  const arrayForm = asArrayOfRecords(top.events)
  if (arrayForm) {
    for (const item of arrayForm) {
      const id = pickString(item, 'id')
      if (!id) continue
      result[id] = {
        id,
        label: pickString(item, 'label') ?? '',
        dynasty: pickString(item, 'dynasty'),
        era: pickString(item, 'era'),
        eraCode: pickString(item, 'eraCode'),
        year: pickNumber(item, 'year'),
      }
    }
    return result
  }

  for (const [id, val] of Object.entries(top)) {
    const item = asRecord(val)
    if (!item) continue
    if (!('name' in item) && !('label' in item)) continue
    result[id] = {
      id,
      label: pickString(item, 'name') ?? pickString(item, 'label') ?? '',
      dynasty: pickString(item, 'dynasty'),
      era: pickString(item, 'era'),
      eraCode: pickString(item, 'eraCode'),
      year: pickNumber(item, 'year'),
    }
  }
  return result
}

function loadLexicon(dataDir: string): LexiconEntry[] {
  const top = asRecord(loadYaml(join(dataDir, 'lexicon.yaml')))
  if (!top) return []
  const arrayForm = asArrayOfRecords(top.entries)
  if (!arrayForm) return []
  return arrayForm.map(e => {
    const char = pickString(e, 'char') ?? ''
    const readings = asArrayOfRecords(e.readings)
    if (readings) {
      return {
        char,
        readings: readings.map(r => ({
          lang: pickString(r, 'lang') ?? 'cmn',
          value: pickString(r, 'value') ?? '',
        })),
      }
    }
    return {
      char,
      readings: [{
        lang: pickString(e, 'lang') ?? 'cmn',
        value: pickString(e, 'value') ?? '',
      }],
    }
  })
}

function loadWorks(dataDir: string): Record<string, WorkRecord> {
  const top = asRecord(loadYaml(join(dataDir, 'works.yaml')))
  if (!top) return {}
  const result: Record<string, WorkRecord> = {}

  const arrayForm = asArrayOfRecords(top.works)
  if (!arrayForm) {
    // Mapping form: key → record with `label`.
    for (const [key, val] of Object.entries(top)) {
      const w = asRecord(val)
      if (!w || !('label' in w)) continue
      result[key] = workRecordFromItem(key, w)
    }
    return result
  }

  for (const item of arrayForm) {
    const id = pickString(item, 'id')
    if (!id) continue
    result[id] = workRecordFromItem(id, item)
  }
  return result
}

function workRecordFromItem(id: string, item: Record<string, unknown>): WorkRecord {
  return {
    id,
    label: pickString(item, 'label') ?? '',
    altLabels: pickStringArray(item, 'altLabels'),
    creator: pickString(item, 'creator'),
    genre: pickString(item, 'genre'),
    hierarchy: pickStringArray(item, 'hierarchy'),
    wikidata: pickString(item, 'wikidata'),
    ctextId: pickString(item, 'ctextId'),
    wikipediaZh: pickString(item, 'wikipediaZh'),
  }
}

function loadSources(dataDir: string): Record<string, SourceRecord> {
  const top = asRecord(loadYaml(join(dataDir, 'sources.yaml')))
  if (!top) return {}
  const result: Record<string, SourceRecord> = {}
  for (const [key, val] of Object.entries(top)) {
    const item = asRecord(val)
    if (!item || !('title' in item)) continue
    result[key] = {
      names: pickStringArray(item, 'names') ?? [],
      title: pickString(item, 'title') ?? '',
      titleEn: pickString(item, 'title-en'),
    }
  }
  return result
}

export class RegistryLoader {
  loadAll(dataDir: string): ChamRegistries {
    return {
      authors: existsSync(join(dataDir, 'authors.yaml')) ? loadAuthors(dataDir) : {},
      dynasties: existsSync(join(dataDir, 'dynasties.yaml')) ? loadDynasties(dataDir) : [],
      eras: existsSync(join(dataDir, 'eras.yaml')) ? loadEras(dataDir) : [],
      sexagenary: existsSync(join(dataDir, 'sexagenary.yaml')) ? loadSexagenary(dataDir) : [],
      places: existsSync(join(dataDir, 'places.yaml')) ? loadPlaces(dataDir) : {},
      events: existsSync(join(dataDir, 'events.yaml')) ? loadEvents(dataDir) : {},
      lexicon: existsSync(join(dataDir, 'lexicon.yaml')) ? loadLexicon(dataDir) : [],
      works: existsSync(join(dataDir, 'works.yaml')) ? loadWorks(dataDir) : {},
      sources: existsSync(join(dataDir, 'sources.yaml')) ? loadSources(dataDir) : {},
    }
  }

  loadSelected(dataDir: string, opts: RegistryLoadOptions): Partial<ChamRegistries> {
    const result: Partial<ChamRegistries> = {}
    if (opts.authors !== false) result.authors = loadAuthors(dataDir)
    if (opts.dynasties !== false) result.dynasties = loadDynasties(dataDir)
    if (opts.eras !== false) result.eras = loadEras(dataDir)
    if (opts.sexagenary !== false) result.sexagenary = loadSexagenary(dataDir)
    if (opts.places !== false) result.places = loadPlaces(dataDir)
    if (opts.events !== false) result.events = loadEvents(dataDir)
    if (opts.lexicon !== false) result.lexicon = loadLexicon(dataDir)
    if (opts.works !== false) result.works = loadWorks(dataDir)
    if (opts.sources !== false) result.sources = loadSources(dataDir)
    return result
  }
}
