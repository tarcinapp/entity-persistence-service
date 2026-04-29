import { model, property } from '@loopback/repository';
import { AccessControlBase } from './access-control-base.model';
import { RelationMetadataType } from '../base-types/relation-metadata-under-entity.type';

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
    strict: false,
  },
})
export class ListEntityCommonBase extends AccessControlBase {
  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      minLength: 2,
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

  /**
   * Parent references as URIs. Each concrete model defines this with @property
   * and model-specific regex validation. This type-only definition ensures
   * TypeScript type safety in base repositories.
   */
  _parents?: string[];

  @property({
    type: 'object',
    description:
      'Populated only on through-query endpoints (e.g. GET /lists/{id}/entities or GET /entities/{id}/lists). ' +
      'Contains the join-table metadata (_id, _kind, _validFromDateTime, _validUntilDateTime) ' +
      'from the ListToEntityRelation record that links the returned document to the queried parent. ' +
      'Always empty ({}) on direct list or entity endpoints.',
  })
  _relationMetadata?: RelationMetadataType;

  constructor(data?: Partial<ListEntityCommonBase>) {
    super(data);
  }
}
