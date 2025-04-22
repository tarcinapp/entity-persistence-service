import { model, property } from '@loopback/repository';
import { AccessControlBase } from './access-control-base.model';
import { RelationMetadataType } from '../base-types/relation-metadata-under-entity.type';

/**
 * Inherits:
 * _id, _kind, _validFromDateTime, _validUntilDateTime, _version, _createdDateTime,
 * _createdBy, _lastUpdatedDateTime, _lastUpdatedBy, _idempotencyKey,
 * _ownerUsers, _ownerGroups, _viewerUsers, _viewerGroups, _visibility
 *
 * Adds:
 * _ownerUsersCount, _ownerGroupsCount, _viewerUsersCount, _viewerGroupsCount, _parentsCount
 */
@model({
  settings: {
    strict: false,
  },
})
export class ReactionsCommonBase extends AccessControlBase {
  @property({
    type: 'number',
    default: 0,
    hidden: true,
  })
  _ownerUsersCount?: number;

  @property({
    type: 'number',
    default: 0,
    hidden: true,
  })
  _ownerGroupsCount?: number;

  @property({
    type: 'number',
    default: 0,
    hidden: true,
  })
  _viewerUsersCount?: number;

  @property({
    type: 'number',
    default: 0,
    hidden: true,
  })
  _viewerGroupsCount?: number;

  @property({
    type: 'number',
    default: 0,
    hidden: true,
  })
  _parentsCount?: number;

  @property({
    type: 'object',
    description: 'Contains the relation metadata for the record',
  })
  _relationMetadata?: RelationMetadataType;

  constructor(data?: Partial<ReactionsCommonBase>) {
    super(data);
  }
}
