# TODO: Nearest ancestor book.yaml traversal

**Spec**: "Inherit it from the nearest ancestor `book.yaml`" — implies walking up the directory tree for nested books.

**Current**: `loadBookConfig()` (cham-json.ts:522) only loads `book.yaml` from the immediate parent. No ancestor traversal.

**Fix**: Walk up from piece dir, collecting `book.yaml` files, merge with nearest-first precedence.

**Files**: `src/cham-json.ts:522-537`
