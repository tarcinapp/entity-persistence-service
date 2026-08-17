# Hierarchy Feature

## Concept

Records in this service can be organised into parent-child hierarchies. Any list, entity, entity-reaction, or list-reaction can be declared a child of one or more records of the same type. This makes it possible to model naturally nested structures: chapter entities inside a book entity, sublists inside a reading list, threaded comment reactions nested under a top-level comment reaction, and so on.

The hierarchy is intentionally flexible:

- A record can have zero, one, or many parents of the same type.
- A record can have zero, one, or many children.
- There is no enforced depth limit. Trees and directed acyclic graphs (DAGs) are both supported.
- There is no requirement that records form a single root. A collection can contain multiple disconnected trees or isolated root nodes.

A record with no parents is called a **root**. A record with no children is a **leaf**. A record can be both (a standalone record) or neither (a node somewhere in the middle of a deep DAG).

Each child record carries its parent references in `_parents`. Each parent record carries its children references in `_children`, maintained automatically by the server. `_childrenCount` mirrors `_children.length` but is always hidden from responses — its sole purpose is server-side query optimisation (powering a future `leaves` set filter).

This feature intentionally does not express hierarchy through separate relationship records (the list-to-entity pivot table). This keeps hierarchy reads cheap: a single document fetch returns the full ancestry or child list.

See the main README for related guidance on hierarchical modeling under [Build Hierarchical Structures Across Models](../README.md#build-hierarchical-structures-across-models).

## API Operations

All four record types expose the same three hierarchy endpoints. The path segment varies by type: `entities`, `lists`, `entity-reactions`, or `list-reactions`.

### Creating a child record

```
POST /{segment}/{id}/children
```

Creates a new record and automatically links it as a child of the record identified by `{id}`. The client provides the same fields as a normal creation request. The `_parents` field is not part of the request body: the server constructs and injects it from the path parameter.

The operation verifies that the parent record exists before creating the child, and the two steps run atomically inside a MongoDB transaction. After the child is created, the server atomically adds the child's URI to the parent's `_children` array and increments the parent's `_childrenCount` — all within the same transaction. If the parent does not exist the request returns 404. For reaction types, the operation additionally validates that the child's source-record field (`_entityId` or `_listId`) matches the parent's, because a reaction hierarchy must stay bound to the same source record.

### Fetching parents

```
GET /{segment}/{id}/parents
```

Returns the full records of all parents of the given record. The response is an array of records in the same format as the standard list endpoint for that type. If the record has no parents, the response is an empty array.

All standard query parameters are supported: `filter`, `set`, field selection, and lookups. This allows callers to, for example, retrieve only active parents (`filter[where][_validFromDateTime][neq]=null`), restrict by kind, or expand referenced fields via lookup in a single request.

### Fetching children

```
GET /{segment}/{id}/children
```

Returns the full records of all direct children of the given record. The response format is identical to the parents endpoint. If the record has no children, the response is an empty array. If the record itself does not exist, the request returns 404.

Children are resolved via a **forward lookup** on the parent's `_children` array — the server reads the parent document to obtain child IDs, then queries `{ _id: { inq: childIds } }`. This mirrors the structure of `findParents` and eliminates full-collection scans.

`_children` is populated by two write paths:
- `POST /{segment}/{id}/children` — the dedicated child-creation endpoint.
- `POST /{segment}`, `PATCH /{segment}/{id}`, or `PUT /{segment}/{id}` with `_parents` in the request body — the server diffs the old and new `_parents` values and atomically calls `addChildReference` / `removeChildReference` on every affected parent.

All standard query parameters are supported on this endpoint as well, making it possible to filter, sort, paginate, and expand children in the same way as any other collection query. See the [OpenAPI Specification](https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/tarcinapp/entity-persistence-service/refs/heads/main/openapi.json) for the endpoint contract.

#### Resolving `_children` with lookup

Clients can also expand `_children` references on a queried record using the standard lookup syntax. For example:

```
GET /entities/{id}?filter[lookup][0][prop]=_children
```

Without this lookup parameter, a record response includes only URIs in `_children`:

```json
{
  "_id": "book-uuid",
  "_name": "My Book",
  "_children": [
    "tapp://localhost/entities/chapter-1-uuid"
  ]
}
```

With `filter[lookup][0][prop]=_children`, the same query resolves the child records in place:

```json
{
  "_id": "book-uuid",
  "_name": "My Book",
  "_children": [
    {
      "_id": "chapter-1-uuid",
      "_name": "Chapter 1",
      "_parents": [
        "tapp://localhost/entities/book-uuid"
      ]
      // ...other fields...
    }
  ]
}
```

This pattern is useful when querying a single record and wanting its children expanded in the same response. The same lookup-style expansion can also be applied to `GET /{segment}/{id}/children` or `GET /{segment}/{id}/parents` requests when nested references are needed.


### Roots: a special filter shortcut

The standard collection endpoints (`GET /{segment}`) accept a `set[roots]` query parameter that restricts results to records with no parents. This is equivalent to filtering by `_parentsCount: 0`, but expressed as a named set rather than a raw field filter. It is useful for retrieving only top-level records when building tree views or navigation structures. For a full explanation of the sets feature see [5-FEATURES-SETS.md](./5-FEATURES-SETS.md).

To retrieve only root-level entities (those with no parent):

```
GET /entities?set[roots]
```

To combine with a kind filter, retrieving root-level entities of kind `book`:

```
GET /entities?set[roots]&filter[where][_kind]=book
```

The roots set can be combined with any other standard filter. For example, ordering root-level lists by creation date:

```
GET /lists?set[roots]&filter[order]=_createdDateTime%20DESC
```


## Data Model

For general schema guidance, see the main README [Data Model](../README.md#data-model).

### `_parents`

Each child record stores its parents as an array of URI strings in the `_parents` field. A URI uniquely identifies a specific record across the entire platform.

```json
{
  "_id": "child-uuid",
  "_name": "Chapter 1",
  "_parents": [
    "tapp://localhost/entities/book-uuid"
  ]
}
```

A record with two parents:

```json
{
  "_id": "cross-chapter-uuid",
  "_name": "Cross-reference Node",
  "_parents": [
    "tapp://localhost/entities/book-a-uuid",
    "tapp://localhost/entities/book-b-uuid"
  ]
}
```

`_parents` is a user-settable field. Clients can supply it directly in a `POST` body or omit it and use the dedicated `POST /{id}/children` endpoint instead. The field is always included in responses so clients can traverse the ancestry upward without a separate query. See the [Managed Fields](../README.md#managed-fields) section in the main README for the full field contract, including how its mutability and visibility are controlled at the gateway level.

> **Note:** `_parents` is excluded from bulk `PATCH /{segment}` (updateAll) request bodies. Maintaining bidirectional consistency across an unbounded number of records cannot be guaranteed without per-record pre-fetches, which makes the cost non-viable for bulk operations. This is a known limitation — see the [Known Limitations](../README.md#known-limitations) section of the main README.

#### Why URIs rather than bare IDs

Using full URIs rather than plain UUIDs serves a purpose that reaches beyond this backend service. The `tapp://` format is the native reference convention for the Tarcinapp platform and is also used by the service's lookup feature. In this repository, the URI structure ensures that references are self-describing and can later be resolved by the gateway or orchestration layer.

The current field validation in this service enforces `localhost` as the host for `_parents` and `_children` entries, which means references are restricted to records owned by the same service instance. This repository is not itself an orchestration layer; it is a backend service that stores and validates in-instance references. Cross-instance routing is enabled by the broader Tarcinapp platform and gateway architecture, not by this service alone.

For lookup-specific behavior, see the main README's [Lookup References](../README.md#lookup-references) section.

For broader query and filter syntax, see [Querying Data](../README.md#querying-data).

For hierarchy specifically, using full URIs means:
- A `_parents` or `_children` entry is self-describing: the record type and the owning instance are encoded into the URI.
- The model can validate the URI pattern at the schema level, ensuring that an entity's `_parents` only contain entity URIs and not list or reaction URIs.
- If records are migrated between instances in the future, the URIs remain stable references that a routing layer can use.

#### URI structure

```
tapp://{instance-name}/{record-type-segment}/{uuid}
```

| Segment | Example | Meaning |
|---------|---------|---------|
| `tapp://` | (scheme) | Platform URI scheme |
| `{instance-name}` | `localhost` | Name of the service instance that owns the record |
| `{record-type-segment}` | `entities` | Collection path segment for the record type |
| `{uuid}` | `550e8400-...` | The record's `_id` |

Each concrete model defines the regex that `_parents` entries must match, locking the pattern to the correct record type:

| Record type | Accepted `_parents` URI pattern |
|-------------|--------------------------------|
| `GenericEntity` | `^tapp://localhost/entities/{uuid}$` |
| `List` | `^tapp://localhost/lists/{uuid}$` |
| `EntityReaction` | `^tapp://localhost/entity-reactions/{uuid}$` |
| `ListReaction` | `^tapp://localhost/list-reactions/{uuid}$` |

> The regex currently enforces `localhost` as the host, meaning `_parents` can only point to records within the same service instance. Cross-instance parent references are a future capability; when supported, the regex would be relaxed to accept any valid instance name.

### `_children`

Each parent record stores its children as an array of URI strings in the `_children` field, using the same URI format as `_parents`. The server maintains this array automatically and clients cannot write it directly. It is excluded from all write endpoint request body schemas and any client-supplied value is stripped before persistence.

`_children` is always included in `GET` responses so clients can perform forward traversal without a separate query.

```json
{
  "_id": "book-uuid",
  "_name": "My Book",
  "_children": [
    "tapp://localhost/entities/chapter-1-uuid",
    "tapp://localhost/entities/chapter-2-uuid"
  ]
}
```

**How `_children` is populated:**

1. `POST /{segment}/{id}/children` — after child creation, the server atomically calls `$addToSet: { _children: childUri }` on the parent document within the same transaction.
2. `POST /{segment}`, `PATCH /{segment}/{id}`, or `PUT /{segment}/{id}` with `_parents` in the body — the server diffs old vs new `_parents` and calls `addChildReference` on added parents and `removeChildReference` on removed parents. All operations run in the active transaction session.

Each `$addToSet` / `$pull` is idempotent, so retried transactions cannot produce duplicate entries.

### `_parentsCount`

A hidden, server-managed integer that always mirrors `_parents.length`. The server sets it automatically on every write operation that touches `_parents`. Clients cannot set or read it directly: it is excluded from all API responses and rejected in all request bodies. Its classification as a strictly managed and always-hidden field is defined in the [Managed Fields](../README.md#managed-fields) section of the main README.

Its sole purpose is query efficiency. The `roots` set filter uses `{ _parentsCount: 0 }` to find all root-level records without scanning the `_parents` array. An integer field filter is substantially cheaper than an array-length check at the database level.

### `_childrenCount`

A hidden, server-managed integer that always mirrors `_children.length`. Unlike `_parentsCount` (which is derived from the incoming write payload via `setCountFields`), `_childrenCount` is maintained exclusively through atomic MongoDB `$inc`/`$dec` operations in the hierarchy bookkeeping helpers. It is never derived from in-memory data and is never touched by `setCountFields`.

Clients cannot set or read it: it is excluded from all API responses, all request body schemas, and all aggregation pipeline output. Its future purpose is powering a `leaves` set filter (`{ _childrenCount: 0 }`) — mirroring how `_parentsCount` powers `roots`.


## Transactional Context for Hierarchy Writes

The broader service uses MongoDB transactions in many places. This section focuses only on the main hierarchy-related write paths and the consistency guarantees they require.

The hierarchy operations described here participate in a transaction to keep `_parents`, `_children`, `_parentsCount`, and `_childrenCount` consistent across records.

- `POST /{segment}/{id}/children` (`createChild`) — parent existence check, child creation, parent `_children` update, and count bookkeeping all occur in the same transaction.
- `POST /{segment}`, `PATCH /{segment}/{id}`, or `PUT /{segment}/{id}` with `_parents` in the body — the repository diff logic synchronizes parent/child references within the active transaction session.
- `DELETE /{segment}/{id}` (`deleteById`) — hierarchy reference cleanup (removing stale URIs from parents' `_children` and children's `_parents`) then record deletion.
- `DELETE /{segment}` (`deleteAll`) — same cleanup, applied per record, then bulk deletion.

Read endpoints (`GET /{id}/children`, `GET /{id}/parents`) are stateless and do not open transactions.

The flow for `POST /{segment}/{id}/children`:

1. The controller method carries `@transactional()` ([`src/decorators/transactional.decorator.ts`](../src/decorators/transactional.decorator.ts)).
2. The [`TransactionalInterceptor`](../src/interceptors/transactional.interceptor.ts) detects the marker, opens a MongoDB `ClientSession`, and starts a transaction.
3. The session is bound to `'active.transaction.options'` in the request context.
4. The controller injects `options` via `@inject('active.transaction.options', { optional: true })` and passes it through to the repository.
5. All sub-operations run inside that session: parent existence check, child creation, and parent `_children` / `_childrenCount` update.
6. On commit the transaction is finalised. On write-conflict errors (MongoDB code 112 / `TransientTransactionError`) the interceptor retries up to three times with back-off.


## Children Query: Forward Lookup

`findChildren` reads the parent document's `_children` array and queries `{ _id: { inq: childIds } }`. This mirrors the structure of `findParents` and was chosen for the following reasons:

- **No collection scan.** The query targets specific IDs — MongoDB resolves them directly via the `_id` index.
- **Consistency.** A child can only appear in `GET /{id}/children` if the parent's `_children` array contains its URI. The forward array and the child's `_parents` field are always kept in sync by the bookkeeping helpers.
- **Symmetry.** `findParents` and `findChildren` follow the same pattern: fetch the record, extract IDs from the reference array, query by ID.

The flow:

1. `findById(id, { fields: { _children: true } })` — throws 404 if the parent does not exist.
2. Early return `[]` if `_children` is absent or empty.
3. Extract child IDs: `childIds = _children.map(uri => uri.split('/').pop())`.
4. Query: `find({ where: { and: [{ _id: { inq: childIds } }, ...callerFilter] } })`.


## Deletion and Reference Cleanup

When a record is deleted, the server performs **bidirectional reference cleanup** before the actual MongoDB delete:

- For each URI in the deleted record's `_parents`: calls `removeChildReference(parentId, deletedRecordUri)` — removes the URI from the parent's `_children` array and decrements `_childrenCount`.
- For each URI in the deleted record's `_children`: calls `removeParentReference(childId, deletedRecordUri)` — removes the URI from the child's `_parents` array and decrements `_parentsCount`.

All cleanup operations and the final delete run within the same `@transactional()` session. This ensures no partial cleanup is ever committed.

**Cascade behaviour:** Deletion is not cascading. Only stale URI references are removed — related records survive.

**Implementation:** `cleanupHierarchyReferences` is a protected method on both base repositories. `EntityPersistenceBusinessRepository.deleteById` and `deleteAll` are new overrides that sit between the concrete repositories and `DefaultTransactionalRepository`. The concrete `EntityRepository` and `ListRepository` do not need changes — their cascade-delete logic calls `super.deleteById` / `super.deleteAll` which flows through the new business-base override. For the reaction base, the existing `deleteById` and `deleteAll` methods are augmented in place.


## Related Files

### Models

| File | Role |
|------|------|
| [`src/models/entity.model.ts`](../src/models/entity.model.ts) | `_parents` and `_children` `@property` with entity URI pattern |
| [`src/models/list.model.ts`](../src/models/list.model.ts) | `_parents` and `_children` `@property` with list URI pattern |
| [`src/models/entity-reactions.model.ts`](../src/models/entity-reactions.model.ts) | `_parents` and `_children` `@property` with entity-reaction URI pattern |
| [`src/models/list-reactions.model.ts`](../src/models/list-reactions.model.ts) | `_parents` and `_children` `@property` with list-reaction URI pattern |
| [`src/models/base-models/list-entity-common-base.model.ts`](../src/models/base-models/list-entity-common-base.model.ts) | `_parentsCount`, `_childrenCount` properties; TypeScript-only `_parents`, `_children` type |
| [`src/models/base-models/reactions-common-base.model.ts`](../src/models/base-models/reactions-common-base.model.ts) | `_parentsCount`, `_childrenCount` properties; TypeScript-only `_parents`, `_children` type |
| [`src/models/base-types/unmodifiable-common-fields.ts`](../src/models/base-types/unmodifiable-common-fields.ts) | `_parentsCount`, `_childrenCount` in `STRICTLY_INTERNAL_FIELDS` and `ALWAYS_HIDDEN_FIELDS`; `IDEMPOTENCY_EXCLUDED_FIELDS` |

### Repositories

| File | Role |
|------|------|
| [`src/repositories/base/entity-persistence-business.repository.ts`](../src/repositories/base/entity-persistence-business.repository.ts) | `findParents`, `findChildren`, `createChild`, `deleteById`, `deleteAll`, `syncParentChildReferences`, `cleanupHierarchyReferences`, `addChildReference`, `removeChildReference`, `removeParentReference`, `buildParentUri` |
| [`src/repositories/base/entity-persistence-reaction.repository.ts`](../src/repositories/base/entity-persistence-reaction.repository.ts) | Same methods for reactions |

### Controllers

| File | Role |
|------|------|
| [`src/controllers/entities.controller.ts`](../src/controllers/entities.controller.ts) | REST endpoints for entity hierarchy |
| [`src/controllers/lists.controller.ts`](../src/controllers/lists.controller.ts) | REST endpoints for list hierarchy |
| [`src/controllers/entity-reactions.controller.ts`](../src/controllers/entity-reactions.controller.ts) | REST endpoints for entity-reaction hierarchy |
| [`src/controllers/list-reactions.controller.ts`](../src/controllers/list-reactions.controller.ts) | REST endpoints for list-reaction hierarchy |

### Helpers and extensions

| File | Role |
|------|------|
| [`src/extensions/utils/set-helper.ts`](../src/extensions/utils/set-helper.ts) | `roots` set using `_parentsCount: 0` |
| [`src/extensions/utils/mongo-pipeline-helper.ts`](../src/extensions/utils/mongo-pipeline-helper.ts) | Excludes `_parentsCount` and `_childrenCount` from aggregation pipeline output |

### Transaction support

| File | Role |
|------|------|
| [`src/decorators/transactional.decorator.ts`](../src/decorators/transactional.decorator.ts) | `@transactional()` used on create, update, and delete controller methods |
| [`src/interceptors/transactional.interceptor.ts`](../src/interceptors/transactional.interceptor.ts) | MongoDB session management and write-conflict retry logic |
