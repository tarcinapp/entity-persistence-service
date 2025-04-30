import { hasMany, model, property } from '@loopback/repository';
import { ListEntityCommonBase } from './base-models/list-entity-common-base.model';
import { EntityReaction } from './entity-reactions.model';
import { CollectionConfig } from '../extensions/config-helpers/collection-config';

@model({
  settings: {
    strict: false,
    mongodb: {
      collection: CollectionConfig.getInstance().getEntityCollectionName(),
    },
  },
})
export class GenericEntity extends ListEntityCommonBase {
  @hasMany(() => EntityReaction, { keyTo: '_entityId' })
  _reactions?: EntityReaction[];

  @property({
    type: 'array',
    itemType: 'string',
    jsonSchema: {
      pattern:
        '^tapp://localhost/entities/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      uniqueItems: true,
    },
  })
  _parents?: string[];

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<GenericEntity>) {
    super(data);
  }
}

export interface GenericEntityRelations {
  // describe navigational properties here
}

export type GenericEntityWithRelations = GenericEntity & GenericEntityRelations;
