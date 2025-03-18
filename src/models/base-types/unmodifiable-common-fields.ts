// This is a list of fields that are not modifiable with POST/PUT/PATCH operations by the user
export const UNMODIFIABLE_COMMON_FIELDS = Object.freeze([
  '_id',
  '_slug',
  '_ownerUsersCount',
  '_ownerGroupsCount',
  '_viewerUsersCount',
  '_viewerGroupsCount',
  '_parentsCount',
  '_relationMetadata',
  '_version',
  '_idempotencyKey',
]) as ReadonlyArray<string>;

// Create a union type from the array elements
export type UnmodifiableCommonFields =
  (typeof UNMODIFIABLE_COMMON_FIELDS)[number];
