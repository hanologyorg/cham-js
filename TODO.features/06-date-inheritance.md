# TODO: book.yaml `date` inheritance

**Spec**: "Inheritable fields: `contributors`, `date`, `genre`" — from nearest ancestor `book.yaml`.

**Current**: `contributors` and `genre` inheritance works. `date` is only partially inherited — lines 157-159 of cham-json.ts extract `dynasty` from the author record or piece meta but don't merge the full `ChamDate` object from `book.yaml`.

**Fix**: In `PieceBuilder.build()`, add full `date` inheritance:
```typescript
const date = pmeta.date || this.bookConfig.date
```
Then use `date.dynasty` instead of the current scattered fallback logic.

**Files**: `src/cham-json.ts:134-182`
