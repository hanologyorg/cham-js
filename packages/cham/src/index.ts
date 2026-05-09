// ─── CHAM Library Public API ──────────────────────────────────

// Types
export type {
  Genre, Role, ChamContributor, ChamDate,
  PrimaryMeta, SecondaryMeta, ChamMeta,
  PieceSource, TextBlock, Marker, MarkerTable,
  SectionMeta, AnnotationSection, AnnotationKind,
  AnnotationTarget, AnnotationEntry,
  SkqsVariant, ChamDocument, ChamProject,
  BookLayer, BookAnnotationDefaults, VolumeConfig,
  BookConfig, BookMeta, BookData, LibraryScale, BookGenre,
  CrossRef, LibraryIndex,
  OutputRange, OutputAnnotation, OutputAnnotationLayer,
  OutputProseSection, OutputPiece, PieceContributor,
  ValidationSeverity, ValidationIssue, ValidationResult,
  EpubConversionOptions, EpubAnnotation, EpubSection, EpubVolume,
  AuthorRecord, DynastyRecord, EraRecord, SexagenaryRecord,
  PlaceRecord, EventRecord, LexiconEntry, ChamRegistries,
} from './types.js'

export { isSecondaryMeta } from './types.js'

// Parser & Serializer
export { ChamParser, parse } from './parser.js'
export { ChamSerializer, serialize } from './serializer.js'

// Validator
export { ChamValidator } from './validator.js'

// ePub Converter
export { EpubConverter } from './epub.js'

// CHAM-JSON Converter
export { ChamJsonConverter } from './cham-json.js'
export type { BookConvertOptions, LibraryConvertOptions, LibraryConvertResult } from './cham-json.js'

// Registry
export { RegistryLoader } from './registry.js'
export type { RegistryLoadOptions } from './registry.js'

// Lexicon
export { LexiconApplier } from './lexicon.js'
export type { LexiconOptions } from './lexicon.js'
