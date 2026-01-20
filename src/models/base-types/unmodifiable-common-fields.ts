// Strictly internal fields: never modifiable (not even during creation)
export const STRICTLY_INTERNAL_FIELDS = Object.freeze([
  '_id',
  '_ownerUsersCount',
  '_ownerGroupsCount',
  '_viewerUsersCount',
  '_viewerGroupsCount',
  '_parentsCount',
  '_fromMetadata',
  '_toMetadata',
  '_relationMetadata',
  '_reactions',
  '_version',
  '_idempotencyKey',
]) as ReadonlyArray<string>;

// Immutable after creation: allowed in POST (create) but not in PUT/PATCH (update/replace)
export const IMMUTABLE_AFTER_CREATION_FIELDS = Object.freeze([
  '_kind',
]) as ReadonlyArray<string>;

// Combined list for PUT/PATCH operations (all fields that cannot be modified)
export const UPDATE_EXCLUDED_FIELDS = Object.freeze([
  ...STRICTLY_INTERNAL_FIELDS,
  ...IMMUTABLE_AFTER_CREATION_FIELDS,
]) as ReadonlyArray<string>;

// Legacy constant for backward compatibility (deprecated in favor of UPDATE_EXCLUDED_FIELDS)
export const UNMODIFIABLE_COMMON_FIELDS = UPDATE_EXCLUDED_FIELDS;

export const ALWAYS_HIDDEN_FIELDS = Object.freeze([
  '_idempotencyKey',
  '_ownerUsersCount',
  '_ownerGroupsCount',
  '_viewerUsersCount',
  '_viewerGroupsCount',
  '_parentsCount',
] as ReadonlyArray<string>);

// Create union types from the array elements
export type StrictlyInternalFields = (typeof STRICTLY_INTERNAL_FIELDS)[number];
export type ImmutableAfterCreationFields = (typeof IMMUTABLE_AFTER_CREATION_FIELDS)[number];
export type UpdateExcludedFields = (typeof UPDATE_EXCLUDED_FIELDS)[number];
export type UnmodifiableCommonFields =
  (typeof UNMODIFIABLE_COMMON_FIELDS)[number];
