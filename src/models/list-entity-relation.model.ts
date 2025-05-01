import { model, property } from '@loopback/repository';
import { RecordsCommonBase } from './base-models/records-common-base.model';
import { SourceAndTargetMetadata } from './base-types/source-and-target-metadata.type';
import { CollectionConfigHelper } from '../extensions/config-helpers/collection-config-helper';

@model({
  settings: {
    strict: false,
    mongodb: {
      collection:
        CollectionConfigHelper.getInstance().getListEntityRelationCollectionName(),
    },
  },
})
export class ListToEntityRelation extends RecordsCommonBase {
  @property({
    type: 'string',
    required: true,
  })
  _listId: RecordsCommonBase['_id'];

  @property({
    type: 'string',
    required: true,
  })
  _entityId: RecordsCommonBase['_id'];

  // Define the 'fromMetadata' field
  @property({
    type: 'object',
    description: 'Metadata for the source entity',
  })
  _fromMetadata: SourceAndTargetMetadata;

  // Define the 'toMetadata' field
  @property({
    type: 'object',
    description: 'Metadata for the destination entity',
  })
  _toMetadata: SourceAndTargetMetadata;

  // Indexer property to allow additional data
  [prop: string]: any;

  constructor(data?: Partial<ListToEntityRelation>) {
    super(data);
  }
}

export interface ListEntityRelationRelations {
  // describe navigational properties here
}

export type ListEntityRelationWithRelations = ListToEntityRelation &
  ListEntityRelationRelations;
