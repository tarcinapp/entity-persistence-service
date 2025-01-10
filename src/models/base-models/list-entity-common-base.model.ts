import {model, property} from '@loopback/repository';
import {RelationMetadataType} from '../base-types/relation-metadata-under-entity.type';
import {AccessControlBase} from './access-control-base.model';

/**
 * Inherits:
  * _id, _kind, _validFromDateTime, _validUntilDateTime, _version, _createdDateTime,
 * _createdBy, _lastUpdatedDateTime, _lastUpdatedBy, _idempotencyKey,
 * _ownerUsers, _ownerGroups, _viewerUsers, _viewerGroups
 *
 *  Adds:
 * _name, _slug, _ownerUsersCount, _ownerGroupsCount, _viewerUsersCount, _viewerGroupsCount
 */
@model({
  settings: {
    strict: false
  }
})
export class ListEntityCommonBase extends AccessControlBase {

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 2
    },
  })
  _name: string;

  @property({
    type: 'string',
    required: false,
  })
  _slug: string;

  @property({
    type: 'number',
    default: 0,
  })
  _ownerUsersCount?: number;

  @property({
    type: 'number',
    default: 0,
  })
  _ownerGroupsCount?: number;

  @property({
    type: 'number',
    default: 0,
  })
  _viewerUsersCount?: number;

  @property({
    type: 'number',
    default: 0,
  })
  _viewerGroupsCount?: number;

  @property({
    type: 'object',
    description: 'Contains the relation metadata for the record'
  })
  _relationMetadata?: RelationMetadataType

  constructor(data?: Partial<ListEntityCommonBase>) {
    super(data);
  }
}
