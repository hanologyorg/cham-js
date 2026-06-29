// ─── Registry Record Types ─────────────────────────────────────
// Author, dynasty, era, sexagenary, place, event, lexicon, work,
// and source records loaded by RegistryLoader from YAML files in
// the data directory.

import type { HierarchyLevelName } from './core.js'

export interface AuthorRecord {
  name: string
  dynasty?: string
  era?: string
  eraCode?: string
  bio?: string
  born?: string
  died?: string
  courtesyName?: string
  artName?: string
  wikidata?: string
  ctextId?: string
  wikipediaZh?: string
  wikipediaEn?: string
}

export interface DynastyRecord {
  id: string
  label: string
  start?: number | null
  end?: number | null
  gbCode?: string
  code?: string
  parent?: string
  note?: string
}

export interface EraRecord {
  dynasty: string
  era: string
  eraCode?: string
  label: string
  start?: number
  end?: number
}

export interface SexagenaryRecord {
  stem: string
  branch: string
  label: string
}

export interface PlaceRecord {
  id: string
  label: string
  modern?: string
  lat?: number
  lon?: number
}

export interface EventRecord {
  id: string
  label: string
  dynasty?: string
  era?: string
  eraCode?: string
  year?: number
}

export interface LexiconEntry {
  char: string
  readings: Array<{ lang: string; value: string }>
}

export interface WorkRecord {
  id: string
  label: string
  altLabels?: string[]
  creator?: string
  indexedIn?: Array<{
    collection: string
    juan?: number
  }>
  genre?: string
  hierarchy?: HierarchyLevelName[]
  wikidata?: string
  ctextId?: string
  wikipediaZh?: string
}

export interface SourceRecord {
  names: string[]
  title: string
  titleEn?: string
}

export interface ChamRegistries {
  authors: Record<string, AuthorRecord>
  dynasties: DynastyRecord[]
  eras: EraRecord[]
  sexagenary: SexagenaryRecord[]
  places: Record<string, PlaceRecord>
  events: Record<string, EventRecord>
  lexicon: LexiconEntry[]
  works: Record<string, WorkRecord>
  sources: Record<string, SourceRecord>
}
