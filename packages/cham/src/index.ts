// ─── CHAM Library Public API ──────────────────────────────────

// Types
export type {
  Genre, Role, ChamContributor, ChamDate,
  PrimaryMeta, SecondaryMeta, PartMeta, ChamMeta,
  PieceSource, TextBlock, Marker, MarkerTable,
  SectionMeta, AnnotationSection, AnnotationKind,
  AnnotationTarget, AnnotationEntry,
  SkqsVariant, ChamDocument, ChamPart, ChamProject,
  BookLayer, BookAnnotationDefaults, VolumeConfig,
  BookConfig, BookMeta, BookData, LibraryScale, BookGenre,
  CrossRef, LibraryIndex,
  OutputRange, OutputAnnotation, OutputAnnotationLayer,
  OutputProseSection, OutputPiece, OutputPart, PieceContributor,
  ValidationSeverity, ValidationIssue, ValidationResult,
  EpubConversionOptions, EpubAnnotation, EpubSection, EpubVolume,
  AuthorRecord, DynastyRecord, EraRecord, SexagenaryRecord,
  PlaceRecord, EventRecord, LexiconEntry, ChamRegistries,
  HierarchyLevelName, HierarchyLevel,
  ClassicalNature, GeneralNature, AnnotationNature,
  SpeakerRole, TextBlockRole, HcnDate, WorkRecord,
  TextSection,
} from './types.js'

export { isSecondaryMeta, isPartMeta, VALID_NATURES } from './types.js'

// Domain Models
export { AnnotationKindRegistry } from './model/annotation-kind.js'
export type { AnnotationKindSpec } from './model/annotation-kind.js'
export {
  targetCategory, requiresResolution, targetSortKey, describeTarget,
} from './model/target.js'
export type { TargetCategory } from './model/target.js'

// Target Resolution
export { TextIndex, TextQuoteNotFoundError, TextQuoteAmbiguousError } from './resolver/text-index.js'
export type { TextIndexEntry } from './resolver/text-index.js'
export { TargetResolver, TargetResolutionError } from './resolver/target-resolver.js'
export type { ResolvedTarget, TargetResolutionReason } from './resolver/target-resolver.js'

// Target Parser & Serializer (via the parser.ts/serializer.ts namespace shims)
export { parseTarget } from './parser.js'
export type { TargetParseResult } from './parser.js'
export { serializeTarget } from './serializer.js'

// Parser & Serializer
export { ChamParser, parse, ChamParseError } from './parser.js'
export { ChamSerializer, serialize } from './serializer.js'

// Validator
export { ChamValidator } from './validator.js'

// ePub Converter
export { EpubConverter } from './epub.js'

// CHAM-JSON Converter
export { ChamJsonConverter } from './cham-json.js'
export type { BookConvertOptions, LibraryConvertOptions, LibraryConvertResult } from './cham-json.js'

// Pipeline (pure transformation helpers)
export {
  BookBuilder,
  buildPieceFromCham, buildPartOutput, buildBookMeta, buildBookData, buildLibraryIndex,
  buildCrossRefs, detectScale, buildAuthorsJson, buildDynastiesJson,
  mapKind, entryToRange, buildAnnotations, buildAnnotationsFromLayer,
  getHeadword, buildAnnotationsText, buildAnnotationLayers,
  cleanHardWraps, splitMdFrontmatter, parseProseSections, parseCommentaryLayers,
} from './pipeline.js'

// Registry
export { RegistryLoader } from './registry.js'
export type { RegistryLoadOptions } from './registry.js'

// Date Utilities
export { parseHcnDate, formatHcnDate, resolveEraToDate, normalizeDynasty } from './date-utils.js'

// YAML Boundary Type Helpers
export {
  asRecord, asArrayOfRecords,
  pickString, pickNumber, pickBoolean, pickStringArray, pickRecord,
} from './yaml-typer.js'

// Book Config Loader
export {
  loadBookConfig, loadBookConfigHierarchy, parseBookConfig,
} from './book-config-loader.js'

// Lexicon
export { LexiconApplier } from './lexicon.js'
export type { LexiconOptions } from './lexicon.js'
