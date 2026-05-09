# TODO: Registry loading

**Spec**: §Registries — Load `authors.yaml`, `places.yaml`, `events.yaml`, `dynasties.yaml`, `eras.yaml`, `sexagenary.yaml`.

**Current**: Only `authors.yaml` partially supported — `ChamJsonConverter` accepts an `authors` parameter but doesn't load the file itself. The other 5 registries have zero support. No registry types exist.

**Fix**:
- New `src/registry.ts`: Load all 6 registry files, parse YAML, return typed objects.
- Types: `DynastyRecord`, `EraRecord`, `SexagenaryRecord`, `PlaceRecord`, `EventRecord` in `src/types.ts`.
- Wire into `ChamJsonConverter` and `ChamValidator`.

**Files**: New `src/registry.ts`, `src/types.ts`, `src/index.ts`, `src/cham-json.ts`, `src/validator.ts`
