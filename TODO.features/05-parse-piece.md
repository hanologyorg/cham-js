# TODO: parsePiece() — multi-file merge in core parser

**Spec**: §Merge rules — "1. Load main file, build marker table. 2. Load subordinate files. 3. Resolve annotations against main file's markers. 4. Merge all annotations."

**Current**: `ChamParser.parse()` only handles a single file. Multi-file logic lives in `cham-json.ts`'s `PieceBuilder` which is JSON-output-specific. The core parser cannot produce a merged `ChamDocument` from a piece directory.

**Fix**: Add `ChamParser.parsePiece(pieceDir: string, bookConfig?: BookConfig)`:
1. Find and parse `text.cham.md` (main file)
2. Find other `*.cham.md` files with `base:` field
3. Parse each subordinate, validate refs against main file's marker table
4. Merge annotation sections into one `ChamDocument`
5. Apply `book.yaml` inheritance for omitted fields

**Files**: `src/parser.ts`, `src/index.ts`
