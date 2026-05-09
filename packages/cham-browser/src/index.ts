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
} from '@hanology/cham/types'

export { isSecondaryMeta } from '@hanology/cham/types'

// Parser & Serializer (pure TypeScript, no Node.js dependencies)
export { ChamParser, parse, ChamParseError } from '@hanology/cham/parser'
export { ChamSerializer, serialize } from '@hanology/cham/serializer'

// Pipeline (pure transformation functions, no Node.js fs)
export {
  buildPieceFromCham,
  buildBookMeta,
  buildBookData,
  buildLibraryIndex,
  buildCrossRefs,
  buildAuthorsJson,
  buildDynastiesJson,
  detectScale,
} from './pipeline.js'

export type { AuthorRecord } from './pipeline.js'
