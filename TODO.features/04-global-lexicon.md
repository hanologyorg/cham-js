# TODO: Global lexicon loading & application

**Spec**: §Annotation layers / §Pipeline — Load `data/lexicon.yaml`, scan clean text for matching characters/words, create pronunciation annotations using default reading, override with inline `pron`.

**Current**: Completely absent. No `lexicon` references in any implementation file.

**Fix**:
- New `src/lexicon.ts`: Load `lexicon.yaml`, scan text for matches, produce `OutputAnnotation[]` with `pron` entries.
- Apply post-parse, skipping positions already covered by inline `pron`.
- Lexicon type definitions in `src/types.ts`.

**Files**: New `src/lexicon.ts`, `src/types.ts`, `src/index.ts`, `src/cham-json.ts`
