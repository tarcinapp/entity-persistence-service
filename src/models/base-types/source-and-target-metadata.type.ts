import {AccessControlBase} from '../base-models/access-control-base.model';

/**
 * Inherits:
 * _id, _kind, _validFromDateTime, _validUntilDateTime, _ownerUsers, _ownerGroups, _viewerUsers, _viewerGroups, _visibility
 * 
 * This type is designed to be used for the GenericListEntityRel.fromMeta and GenericListEntityRel.toMeta
 */
type SelectedKeys = "_kind" | "_validFromDateTime" | "_validUntilDateTime" | "_ownerUsers" | "_ownerGroups" | "_viewerUsers" | "_viewerGroups" | "_visibility";

export type SourceAndTargetMetadata = {
  [K in keyof Pick<AccessControlBase, SelectedKeys>]: AccessControlBase[K];
}
