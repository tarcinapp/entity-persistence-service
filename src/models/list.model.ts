import { hasMany, model, property } from '@loopback/repository';
import { ListEntityCommonBase } from './base-models/list-entity-common-base.model';
import { GenericEntity, GenericEntityWithRelations } from './entity.model';
import { ListToEntityRelation } from './list-entity-relation.model';
import { ListReactions } from './list-reactions.model';
import { TagListRelation } from './tag-list-relation.model';
import { Tag } from './tag.model';

@model({
  settings: {
    strict: false,
    mongodb: {
      collection: process.env.collection_list ?? 'List',
    },
  },
})
export class List extends ListEntityCommonBase {
  @hasMany(() => GenericEntity, {
    through: {
      model: () => ListToEntityRelation,
      keyFrom: '_listId',
      keyTo: '_entityId',
    },
  })
  _entities: GenericEntity[];

  @hasMany(() => ListReactions, { keyTo: 'listId' })
  reactions: ListReactions[];

  @hasMany(() => Tag, {
    through: { model: () => TagListRelation, keyFrom: 'listId' },
  })
  tags: Tag[];

  @property({
    type: 'array',
    itemType: 'string',
    jsonSchema: {
      pattern:
        '^tapp://localhost/lists/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      uniqueItems: true,
    },
  })
  _parents?: string[];

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<List>) {
    super(data);
  }
}

export interface ListRelations {
  entities?: GenericEntityWithRelations;
}

export type ListWithRelations = List & ListRelations;
