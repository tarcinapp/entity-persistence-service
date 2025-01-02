import {model, property} from '@loopback/repository';
import {ModelWithIdBase} from './base-models/model-with-id-base.model';
import {RecordsCommonBase} from './base-models/records-common-base.model';
import {SourceAndTargetMetadata} from './base-types/source-and-target-metadata.type';

@model({
  settings: {
    strict: false,
    mongodb: {
      collection: process.env.collection_list_list_entity_rel ?? "GenericListToEntityRelation"
    }
  }
})
export class GenericListToEntityRelation extends RecordsCommonBase {

  @property({
    type: 'string',
    required: true,
  })
  _listId: ModelWithIdBase["_id"];

  @property({
    type: 'string',
    required: true,
  })
  _entityId: ModelWithIdBase["_id"];

  // Define the 'fromMetadata' field
  @property({
    type: 'object',
    description: 'Metadata for the source entity'
  })
  _fromMetadata: SourceAndTargetMetadata;

  // Define the 'toMetadata' field
  @property({
    type: 'object',
    description: 'Metadata for the destination entity',
  })
  _toMetadata: SourceAndTargetMetadata;

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //[prop: string]: any;

  constructor(data?: Partial<GenericListToEntityRelation>) {
    super(data);
  }
}

export interface GenericListEntityRelationRelations {
  // describe navigational properties here
}

export type ListEntityRelationWithRelations = GenericListToEntityRelation & GenericListEntityRelationRelations;
