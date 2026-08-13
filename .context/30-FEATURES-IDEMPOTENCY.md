# Idempotency Feature

## Concept

The service supports request idempotency for create operations. When an idempotency key is configured, the service computes a hash from a set of operator-configured fields on the incoming record and stores the result in `_idempotencyKey`. On any subsequent `POST` request where the computed hash matches an existing record's `_idempotencyKey`, the service returns the existing record instead of creating a duplicate.

This allows clients to safely retry failed `POST` requests without producing duplicate records, as long as the content fields that determine uniqueness have not changed.


## How the Key is Calculated

The idempotency key is computed by `calculateIdempotencyKey` in both base repositories ([`entity-persistence-business.repository.ts`](../src/repositories/base/entity-persistence-business.repository.ts) and [`entity-persistence-reaction.repository.ts`](../src/repositories/base/entity-persistence-reaction.repository.ts)).

The calculation:

1. Reads the operator-configured idempotency field list via `getIdempotencyFields(kind)`.
2. **Filters the list against `IDEMPOTENCY_EXCLUDED_FIELDS`** (see below) — any managed field in the configured list is silently discarded and a warning is logged.
3. For each remaining field, reads the value from the incoming data object and serialises it as a string.
4. Concatenates the field-value pairs in a deterministic order.
5. Computes a SHA-256 hash of the concatenated string.
6. Stores the result in `data._idempotencyKey`.

If no idempotency fields are configured, or if all configured fields are excluded, no key is computed and `_idempotencyKey` is left unset.


## IDEMPOTENCY_EXCLUDED_FIELDS

Certain fields must never contribute to an idempotency key, regardless of operator configuration. These are fields whose values are either managed by the server or represent cross-record state — not record content. If an operator accidentally configures any of these as idempotency fields, the service silently removes them from the hash calculation and logs a warning.

The full list is defined in [`src/models/base-types/unmodifiable-common-fields.ts`](../src/models/base-types/unmodifiable-common-fields.ts) as `IDEMPOTENCY_EXCLUDED_FIELDS`:

| Field | Reason for exclusion |
|---|---|
| `_id` | Assigned by the server after creation — not present in the incoming payload |
| `_version` | Server-incremented on every write — not part of record content |
| `_idempotencyKey` | The field being computed — including it would be circular |
| `_slug` | Derived from `_name` by the server — not an independent content field |
| `_createdDateTime` | Set by the server at creation time |
| `_lastUpdatedDateTime` | Updated by the server on every write |
| `_lastUpdatedBy` | Set by the gateway — not a content field |
| `_parents` | Cross-record reference — not intrinsic record content |
| `_parentsCount` | Derived count field maintained by the server |
| `_children` | Cross-record reference — represents relationships, not content |
| `_childrenCount` | Derived count field maintained by the server |
| `_ownerUsersCount` | Derived count field |
| `_ownerGroupsCount` | Derived count field |
| `_viewerUsersCount` | Derived count field |
| `_viewerGroupsCount` | Derived count field |

### Why `_children` and `_childrenCount` are excluded

`_children` and `_childrenCount` represent cross-record state — they describe the record's position in a hierarchy graph, not the record's own content. Two records with identical content fields but different hierarchy positions would produce the same idempotency key even if their `_children` arrays differed. More importantly, `_children` is not present in write payloads — it is maintained by the server via `$addToSet`/`$pull` on parent documents. Including it would mean the key could never be computed from the incoming data.

The same reasoning applies to `_parents` and `_parentsCount`: they describe relationships, not content.

### Why `_version` is excluded

`_version` is incremented by the server on every `updateById` and `replaceById` call, including the bookkeeping `updateOne` calls made by `addChildReference`, `removeChildReference`, and `removeParentReference`. These bookkeeping operations deliberately bypass the standard update path — they do not touch `_version`, `_lastUpdatedDateTime`, or `_lastUpdatedBy`. The idempotency key must remain stable across these internal operations so that a record's idempotent identity does not change when its hierarchy is updated.


## Configuration

Idempotency fields are configured per kind via the `idempotency` configuration object. See the [Idempotency configurations](../README.md#idempotency) section of the main README for the full configuration reference.

Example — configure `_name` and `_entityId` as idempotency fields for entity reactions of kind `comment`:

```yaml
idempotency:
  entity_reaction:
    comment:
      fields:
        - _name
        - _entityId
```

When this is configured, two `POST /entity-reactions` requests with the same `_name` and `_entityId` will return the same record rather than creating a second one.


## Related Files

| File | Role |
|---|---|
| [`src/models/base-types/unmodifiable-common-fields.ts`](../src/models/base-types/unmodifiable-common-fields.ts) | `IDEMPOTENCY_EXCLUDED_FIELDS` constant and `IdempotencyExcludedFields` type |
| [`src/repositories/base/entity-persistence-business.repository.ts`](../src/repositories/base/entity-persistence-business.repository.ts) | `calculateIdempotencyKey` — filters fields, computes SHA-256 hash |
| [`src/repositories/base/entity-persistence-reaction.repository.ts`](../src/repositories/base/entity-persistence-reaction.repository.ts) | Same for reactions |
| [`src/__tests__/unit/repositories/entity.repository.test.ts`](../src/__tests__/unit/repositories/entity.repository.test.ts) | `calculateIdempotencyKey` unit tests — managed fields stripped, warning logged |
| [`src/__tests__/unit/repositories/list.repository.test.ts`](../src/__tests__/unit/repositories/list.repository.test.ts) | Same for lists |
