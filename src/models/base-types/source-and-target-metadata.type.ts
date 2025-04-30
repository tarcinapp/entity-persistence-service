import type { ListEntityCommonBase } from '../base-models/list-entity-common-base.model';

/**
 * Inherits:
 * _id, _kind, _validFromDateTime, _validUntilDateTime, _ownerUsers, _ownerGroups, _viewerUsers, _viewerGroups, _visibility
 *
 * This type is designed to be used for the ListEntityRel.fromMeta, ListEntityRel.toMeta, EntityReactions._fromMeta and ListReactions._fromMeta
 */
type SelectedKeys =
  | '_kind'
  | '_name'
  | '_slug'
  | '_validFromDateTime'
  | '_validUntilDateTime'
  | '_ownerUsers'
  | '_ownerGroups'
  | '_viewerUsers'
  | '_viewerGroups'
  | '_visibility';

export type SourceAndTargetMetadata = {
  [K in keyof Pick<
    ListEntityCommonBase,
    SelectedKeys
  >]: ListEntityCommonBase[K];
};
