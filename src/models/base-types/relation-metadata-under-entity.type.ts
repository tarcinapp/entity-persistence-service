import type { RecordsCommonBase } from '../base-models/records-common-base.model';

/**
 * Inherits:
 * _id, _kind, _validFromDateTime, _validUntilDateTime
 *
 * This type is intended to use under GenericEntity._relation to carry the information
 * about the relation object, when entity is queried through /lists/{listId}/entities
 */
type SelectedKeys =
  | '_id'
  | '_kind'
  | '_validFromDateTime'
  | '_validUntilDateTime';

export type RelationMetadataType = {
  [K in keyof Pick<RecordsCommonBase, SelectedKeys>]: RecordsCommonBase[K];
};
