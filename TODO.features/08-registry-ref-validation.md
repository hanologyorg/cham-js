# TODO: Registry ref validation

**Spec**: `person ref:A001`, `place ref:P001`, `event ref:E001` should reference valid registry entries.

**Current**: No registry loading, so refs are never validated.

**Fix**: After loading registries (depends on 03-registry-loading), validate that annotation `ref` params match existing entries.

**Depends on**: 03-registry-loading

**Files**: `src/validator.ts`
