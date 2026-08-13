# Plan: `_children` and `_childrenCount` Managed Fields

## Overview

Add `_children` (server-managed array of child URIs, readable in responses) and `_childrenCount` (server-managed integer, always hidden) to all four record types: `GenericEntity`, `List`, `EntityReaction`, `ListReaction`.

### Design decisions settled in planning

- **`_children` is read-only.** Clients can never write it. It is maintained atomically by the server using MongoDB `$addToSet` / `$pull` operators on the parent document whenever any record's `_parents` changes. It mirrors `_parents` on the child — both sides are always consistent.
- **`_childrenCount` is always hidden**, exactly like `_parentsCount`. It is never returned in responses. Its sole purpose is server-side query optimisation — powering a future `leaves` set filter (`{ _childrenCount: 0 }`), mirroring how `_parentsCount` powers the `roots` set filter.
- **`_parents` remains writable** on single-record write paths (`POST /{segment}`, `PATCH /{id}`, `PUT /{id}`). The server diffs old vs new `_parents` and issues atomic `$addToSet`/`$pull` updates on every affected parent's `_children` array. The diff cost is bounded by the number of parents changed, which is typically small.
- **`_parents` is excluded from bulk `PATCH /{segment}`** (updateAll). Consistency across an unbounded number of records cannot be maintained without per-record pre-fetches — the cost is not viable. This is documented as a known limitation.
- **Hierarchy bookkeeping writes bypass `updateById`.** They use a dedicated native MongoDB `updateOne` path (`addChildReference` / `removeChildReference` / `removeParentReference` helper methods on the base repositories). This avoids: `_version` increment, idempotency recalculation, uniqueness/limit/lookup validation, and a redundant existence check — none of which are appropriate for server-side bookkeeping operations. The parent's existence is already verified earlier in the same call path.
- **Neither `_lastUpdatedDateTime` nor `_lastUpdatedBy` is updated.** Both fields track intentional user-driven content changes. A bookkeeping write to `_children`/`_childrenCount` is an internal reference maintenance operation — no different from a database index update. The record's observable content has not changed. The `updateOne` calls in the helper methods contain no `$set` clause at all.
- **`$addToSet` / `$pull` are used instead of full array replacement.** This makes individual array operations atomic at the MongoDB document level, eliminating read-modify-write races under concurrent requests. The transaction (already open via `@transactional()`) provides all-or-nothing atomicity across the child creation and parent update together.
- **`_children` and `_childrenCount` must never contribute to idempotency.** An operator who misconfigures them as idempotency fields must be silently corrected at the `calculateIdempotencyKey` layer. A new `IDEMPOTENCY_EXCLUDED_FIELDS` constant defines the denylist of server-managed fields that are filtered out before the hash is computed.
- **Both `_children` and `_childrenCount` are stripped by `sanitizeRecordType`** (defense in depth) so neither can ever be persisted through any code path. `_children` is read-only but not in `STRICTLY_INTERNAL_FIELDS`, so the OpenAPI exclusion is per-endpoint; stripping in `virtualFields` is the unconditional safety net. `_childrenCount` is in `STRICTLY_INTERNAL_FIELDS` (auto-excluded from request schemas) but the same defense-in-depth argument applies — internal calls, tests, or future code paths could bypass the schema layer. Note: `_parentsCount` has the same gap today and should be added to `virtualFields` at the same time.
- **`findChildren` is migrated to a forward lookup** on `_children`, matching the structure of `findParents`. The current reverse scan (`{ _parents: uri }`) is replaced with `{ _id: { inq: childIds } }`. This is faster, eliminates full-collection scans, and is consistent with the forward lookup pattern already used by `findParents`.
- **Deletion propagates bidirectional reference cleanup.** When a record is deleted, its URI is removed from parents' `_children` arrays and from children's `_parents` arrays using the same `$pull` + `$dec` atomic helper. This is reference cleanup — related records survive; only stale URI references are removed.

### Field contract summary

| Field | Client-writable | Visible in responses | Managed by |
|---|---|---|---|
| `_parents` | ✅ (single-record writes only) | ✅ | Client-supplied; server enforces URI format |
| `_parentsCount` | ❌ (STRICTLY_INTERNAL) | ❌ (ALWAYS_HIDDEN) | `setCountFields` — mirrors `_parents.length` |
| `_children` | ❌ (excluded from write schemas + sanitized) | ✅ | Native `updateOne` bookkeeping — `$addToSet`/`$pull` |
| `_childrenCount` | ❌ (STRICTLY_INTERNAL) | ❌ (ALWAYS_HIDDEN) | Native `updateOne` bookkeeping — `$inc`/`$dec` |

---

## Sub-Task 1: `unmodifiable-common-fields.ts` — Add `_childrenCount` and `IDEMPOTENCY_EXCLUDED_FIELDS`

**Intent:** Extend the central field-classification module with the new fields and a new export that prevents operator-configured idempotency fields from including server-managed values.

**Expected Outcomes:**
- `_childrenCount` is added to `STRICTLY_INTERNAL_FIELDS` and `ALWAYS_HIDDEN_FIELDS`, making it auto-excluded from all `getModelSchemaRef` exclude lists that reference those arrays, and auto-excluded from aggregation pipeline output via the pipeline helper.
- A new exported constant `IDEMPOTENCY_EXCLUDED_FIELDS` lists every field that must never contribute to the idempotency hash regardless of operator configuration.

**Todo List:**
1. In [`src/models/base-types/unmodifiable-common-fields.ts`](../../src/models/base-types/unmodifiable-common-fields.ts):
   - Add `'_childrenCount'` to `STRICTLY_INTERNAL_FIELDS`.
   - Add `'_childrenCount'` to `ALWAYS_HIDDEN_FIELDS`.
   - Add a new exported constant `IDEMPOTENCY_EXCLUDED_FIELDS` containing all server-managed and cross-record bookkeeping fields that must never be used as idempotency contributors: `'_id'`, `'_children'`, `'_childrenCount'`, `'_parents'`, `'_parentsCount'`, `'_version'`, `'_idempotencyKey'`, `'_slug'`, `'_createdDateTime'`, `'_lastUpdatedDateTime'`, `'_lastUpdatedBy'`, `'_ownerUsersCount'`, `'_ownerGroupsCount'`, `'_viewerUsersCount'`, `'_viewerGroupsCount'`.
   - Export a corresponding TypeScript type `IdempotencyExcludedFields`.

**Relevant Context:**
- The existing pattern for the other constants in this file is the exact template.
- `_childrenCount` follows the same classification as `_parentsCount` (line 8 in `STRICTLY_INTERNAL_FIELDS`, line 34 in `ALWAYS_HIDDEN_FIELDS`).
- The `IDEMPOTENCY_EXCLUDED_FIELDS` list is used in Sub-Task 5.

**Status:** `[x] done`

---

## Sub-Task 2: Model Changes — Add `_children` and `_childrenCount` to All Models

**Intent:** Declare `_children` and `_childrenCount` on all models so that TypeScript and LoopBack schema generation are aware of them.

**Expected Outcomes:**
- `ListEntityCommonBase` has a `_childrenCount` `@property` (`type: 'number'`, `default: 0`, `hidden: true`) and a TypeScript-only `_children?: string[]` annotation (no `@property` decorator — mirrors the `_parents` type-only declaration at line 75 of the same file).
- `ReactionsCommonBase` has the same two additions.
- `GenericEntity`, `List`, `EntityReaction`, and `ListReaction` each declare `_children` with a `@property` decorator, `type: 'array'`, `itemType: 'string'`, and `jsonSchema.pattern` matching their own collection URI pattern with `uniqueItems: true`.

**Todo List:**
1. In [`src/models/base-models/list-entity-common-base.model.ts`](../../src/models/base-models/list-entity-common-base.model.ts):
   - Add `@property({ type: 'number', default: 0, hidden: true }) _childrenCount?: number;` after the `_parentsCount` property (line 68).
   - Add TypeScript-only `_children?: string[];` annotation after `_parentsCount` (mirroring the `_parents` declaration at line 75).
2. In [`src/models/base-models/reactions-common-base.model.ts`](../../src/models/base-models/reactions-common-base.model.ts): apply the same two additions after `_parentsCount`.
3. In [`src/models/entity.model.ts`](../../src/models/entity.model.ts): add a `@property` for `_children` after the `_parents` property (line 28), using the same URI pattern as `_parents` but for the `entities` segment: `^tapp://localhost/entities/{uuid}$`.
4. In [`src/models/list.model.ts`](../../src/models/list.model.ts): same, with `lists` segment.
5. In [`src/models/entity-reactions.model.ts`](../../src/models/entity-reactions.model.ts): same, with `entity-reactions` segment.
6. In [`src/models/list-reactions.model.ts`](../../src/models/list-reactions.model.ts): same, with `list-reactions` segment.

**Relevant Context:**
- `_parents` `@property` in each concrete model (entity: lines 19–28, list: lines 29–38, entity-reactions: lines 22–31, list-reactions: lines 22–31) is the exact template for `_children`.
- `_parentsCount` `@property` in the base models (`hidden: true`) is the exact template for `_childrenCount`.
- `_children` has no `@property` in the base models — same as `_parents` — because the URI pattern is type-specific and must be declared on each concrete model.

**Status:** `[x] done`

---

## Sub-Task 3: ~~Removed — `virtualFields` is not the right mechanism~~

**Note:** This sub-task was removed. `_parentsCount`, `_childrenCount`, and `_children` are real persisted fields that must be written to MongoDB — they must not be added to `virtualFields`. `virtualFields` is exclusively for response-only computed fields that are never stored (`_recordType`, `_relationMetadata`, etc.). The enforcement for these fields is:

- `_parentsCount` / `_childrenCount`: in `STRICTLY_INTERNAL_FIELDS` → auto-excluded from all request body schemas. The server sets them via `setCountFields` and the native `updateOne` bookkeeping helpers respectively.
- `_children`: excluded from all write body schemas explicitly at the controller level (Sub-Task 4). No repository-level stripping needed or appropriate.

**Status:** `[x] n/a — removed`

---

## Sub-Task 4: Controller Schema Exclusions — Exclude `_children` from All Write Endpoints

**Intent:** Prevent clients from supplying `_children` in any request body. `_childrenCount` is already auto-excluded by being in `STRICTLY_INTERNAL_FIELDS` (added in Sub-Task 1). `_children` is not in that list and must be explicitly added to each write endpoint's exclude array.

**Expected Outcomes:**
- `_children` does not appear in the OpenAPI request body schema for any create, update, replace, or createChild endpoint.
- `_children` and `_childrenCount` DO appear in GET response schemas.
- `_parents` is also excluded from `updateAll` (bulk PATCH) endpoints across all four core controllers and through-controllers where it appears, to close the bulk-update inconsistency.

**Todo List:**

**Core controllers — 4 files:**

For each of [`entities.controller.ts`](../../src/controllers/entities.controller.ts), [`lists.controller.ts`](../../src/controllers/lists.controller.ts), [`entity-reactions.controller.ts`](../../src/controllers/entity-reactions.controller.ts), [`list-reactions.controller.ts`](../../src/controllers/list-reactions.controller.ts):

1. `POST /{segment}` (create): add `'_children'` to the exclude array alongside `STRICTLY_INTERNAL_FIELDS`.
2. `PATCH /{segment}` (updateAll): add `'_children'` and `'_parents'` to the exclude array alongside `UPDATE_EXCLUDED_FIELDS`.
3. `PATCH /{segment}/{id}` (updateById): add `'_children'` to the exclude array.
4. `PUT /{segment}/{id}` (replaceById): add `'_children'` to the exclude array.
5. `POST /{segment}/{id}/children` (createChild): add `'_children'` to the exclude array (already excludes `_parents`).

**Through-controllers — 3 files:**

6. [`entities-through-list.controller.ts`](../../src/controllers/entities-through-list.controller.ts):
   - `POST /lists/{id}/entities` (line 229): add `'_children'` to the exclude array (currently `STRICTLY_INTERNAL_FIELDS`).
   - `PATCH /lists/{id}/entities` (updateAll body, line ~286): add `'_children'` and `'_parents'` to the exclude array (currently `UPDATE_EXCLUDED_FIELDS`).
7. [`reactions-through-entity.controller.ts`](../../src/controllers/reactions-through-entity.controller.ts):
   - `POST /entities/{id}/reactions` (line 211): add `'_children'` to the exclude array (currently `STRICTLY_INTERNAL_FIELDS`).
   - `PATCH /entities/{id}/reactions` (line 294): add `'_children'` and `'_parents'` to the exclude array (currently `UPDATE_EXCLUDED_FIELDS`).
8. [`reactions-through-list.controller.ts`](../../src/controllers/reactions-through-list.controller.ts):
   - `POST /lists/{id}/reactions` (line 211): add `'_children'` to the exclude array (currently `[...STRICTLY_INTERNAL_FIELDS, '_listId']`).
   - `PATCH /lists/{id}/reactions` (line 284): add `'_children'` and `'_parents'` to the exclude array (currently `[...UPDATE_EXCLUDED_FIELDS, '_listId']`).

**Relevant Context:**
- `_childrenCount` does not need to be added explicitly to any exclude array — it is now in `STRICTLY_INTERNAL_FIELDS` (Sub-Task 1) and is auto-excluded wherever that array is spread.
- `lists-through-entity.controller.ts` has only GET endpoints — no changes needed.

**Status:** `[x] done`

---

## Sub-Task 5: `calculateIdempotencyKey` — Filter Against `IDEMPOTENCY_EXCLUDED_FIELDS`

**Intent:** Prevent operator-configured idempotency fields from accidentally including server-managed fields. If an operator configures `_children`, `_childrenCount`, `_parentsCount`, `_version`, or any other managed field as an idempotency contributor, the service must silently discard those fields from the hash calculation and log a warning.

**Expected Outcomes:**
- `calculateIdempotencyKey` in both base repositories filters the operator-configured field list against `IDEMPOTENCY_EXCLUDED_FIELDS` before computing the hash.
- If any fields are filtered out, a warning is logged listing the discarded field names.
- Idempotency semantics are preserved: only content fields ever contribute to the hash.

**Todo List:**
1. In [`src/repositories/base/entity-persistence-business.repository.ts`](../../src/repositories/base/entity-persistence-business.repository.ts) `calculateIdempotencyKey` (lines 662–668):
   - Import `IDEMPOTENCY_EXCLUDED_FIELDS` from `unmodifiable-common-fields`.
   - After getting `rawFields` from `getIdempotencyFields(kind)`, filter: `const safeFields = rawFields.filter(f => !IDEMPOTENCY_EXCLUDED_FIELDS.includes(f))`.
   - If `safeFields.length < rawFields.length`, log a warning with the filtered-out field names using `this.loggingService.warn(...)`.
   - Pass `safeFields` (not `rawFields`) to `calculateIdempotencyKeyFromFields`.
2. In [`src/repositories/base/entity-persistence-reaction.repository.ts`](../../src/repositories/base/entity-persistence-reaction.repository.ts) `calculateIdempotencyKey` (lines 1127–1147): apply the identical change — filter `idempotencyFields` against `IDEMPOTENCY_EXCLUDED_FIELDS` before the hash loop.

**Relevant Context:**
- `IDEMPOTENCY_EXCLUDED_FIELDS` is defined in Sub-Task 1.
- The existing warning log pattern in both repositories (e.g. `this.loggingService.warn(...)`) should be used.
- The business repository's `calculateIdempotencyKey` delegates to `calculateIdempotencyKeyFromFields`; the reaction repository inlines the hash loop. Both need the filter applied before hashing.

**Status:** `[x] done`

---

## Sub-Task 6: Base Repository Helper Methods — `addChildReference`, `removeChildReference`, `removeParentReference`

**Intent:** Provide atomic, race-safe methods for maintaining `_children`, `_childrenCount`, and `_parents` bookkeeping on parent and child records using native MongoDB update operators. These methods bypass the standard `updateById` path intentionally — they must not increment `_version`, recalculate idempotency, or re-validate business rules.

**Expected Outcomes:**
- Three new protected methods exist on both `EntityPersistenceBusinessRepository` and `EntityPersistenceReactionRepository`.
- Each method issues a single `collection.updateOne` with `$addToSet`/`$pull` + `$inc`/`$dec` + `$set` for `_lastUpdatedDateTime`.
- The MongoDB `ClientSession` from `options` is passed to `updateOne`, so the call participates in the active transaction.
- `_version` is never touched. `_lastUpdatedBy` is never touched.

**Todo List:**

For both [`src/repositories/base/entity-persistence-business.repository.ts`](../../src/repositories/base/entity-persistence-business.repository.ts) and [`src/repositories/base/entity-persistence-reaction.repository.ts`](../../src/repositories/base/entity-persistence-reaction.repository.ts), add three protected methods:

1. `addChildReference(parentId: string, childUri: string, options?: Options): Promise<void>`
   ```
   collection.updateOne(
     { _id: parentId },
     {
       $addToSet: { _children: childUri },
       $inc: { _childrenCount: 1 },
     },
     { session: options?.session }
   )
   ```

2. `removeChildReference(parentId: string, childUri: string, options?: Options): Promise<void>`
   ```
   collection.updateOne(
     { _id: parentId },
     {
       $pull: { _children: childUri },
       $inc: { _childrenCount: -1 },
     },
     { session: options?.session }
   )
   ```

3. `removeParentReference(childId: string, parentUri: string, options?: Options): Promise<void>`
   ```
   collection.updateOne(
     { _id: childId },
     {
       $pull: { _parents: parentUri },
       $inc: { _parentsCount: -1 },
     },
     { session: options?.session }
   )
   ```

For accessing the collection, follow the exact pattern already in the reaction repository (lines 221–223):
```typescript
const collection = this.dataSource.connector?.collection(
  this.entityClass.modelName,
);
```
`this.dataSource` is a public property inherited from `DefaultCrudRepository` (typed as `juggler.DataSource` in `legacy-juggler-bridge.d.ts` line 40) and is accessible in both base repositories.

**Relevant Context:**
- The reaction repository already uses `this.dataSource.connector?.collection()` at lines 221–223, 263–265, 354–356, 644–646.
- Session passing pattern: `{ session: (options as any)?.session }` — matching the pattern at reaction repository line 363–366.
- `$addToSet` is preferred over `$push` because it is idempotent — duplicate URIs are never inserted, which is safe if the transaction retries.
- The business repository does not currently use `this.dataSource.connector` directly but it is available via inheritance.

**Status:** `[ ] pending`

---

## Sub-Task 7: `setCountFields` — Remove `_parentsCount` and `_childrenCount` from In-Memory Derivation for Bookkeeping Paths

**Intent:** `setCountFields` currently derives `_parentsCount` from `_parents.length` on every write. After this change, `_parentsCount` and `_childrenCount` on parent/child records are maintained via `$inc`/`$dec` in the atomic helper methods (Sub-Task 6). `setCountFields` must still derive them for the record being directly written (i.e. when a client supplies `_parents` in a POST/PATCH/PUT body) — but must not interfere with the bookkeeping path. No change is needed here: `setCountFields` only runs on the data object being saved for the record under operation, not on referenced parent or child records. The `$inc`/`$dec` in the bookkeeping helpers is separate. This sub-task is a verification step, not a code change.

**Expected Outcomes:**
- Confirm `setCountFields` in both base repositories continues to derive `_parentsCount` from `_parents.length` when `_parents` is present in the data being written. This is correct for the record itself.
- No `_childrenCount` derivation is added to `setCountFields` — `_childrenCount` is maintained exclusively via `$inc`/`$dec` in the bookkeeping helpers, never via `setCountFields`. Adding it to `setCountFields` would be wrong: the incoming data object for a write does not contain the full `_children` array (that lives on the stored document, not in write payloads).
- Verify that `_children` is stripped before `setCountFields` is called, so `setCountFields` will never see `_children` in write data.

**Todo List:**
1. Read `setCountFields` in both repositories (business: lines 696–718; reaction: lines 1000–1022) and confirm no `_childrenCount` block needs to be added.
2. No code changes required if the above is confirmed.

**Relevant Context:**
- `setCountFields` is called inside `modifyDataForCreation` (business line 448) and `modifyDataForUpdates` (business line 517) and equivalent reaction paths.
- The incoming `data` at those points never contains `_children` (stripped by `sanitizeRecordType` before `setCountFields` runs).

**Status:** `[ ] pending`

---

## Sub-Task 8: `createChild` — Update Parent's `_children` After Child Creation

**Intent:** After creating a child record, atomically update the parent's `_children` array and `_childrenCount` using the new bookkeeping helpers. This is the primary write path for hierarchy establishment.

**Expected Outcomes:**
- After `POST /{parentId}/children`, the parent's `_children` array contains the new child's URI.
- The parent's `_childrenCount` is incremented by 1.
- Both operations are within the same MongoDB transaction session.
- The parent existence check already performed by `findById` / `findByIdRaw` is not repeated.

**Todo List:**
1. In [`EntityPersistenceBusinessRepository.createChild`](../../src/repositories/base/entity-persistence-business.repository.ts) (lines 1143–1167):
   - After `const created = await this.create(childData, options)` resolves, build the child URI: `const childUri = this.buildParentUri(created._id as string)`.
   - Call `await this.addChildReference(parentId, childUri, options)`.
   - Return `created`.
2. In [`EntityPersistenceReactionRepository.createChild`](../../src/repositories/base/entity-persistence-reaction.repository.ts) (lines 909–955):
   - After `const created = await this.create(childReaction, options)` resolves, build the child URI: `const childUri = this.buildParentUri((created as any)._id as string)`.
   - Call `await this.addChildReference(parentId, childUri, options)`.
   - Return `created`.

**Relevant Context:**
- `buildParentUri(id)` constructs `tapp://localhost/{uriPathSegment}/{id}` (business repository line 1025–1027). The same method is used for child URIs because all records of the same type share the same segment.
- The `options` object already carries `{ session: ClientSession }` — passing it to `addChildReference` keeps both calls in the same transaction.

**Status:** `[ ] pending`

---

## Sub-Task 9: `create` / `updateById` / `replaceById` — Diff `_parents` and Update Affected Parents

**Intent:** When `_parents` changes on a record via the base create/update paths, compute the diff of added and removed parent URIs and call `addChildReference` / `removeChildReference` on each affected parent.

**Expected Outcomes:**
- `POST /{segment}` with `_parents` in the body: each named parent gains the new record's URI in its `_children` array and `_childrenCount` is incremented. Old parents is treated as empty (`[]`) — there are none to remove.
- `PATCH /{id}` or `PUT /{id}` with `_parents` added to: each newly referenced parent gains the record's URI in its `_children` and `_childrenCount` is incremented.
- `PATCH /{id}` or `PUT /{id}` with `_parents` removed from: each no-longer-referenced parent has the record's URI removed from its `_children` via `removeChildReference` and `_childrenCount` is decremented.
- `PATCH /{id}` or `PUT /{id}` where `_parents` is replaced entirely: removed URIs are cleaned up on former parents, added URIs are registered on new parents.
- If `_parents` is not present in the write payload, no diff is computed and no bookkeeping calls are made.
- All bookkeeping calls share the active transaction session.

**Todo List:**

**Business repository:**

1. Add a protected helper `syncParentChildReferences(recordUri: string, oldParents: string[], newParents: string[], options?: Options): Promise<void>`:
   - Compute `added = newParents.filter(p => !oldParents.includes(p))`.
   - Compute `removed = oldParents.filter(p => !newParents.includes(p))`.
   - For each URI in `added`: extract the parent ID from the URI (`uri.split('/').pop()`), call `await this.addChildReference(parentId, recordUri, options)`.
   - For each URI in `removed`: extract the parent ID, call `await this.removeChildReference(parentId, recordUri, options)`.

2. In `create` (line 270): after `createRecordFacade` returns the created record, if `(data as any)._parents` is a non-empty array, call `syncParentChildReferences(recordUri, [], data._parents, options)` where `recordUri = this.buildParentUri(created._id)`.

3. In `modifyDataForUpdates` (line 488), the existing `existingData` fetch already gives us `existingData._parents`. Store this as part of the return value — change the return type to also include `oldParents: string[]`. Pass it through to `updateById` and `replaceById`.

4. In `updateById` (line 324): after `super.updateById(id, validEnrichedData, options)` completes, if `data._parents` is present, compute `recordUri = this.buildParentUri(id)` and call `syncParentChildReferences(recordUri, collection.oldParents ?? [], data._parents, options)`.

5. In `replaceById` (line 298): same as updateById — after `super.replaceById` completes, sync if `data._parents` is present.

**Reaction repository:** Apply the same pattern — `syncParentChildReferences` helper, and post-write sync calls in `create`, `updateById`, `replaceById`.

**Relevant Context:**
- `modifyDataForUpdates` already fetches `existingData` (line 496) — `existingData._parents` is available at no extra cost.
- `buildParentUri(id)` is available on both base repositories.
- `options` carries the session throughout.

**Status:** `[ ] pending`

---

## Sub-Task 10: `findChildren` — Replace Reverse Scan with Forward Lookup

**Intent:** Replace the current `{ _parents: uri }` reverse scan with a forward lookup that reads `_children` from the parent document and queries `{ _id: { inq: childIds } }`, mirroring the structure of `findParents`.

**Expected Outcomes:**
- `findChildren` reads `_children` from the parent document via `findById`.
- Early-returns `[]` if `_children` is absent or empty.
- Queries `{ _id: { inq: childIds } }` combined with the caller-supplied filter.
- 404 if the parent does not exist (thrown by `findById`).

**Todo List:**
1. In [`EntityPersistenceBusinessRepository.findChildren`](../../src/repositories/base/entity-persistence-business.repository.ts) (lines 1096–1132): replace the method body with the forward-lookup pattern using `findParents` (lines 1040–1085) as the structural template:
   - `findById(id, { fields: { _children: true } })` — throws 404 if parent missing.
   - Early return `[]` if `record._children` is absent or empty.
   - `childIds = record._children.map((uri: string) => uri.split('/').pop())`.
   - Build `childFilter` merging `{ _id: { inq: childIds } }` with `filter?.where`.
   - Return `await this.find(childFilter, options)`.
2. In [`EntityPersistenceReactionRepository.findChildren`](../../src/repositories/base/entity-persistence-reaction.repository.ts) (lines 871–904): apply the same replacement, but preserve the reaction `find` signature: `this.find(childFilter, sourceFilter, { useMongoPipeline: false, ...options })`, matching the call in `findParents` at lines 862–865.

**Relevant Context:**
- The current reverse scan `{ _parents: uri }` (business repo line 1114; reaction repo line 889) is replaced entirely.
- `findParents` in both repositories is the exact structural template.

**Status:** `[ ] pending`

---

## Sub-Task 11: `deleteById` and `deleteAll` — Bidirectional Reference Cleanup

**Intent:** When a record is deleted, atomically remove its URI from its parents' `_children` arrays and its children's `_parents` arrays. This is reference cleanup only — no cascade deletion. The existing delete implementations at multiple layers must be **augmented**, not replaced.

**Expected Outcomes:**
- Deleting a record removes its URI from every parent's `_children` (via `removeChildReference`) and from every child's `_parents` (via `removeParentReference`).
- `_childrenCount` on each parent and `_parentsCount` on each child stay accurate via `$dec` inside the helper methods.
- All existing cascade-delete logic (relation and reaction deletion in `EntityRepository` and `ListRepository`) is preserved unchanged.
- All cleanup operations run within the same `@transactional()` session already open on `deleteById`/`deleteAll` controller endpoints.

**Existing delete implementations (do not modify these):**

- `EntityRepository.deleteById` (line 176): cascades relation + reaction deletes, then calls `super.deleteById`.
- `EntityRepository.deleteAll` (line 190): collects IDs, bulk-deletes relations and reactions, then calls `super.deleteAll`.
- `ListRepository.deleteById` (line 197): same pattern for lists.
- `ListRepository.deleteAll` (line 211): same pattern for lists.
- `EntityPersistenceReactionRepository.deleteById` (line 795): verifies existence via `findById`, then calls `super.deleteById`.
- `EntityPersistenceReactionRepository.deleteAll` (line 805): logs, then calls `super.deleteAll`.

**Todo List:**

**Business base repository (`EntityPersistenceBusinessRepository`) — new overrides:**

1. Add a protected method `cleanupHierarchyReferences(id: string, options?: Options): Promise<void>`:
   - `const record = await this.findById(id, { fields: { _id: true, _parents: true, _children: true } }, options)`.
   - For each URI in `record._parents ?? []`: extract the parent ID (`uri.split('/').pop()`), call `await this.removeChildReference(parentId, this.buildParentUri(id), options)`.
   - For each URI in `record._children ?? []`: extract the child ID, call `await this.removeParentReference(childId, this.buildParentUri(id), options)`.

2. Add a new `deleteById` override to the business base (this class has no `deleteById` today — this is a new method, not a replacement):
   ```typescript
   async deleteById(id: IdType, options?: Options): Promise<void> {
     await this.cleanupHierarchyReferences(id as string, options);
     return super.deleteById(id, options);
   }
   ```
   After this is added, the call chain for entities becomes:
   `EntityRepository.deleteById` → cascade deletes → `super.deleteById` → `EntityPersistenceBusinessRepository.deleteById` → hierarchy cleanup → `super.deleteById` → `DefaultTransactionalRepository.deleteById` → actual MongoDB delete.
   The concrete `EntityRepository` and `ListRepository` require **no changes**.

3. Add a new `deleteAll` override to the business base (this class has no `deleteAll` today — new method, not a replacement):
   ```typescript
   async deleteAll(where?: Where<E>, options?: Options): Promise<Count> {
     const records = await this.find(
       { where, fields: { _id: true, _parents: true, _children: true } as any },
       options,
     );
     for (const record of records) {
       await this.cleanupHierarchyReferences(record._id as string, options);
     }
     return super.deleteAll(where, options);
   }
   ```
   Same chain reasoning: `EntityRepository.deleteAll` → cascade deletes → `super.deleteAll` → `EntityPersistenceBusinessRepository.deleteAll` → hierarchy cleanup per record → `super.deleteAll` → `DefaultTransactionalRepository.deleteAll`.

**Reaction base repository (`EntityPersistenceReactionRepository`) — augment existing methods:**

4. Add the same `cleanupHierarchyReferences` helper method.

5. **Augment** the existing `deleteById` (lines 795–800) — add `cleanupHierarchyReferences` call before the existing `super.deleteById`. The existing existence check (`findById`) stays in place:
   ```typescript
   async deleteById(id: IdType, options?: Options): Promise<void> {
     await this.findById(id, undefined, options);        // existing — keep
     await this.cleanupHierarchyReferences(id as string, options); // new
     return super.deleteById(id, options);               // existing — keep
   }
   ```

6. **Augment** the existing `deleteAll` (lines 805–814) — fetch matching records, run `cleanupHierarchyReferences` per record, then call the existing `super.deleteAll`. The existing log statement stays:
   ```typescript
   async deleteAll(where?: Where<E>, options?: Options): Promise<Count> {
     this.loggingService.debug(...);                     // existing — keep
     const records = await this.find(                   // new
       { where, fields: { _id: true, _parents: true, _children: true } as any },
       options,
     );
     for (const record of records) {                    // new
       await this.cleanupHierarchyReferences((record as any)._id, options);
     }
     return super.deleteAll(where, options);             // existing — keep
   }
   ```

**Relevant Context:**
- All four `deleteById` controller endpoints are decorated with `@transactional()`, so `options` carries the active session throughout the entire chain.
- `EntityPersistenceBusinessRepository` currently has no `deleteById` or `deleteAll` of its own — the new methods are purely additive.
- The reaction base owns its delete methods directly; they are augmented in place, not replaced.
- The prototype chain after this change: `EntityRepository → EntityPersistenceBusinessRepository → EntityPersistenceBaseRepository → DefaultTransactionalRepository`. The new business-base `deleteById`/`deleteAll` sit between the concrete repos and the LoopBack base.

**Status:** `[ ] pending`

---

## Sub-Task 12: MongoDB Pipeline Helper — Add `_childrenCount` to `$project` Exclusion

**Intent:** The aggregation pipeline helper appends a `$project` stage to strip `ALWAYS_HIDDEN_FIELDS`. `_childrenCount` is now in `ALWAYS_HIDDEN_FIELDS` (Sub-Task 1), so it must be excluded in the pipeline output to match.

**Expected Outcomes:**
- The `$project` stage in [`src/extensions/utils/mongo-pipeline-helper.ts`](../../src/extensions/utils/mongo-pipeline-helper.ts) (lines 526–535) includes `_childrenCount: 0` alongside the existing count field exclusions.

**Todo List:**
1. In the `$project` stage block (lines 526–535), add `_childrenCount: 0` to the exclusion object.

**Relevant Context:**
- Current exclusions: `_ownerUsersCount`, `_ownerGroupsCount`, `_viewerUsersCount`, `_viewerGroupsCount`, `_parentsCount` — all `ALWAYS_HIDDEN_FIELDS`. `_childrenCount` joins this list.

**Status:** `[ ] pending`

---

## Sub-Task 13: Acceptance Tests — Verify `findChildren` Works via Both Creation Paths

**Intent:** `get-entity-children.test.ts` and `get-list-children.test.ts` currently create child records by POSTing `_parents` directly to `POST /entities` / `POST /lists`. After Sub-Task 9, the direct-POST path correctly populates the parent's `_children` array via `syncParentChildReferences`. After Sub-Task 10, `findChildren` uses the forward `_children` lookup. The existing tests therefore do not need to be migrated — they exercise the direct-POST path and will continue to work. The task is to confirm this and add explicit coverage for both creation paths.

**Expected Outcomes:**
- All existing `it()` blocks in `get-entity-children.test.ts` and `get-list-children.test.ts` pass without modification.
- A new test case in each file verifies that a child created via `POST /{parentId}/children` also appears in `GET /{parentId}/children` (covering the `/children` endpoint path).
- A new test case confirms that a child created via `POST /entities` with `_parents` in the body also appears in `GET /{parentId}/children` (covering the direct-POST path).

**Todo List:**
1. Run the existing `get-entity-children.test.ts` and `get-list-children.test.ts` tests after Sub-Tasks 9 and 10 are complete. Confirm they all pass with no changes.
2. In [`src/__tests__/acceptance/entity/get-entity-children.test.ts`](../../src/__tests__/acceptance/entity/get-entity-children.test.ts): add a test case that creates a child via `POST /entities/{parentId}/children` and asserts it appears in `GET /entities/{parentId}/children`.
3. In [`src/__tests__/acceptance/list/get-list-children.test.ts`](../../src/__tests__/acceptance/list/get-list-children.test.ts): add the equivalent test for lists.

**Status:** `[ ] pending`

---

## Sub-Task 14: Acceptance Tests — Add `_children` and `_childrenCount` Assertions to `createChild` Tests

**Intent:** The existing `create-child-entity.test.ts` and `create-child-list.test.ts` verify the child's `_parents` but do not check that the parent's `_children` and `_childrenCount` are updated.

**Expected Outcomes:**
- After `POST /{parentId}/children`, a subsequent `GET /{parentId}` returns `_children` containing the child URI and `_childrenCount` is not present (hidden).
- The existing assertions (`_parents`, `_slug`, `_id`, etc.) continue to pass.

**Todo List:**
1. In [`src/__tests__/acceptance/entity/create-child-entity.test.ts`](../../src/__tests__/acceptance/entity/create-child-entity.test.ts): after existing assertions, add `GET /entities/{parentId}` and assert `response.body._children` is an array of length 1 containing `tapp://localhost/entities/{childId}`, and `response.body._childrenCount` is `undefined` (hidden field not in response).
2. In [`src/__tests__/acceptance/list/create-child-list.test.ts`](../../src/__tests__/acceptance/list/create-child-list.test.ts): apply the same pattern for lists.

**Status:** `[ ] pending`

---

## Sub-Task 15: Unit Tests — Repository-Level Tests for New Behaviour

**Intent:** Add unit tests for `findChildren` forward lookup, `createChild` parent update, deletion cleanup, and the idempotency field filter.

**Expected Outcomes:**
- `findChildren`: returns `[]` when `_children` absent; returns correct records for known child IDs; throws 404 when parent not found.
- `createChild`: `addChildReference` is called with correct parentId and childUri after child creation.
- `deleteById`: `cleanupHierarchyReferences` is called; `removeChildReference` called for each parent; `removeParentReference` called for each child.
- `calculateIdempotencyKey`: managed fields in the configured list are filtered out; warning is logged.

**Todo List:**
1. In [`src/__tests__/unit/repositories/entity.repository.test.ts`](../../src/__tests__/unit/repositories/entity.repository.test.ts): add `describe` blocks for each behaviour above.
2. In [`src/__tests__/unit/repositories/list.repository.test.ts`](../../src/__tests__/unit/repositories/list.repository.test.ts): apply the same blocks.

**Relevant Context:**
- Existing tests stub methods at the prototype chain using `getBaseRepoPrototype()` — follow this exact pattern.

**Status:** `[ ] pending`

---

## Sub-Task 16: Documentation

**Intent:** Update all relevant documentation to reflect the new fields, changed behaviour, and design decisions.

**Expected Outcomes:** See todo list.

**Todo List:**

**`.context/20-FEATURES-HIERARCHY.md`:**
1. Concept section: add that each parent also carries `_children` (server-managed, forward-traversal) and `_childrenCount` (hidden, query optimisation).
2. `POST /{id}/children` description: note it atomically updates the parent's `_children` and `_childrenCount`.
3. `GET /{id}/children` description: update to note children are resolved via the parent's `_children` forward-lookup array. Note that `_children` is populated by any write path that sets `_parents` — both `POST /{id}/children` and direct `POST`/`PATCH`/`PUT` with `_parents` in the body.
4. Data Model: add `_children` subsection (server-managed, read-only, same URI format as `_parents`). Document both population paths: `POST /{id}/children` (the dedicated endpoint) and `POST /{segment}` with `_parents` in the body (the direct path, where `syncParentChildReferences` handles the side-effect). Note that `PATCH /{id}` and `PUT /{id}` also keep `_children` consistent when `_parents` changes.
5. Data Model: add `_childrenCount` subsection (always hidden, mirrors `_children.length`, contrast with `_parentsCount`).
6. Data Model — `_parentsCount` subsection: note the distinction from `_childrenCount` (hidden vs visible was discussed but ultimately both are hidden).
7. Transactional Context: add `deleteById`/`deleteAll` as transactional; describe bidirectional reference cleanup.
8. Replace "Children Query: Current Approach and Its Trade-offs" section with "Children Query: Forward Lookup" — describe the `_children`-based approach and its consistency contract.
9. Add "Deletion and Reference Cleanup" section.
10. Update Tests table and Related Files table.
11. Remove stale cross-reference to `21-IMPLEMENTATION-CHILDREN-FIELD.md`.

**`README.md`:**
12. Managed Fields table: add rows for `_children` and `_childrenCount` after the `_parentsCount` row (line 1372).
13. Strictly Managed Fields footnote (line 1384): add `_childrenCount`.
14. Always Hidden Fields footnote (line 1390): add `_childrenCount`.
15. Known Limitations section (line 1929): add a new limitation note — "`_parents` cannot be included in bulk `PATCH /{segment}` request bodies" — with explanation (same reasoning as the `_version`/updateAll note).

**New `.context/30-FEATURES-IDEMPOTENCY.md`:**
16. Create this file. Document: how idempotency keys are calculated; which fields are excluded by design and why (the `IDEMPOTENCY_EXCLUDED_FIELDS` list); specific note that `_children`/`_childrenCount` follow the same exclusion contract as `_parentsCount` — they represent cross-record state, not record content; note that `_version` is not modified by hierarchy bookkeeping `updateOne` operations.

**Status:** `[ ] pending`

---

## Implementation Order

```
Sub-Task 1  (unmodifiable-common-fields)
    ↓
Sub-Task 2  (model changes)
    ↓
Sub-Task 3  (virtualFields sanitization)
    ↓
Sub-Task 4  (controller schema exclusions)
    ↓
Sub-Task 5  (idempotency field filter)
    ↓
Sub-Task 6  (bookkeeping helper methods)
    ↓
Sub-Task 7  (setCountFields verification — no code change)
    ↓
Sub-Task 8  (createChild update parent)
    ↓
Sub-Task 9  (create/updateById/replaceById diff sync)
    ↓
Sub-Task 10 (findChildren forward lookup)
    ↓
Sub-Task 11 (deleteById/deleteAll cleanup)
    ↓
Sub-Task 12 (pipeline helper)
    ↓
Sub-Tasks 13, 14, 15 (test changes — in parallel)
    ↓
Sub-Task 16 (documentation)
```

Sub-Tasks 13–15 can be done in any order after Sub-Tasks 10–12 are complete.
Sub-Task 16 is best done last so it reflects the final implemented state.
