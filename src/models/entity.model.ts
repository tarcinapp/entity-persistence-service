import { hasMany, model, property } from '@loopback/repository';
import { ListEntityCommonBase } from './base-models/list-entity-common-base.model';
import { EntityReactions } from './entity-reactions.model';
import { TagEntityRelation } from './tag-entity-relation.model';
import { Tag } from './tag.model';

@model({
  settings: {
    strict: false,
    mongodb: {
      collection: process.env.collection_entity ?? 'Entity',
    },
  },
})
export class GenericEntity extends ListEntityCommonBase {
  @hasMany(() => EntityReactions, { keyTo: 'entityId' })
  _reactions?: EntityReactions[];

  @hasMany(() => Tag, {
    through: { model: () => TagEntityRelation, keyFrom: 'entityId' },
  })
  tags?: Tag[];

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
