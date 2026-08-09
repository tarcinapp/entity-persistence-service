# Hierarchy Feature

## Concept

Records in this service can be organised into parent-child hierarchies. Any list, entity, entity-reaction, or list-reaction can be declared a child of one or more records of the same type. This makes it possible to model naturally nested structures: chapter entities inside a book entity, sublists inside a reading list, threaded comment reactions nested under a top-level comment reaction, and so on.

The hierarchy is intentionally flexible:

- A record can have zero, one, or many parents of the same type.
- A record can have zero, one, or many children.
- There is no enforced depth limit. Trees and directed acyclic graphs (DAGs) are both supported.
- There is no requirement that records form a single root. A collection can contain multiple disconnected trees or isolated root nodes.

A record with no parents is called a **root**. A record with no children is a **leaf**. A record can be both (a standalone record) or neither (a node somewhere in the middle of a deep DAG).

Each child record carries its parent references directly inside its own `_parents` field. Each parent record carries its children references inside its own `_children` field, maintained automatically by the server when children are created via `POST /{id}/children`. `_childrenCount` mirrors `_children.length` and is visible in responses so the UI can check whether a record has children without fetching them.

This feature intentionally does not express hierarchy through separate relationship records (the list-to-entity pivot table). This keeps hierarchy reads cheap: a single document fetch returns the full ancestry or child list.


## API Operations

All four record types expose the same three hierarchy endpoints. The path segment varies by type: `entities`, `lists`, `entity-reactions`, or `list-reactions`.

### Creating a child record

```
POST /{segment}/{id}/children
```

Creates a new record and automatically links it as a child of the record identified by `{id}`. The client provides the same fields as a normal creation request. The `_parents` field is not part of the request body: the server constructs and injects it from the path parameter.

The operation verifies that the parent record exists before creating the child, and the two steps run atomically inside a MongoDB transaction. If the parent does not exist the request returns 404. For reaction types, the operation additionally validates that the child's source-record field (`_entityId` or `_listId`) matches the parent's, because a reaction hierarchy must stay bound to the same source record.

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

All standard query parameters are supported on this endpoint as well, making it possible to filter, sort, paginate, and expand children in the same way as any other collection query.

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

#### Why URIs rather than bare IDs

Using full URIs rather than plain UUIDs serves a purpose that goes beyond this service instance. The `tapp://` scheme is the native reference format for the entire platform. An instance of this service that is named `localhost` (the default, meaning "this instance") stores references as `tapp://localhost/...`. An instance named `library` would store `tapp://library/...`.

When the platform's orchestration layer resolves a reference, it reads the host segment of the URI and maps it to the endpoint of the appropriate service instance. References with `localhost` are resolved within the current service. References with any other host name are forwarded to the remote instance whose name matches. This is the foundation for cross-instance lookups. The detailed mechanics of URI resolution are covered in [25-FEATURES-LOOKUPS.md](./25-FEATURES-LOOKUPS.md).

For hierarchy specifically, using full URIs means:
- A `_parents` entry is self-describing: the record type and the instance that owns it are encoded in the URI.
- The model can validate the URI pattern at the schema level, ensuring that an entity's `_parents` only contain entity URIs and not list or reaction URIs.
- If records are migrated between instances, the URIs remain stable references that the orchestration layer can route.

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

### `_parentsCount`

A hidden, server-managed integer that always mirrors `_parents.length`. The server sets it automatically on every write operation that touches `_parents`. Clients cannot set or read it directly: it is excluded from all API responses and rejected in all request bodies. Its classification as a strictly managed and always-hidden field is defined in the [Managed Fields](../README.md#managed-fields) section of the main README.

Its sole purpose is query efficiency. The `roots` set filter uses `{ _parentsCount: 0 }` to find all root-level records without scanning the `_parents` array. An integer field filter is substantially cheaper than an array-length check at the database level.


## Transactional Context

Only `createChild` participates in a MongoDB transaction. Read endpoints are stateless.

The flow for `POST /{segment}/{id}/children`:

1. The controller method carries `@transactional()` ([`src/decorators/transactional.decorator.ts`](../src/decorators/transactional.decorator.ts)).
2. The [`TransactionalInterceptor`](../src/interceptors/transactional.interceptor.ts) detects the marker, opens a MongoDB `ClientSession`, and starts a transaction.
3. The session is bound to `'active.transaction.options'` in the request context.
4. The controller injects `options` via `@inject('active.transaction.options', { optional: true })` and passes it through to the repository.
5. All sub-operations run inside that session: parent existence check then child creation.
6. On commit the transaction is finalised. On write-conflict errors (MongoDB code 112 / `TransientTransactionError`) the interceptor retries up to three times with back-off.


## Children Query: Current Approach and Its Trade-offs

`findChildren` queries the collection for all records whose `_parents` array contains the parent's URI:

```
{ _parents: "tapp://localhost/{segment}/{id}" }
```

MongoDB treats a scalar equality filter against an array field as an element-match, returning every document where the array contains that string. The approach is simple and correct.

**Advantages:**
- No write to the parent record is needed on child creation or deletion.
- A child can be created by supplying `_parents` directly in a `POST` body, without going through the `/children` endpoint.
- Multiple-parent DAGs work naturally: a record just lists all its parent URIs.

**Disadvantages:**
- Without an index on `_parents`, every `findChildren` call scans the full collection.
- Counting children requires a separate query rather than reading a field.
- There is no quick way to tell whether a record has children without a database round-trip.

A MongoDB multikey index on `_parents` makes element-match queries efficient without any code change. An alternative approach would be to store a `_children` array on the parent, mirroring the `_parents` approach and enabling forward traversal, but it requires transactional bookkeeping on every child creation and deletion. That trade-off is analysed in [21-IMPLEMENTATION-CHILDREN-FIELD.md](./21-IMPLEMENTATION-CHILDREN-FIELD.md).


## Tests

### Acceptance tests

| File | Coverage |
|------|----------|
| [`entity/create-child-entity.test.ts`](../src/__tests__/acceptance/entity/create-child-entity.test.ts) | POST /entities/{id}/children: 404 parent, creates child, verifies `_parents`, verifies children endpoint |
| [`entity/get-entity-children.test.ts`](../src/__tests__/acceptance/entity/get-entity-children.test.ts) | GET /entities/{id}/children: basic, filter by kind / date range / visibility / owner / custom field |
| [`entity/get-entity-parents.test.ts`](../src/__tests__/acceptance/entity/get-entity-parents.test.ts) | GET /entities/{id}/parents: basic, filter by kind / date range / visibility / owner, field selection |
| [`list/create-child-list.test.ts`](../src/__tests__/acceptance/list/create-child-list.test.ts) | POST /lists/{id}/children: 404 parent, creates child, verifies children endpoint |
| [`list/get-list-children.test.ts`](../src/__tests__/acceptance/list/get-list-children.test.ts) | GET /lists/{id}/children: nested lookup with field selection, 404 |
| [`list/get-list-parents.test.ts`](../src/__tests__/acceptance/list/get-list-parents.test.ts) | GET /lists/{id}/parents: lookup with complex filter, 404 |
| [`entity-reaction/get-entity-reaction-parents.test.ts`](../src/__tests__/acceptance/entity-reaction/get-entity-reaction-parents.test.ts) | GET /entity-reactions/{id}/parents: basic, filter by kind / date / visibility / owner |
| [`list-reaction/get-list-reaction-parents.test.ts`](../src/__tests__/acceptance/list-reaction/get-list-reaction-parents.test.ts) | GET /list-reactions/{id}/parents: basic, filter by kind / date / visibility / owner |

### Unit tests

| File | Coverage |
|------|----------|
| [`unit/controllers/entity.controller.test.ts`](../src/__tests__/unit/controllers/entity.controller.test.ts) | `findChildren()`, `findParents()`, `createChild()`: success, 404, 422, 429 |


## Related Files

| File | Role |
|------|------|
| [`src/models/entity.model.ts`](../src/models/entity.model.ts) | `_parents` `@property` with entity URI pattern |
| [`src/models/list.model.ts`](../src/models/list.model.ts) | `_parents` `@property` with list URI pattern |
| [`src/models/entity-reactions.model.ts`](../src/models/entity-reactions.model.ts) | `_parents` `@property` with entity-reaction URI pattern |
| [`src/models/list-reactions.model.ts`](../src/models/list-reactions.model.ts) | `_parents` `@property` with list-reaction URI pattern |
| [`src/models/base-models/list-entity-common-base.model.ts`](../src/models/base-models/list-entity-common-base.model.ts) | `_parentsCount` property; TypeScript-only `_parents` type |
| [`src/models/base-models/reactions-common-base.model.ts`](../src/models/base-models/reactions-common-base.model.ts) | `_parentsCount` property; TypeScript-only `_parents` type |
| [`src/models/base-types/unmodifiable-common-fields.ts`](../src/models/base-types/unmodifiable-common-fields.ts) | `_parentsCount` in `STRICTLY_INTERNAL_FIELDS` and `ALWAYS_HIDDEN_FIELDS` |
| [`src/repositories/base/entity-persistence-business.repository.ts`](../src/repositories/base/entity-persistence-business.repository.ts) | `findParents`, `findChildren`, `createChild`, `setCountFields`, `buildParentUri` |
| [`src/repositories/base/entity-persistence-reaction.repository.ts`](../src/repositories/base/entity-persistence-reaction.repository.ts) | Same methods for reactions |
| [`src/controllers/entities.controller.ts`](../src/controllers/entities.controller.ts) | REST endpoints for entity hierarchy |
| [`src/controllers/lists.controller.ts`](../src/controllers/lists.controller.ts) | REST endpoints for list hierarchy |
| [`src/controllers/entity-reactions.controller.ts`](../src/controllers/entity-reactions.controller.ts) | REST endpoints for entity-reaction hierarchy |
| [`src/controllers/list-reactions.controller.ts`](../src/controllers/list-reactions.controller.ts) | REST endpoints for list-reaction hierarchy |
| [`src/extensions/utils/set-helper.ts`](../src/extensions/utils/set-helper.ts) | `roots` set using `_parentsCount: 0` |
| [`src/extensions/utils/mongo-pipeline-helper.ts`](../src/extensions/utils/mongo-pipeline-helper.ts) | Excludes `_parentsCount` from aggregation pipeline output |
| [`src/decorators/transactional.decorator.ts`](../src/decorators/transactional.decorator.ts) | `@transactional()` used on `createChild` controller methods |
| [`src/interceptors/transactional.interceptor.ts`](../src/interceptors/transactional.interceptor.ts) | MongoDB session management and write-conflict retry logic |
