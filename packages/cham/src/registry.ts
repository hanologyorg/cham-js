import { join } from 'path'
import { existsSync } from 'fs'
import { loadYaml } from './yaml.js'
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

function loadAuthors(dataDir: string): Record<string, AuthorRecord> {
  const raw = loadYaml(join(dataDir, 'authors.yaml'))
  const result: Record<string, AuthorRecord> = {}
  if (raw.authors && Array.isArray(raw.authors)) {
    for (const item of raw.authors as Array<Record<string, unknown>>) {
      const id = item.id as string
      if (!id) continue
      result[id] = {
        name: item.name as string || id,
        dynasty: item.dynasty as string | undefined,
        era: item.era as string | undefined,
        eraCode: item.eraCode as string | undefined,
        bio: item.bio as string | undefined,
      }
    }
    return result
  }
  for (const [id, val] of Object.entries(raw)) {
    if (typeof val !== 'object' || val === null) continue
    const item = val as Record<string, unknown>
    if (!('name' in item)) continue
    result[id] = {
      name: item.name as string || id,
      dynasty: item.dynasty as string | undefined,
      era: item.era as string | undefined,
      eraCode: item.eraCode as string | undefined,
      bio: item.bio as string | undefined,
    }
  }
  return result
}

function loadDynasties(dataDir: string): DynastyRecord[] {
  const raw = loadYaml(join(dataDir, 'dynasties.yaml'))
  if (raw.dynasties && Array.isArray(raw.dynasties)) {
    return (raw.dynasties as Array<Record<string, unknown>>).map(d => ({
      id: d.id as string,
      label: d.label as string,
      start: d.start as number | undefined,
      end: d.end as number | undefined,
      gbCode: d.gb_code as string | undefined,
    }))
  }
  const result: DynastyRecord[] = []
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val !== 'object' || val === null) continue
    const d = val as Record<string, unknown>
    if (!('code' in d) && !('start' in d)) continue
    result.push({
      id: key,
      label: key,
      code: d.code as string | undefined,
      start: d.start as number | null | undefined,
      end: d.end as number | null | undefined,
      parent: d.parent as string | undefined,
      note: d.note as string | undefined,
    })
  }
  return result
}

function loadEras(dataDir: string): EraRecord[] {
  const raw = loadYaml(join(dataDir, 'eras.yaml'))
  if (!raw.eras || !Array.isArray(raw.eras)) return []
  return (raw.eras as Array<Record<string, unknown>>).map(e => ({
    dynasty: e.dynasty as string,
    era: (e.era as string) || '',
    eraCode: e.eraCode as string | undefined,
    label: e.label as string,
    start: e.start as number | undefined,
    end: e.end as number | undefined,
  }))
}

function loadSexagenary(dataDir: string): SexagenaryRecord[] {
  const raw = loadYaml(join(dataDir, 'sexagenary.yaml'))
  if (!raw.entries || !Array.isArray(raw.entries)) return []
  return (raw.entries as Array<Record<string, unknown>>).map(e => ({
    stem: e.stem as string,
    branch: e.branch as string,
    label: e.label as string,
  }))
}

function loadPlaces(dataDir: string): Record<string, PlaceRecord> {
  const raw = loadYaml(join(dataDir, 'places.yaml'))
  const result: Record<string, PlaceRecord> = {}
  if (raw.places && Array.isArray(raw.places)) {
    for (const item of raw.places as Array<Record<string, unknown>>) {
      const id = item.id as string
      if (!id) continue
      result[id] = {
        id,
        label: item.label as string,
        modern: item.modern as string | undefined,
        lat: item.lat as number | undefined,
        lon: item.lon as number | undefined,
      }
    }
    return result
  }
  for (const [id, val] of Object.entries(raw)) {
    if (typeof val !== 'object' || val === null) continue
    const item = val as Record<string, unknown>
    if (!('name' in item) && !('label' in item)) continue
    const geo = Array.isArray(item.geo) ? item.geo as number[] : undefined
    result[id] = {
      id,
      label: (item.name || item.label) as string,
      modern: item.modern as string | undefined,
      lat: geo?.[0],
      lon: geo?.[1],
    }
  }
  return result
}

function loadEvents(dataDir: string): Record<string, EventRecord> {
  const raw = loadYaml(join(dataDir, 'events.yaml'))
  const result: Record<string, EventRecord> = {}
  if (raw.events && Array.isArray(raw.events)) {
    for (const item of raw.events as Array<Record<string, unknown>>) {
      const id = item.id as string
      if (!id) continue
      result[id] = {
        id,
        label: item.label as string,
        dynasty: item.dynasty as string | undefined,
        era: item.era as string | undefined,
        eraCode: item.eraCode as string | undefined,
        year: item.year as number | undefined,
      }
    }
    return result
  }
  for (const [id, val] of Object.entries(raw)) {
    if (typeof val !== 'object' || val === null) continue
    const item = val as Record<string, unknown>
    if (!('name' in item) && !('label' in item)) continue
    result[id] = {
      id,
      label: (item.name || item.label) as string,
      dynasty: item.dynasty as string | undefined,
      era: item.era as string | undefined,
      eraCode: item.eraCode as string | undefined,
      year: item.year as number | undefined,
    }
  }
  return result
}

function loadLexicon(dataDir: string): LexiconEntry[] {
  const raw = loadYaml(join(dataDir, 'lexicon.yaml'))
  if (!raw.entries || !Array.isArray(raw.entries)) return []
  return (raw.entries as Array<Record<string, unknown>>).map(e => {
    if (e.readings && Array.isArray(e.readings)) {
      return {
        char: e.char as string,
        readings: (e.readings as Array<Record<string, string>>).map(r => ({
          lang: r.lang,
          value: r.value,
        })),
      }
    }
    const lang = (e.lang as string) || 'cmn'
    const value = (e.value as string) || ''
    return {
      char: e.char as string,
      readings: [{ lang, value }],
    }
  })
}

function loadWorks(dataDir: string): Record<string, WorkRecord> {
  const raw = loadYaml(join(dataDir, 'works.yaml'))
  const result: Record<string, WorkRecord> = {}
  if (!raw.works || !Array.isArray(raw.works)) {
    for (const [key, val] of Object.entries(raw)) {
      if (typeof val === 'object' && val !== null && 'label' in (val as Record<string, unknown>)) {
        const w = val as Record<string, unknown>
        result[key] = {
          id: key,
          label: w.label as string,
          altLabels: w.altLabels as string[] | undefined,
          creator: w.creator as string | undefined,
          genre: w.genre as string | undefined,
          hierarchy: w.hierarchy as string[] | undefined,
          wikidata: w.wikidata as string | undefined,
          ctextId: w.ctextId as string | undefined,
          wikipediaZh: w.wikipediaZh as string | undefined,
        }
      }
    }
    return result
  }
  for (const item of raw.works as Array<Record<string, unknown>>) {
    const id = item.id as string
    if (!id) continue
    result[id] = {
      id,
      label: item.label as string,
      altLabels: item.altLabels as string[] | undefined,
      creator: item.creator as string | undefined,
      genre: item.genre as string | undefined,
      hierarchy: item.hierarchy as string[] | undefined,
      wikidata: item.wikidata as string | undefined,
      ctextId: item.ctextId as string | undefined,
      wikipediaZh: item.wikipediaZh as string | undefined,
    }
  }
  return result
}

function loadSources(dataDir: string): Record<string, SourceRecord> {
  const raw = loadYaml(join(dataDir, 'sources.yaml'))
  const result: Record<string, SourceRecord> = {}
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val !== 'object' || val === null) continue
    const item = val as Record<string, unknown>
    if (!('title' in item)) continue
    result[key] = {
      names: (item.names as string[]) || [],
      title: item.title as string,
      titleEn: item['title-en'] as string | undefined,
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
