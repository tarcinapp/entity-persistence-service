// This is a list of fields that are not modifiable with POST/PUT/PATCH operations by the user
export const UNMODIFIABLE_COMMON_FIELDS = Object.freeze([
  '_id',
  '_kind',
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

export const ALWAYS_HIDDEN_FIELDS = Object.freeze([
  '_idempotencyKey',
  '_ownerUsersCount',
  '_ownerGroupsCount',
  '_viewerUsersCount',
  '_viewerGroupsCount',
  '_parentsCount',
] as ReadonlyArray<string>);

// Create a union type from the array elements
export type UnmodifiableCommonFields =
  (typeof UNMODIFIABLE_COMMON_FIELDS)[number];
