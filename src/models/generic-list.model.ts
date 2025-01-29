import { hasMany, model } from '@loopback/repository';
import { ListEntityCommonBase } from './base-models/list-entity-common-base.model';
import {
  GenericEntity,
  GenericEntityWithRelations,
} from './generic-entity.model';
import { GenericListToEntityRelation } from './generic-list-entity-relation.model';
import { ListReactions } from './list-reactions.model';
import { ListRelation } from './list-relation.model';
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
export class GenericList extends ListEntityCommonBase {
  @hasMany(() => GenericEntity, {
    through: {
      model: () => GenericListToEntityRelation,
      keyFrom: '_listId',
      keyTo: '_entityId',
    },
  })
  _entities: GenericEntity[];

  @hasMany(() => ListRelation, { keyTo: 'from' })
  _children: ListRelation[];

  @hasMany(() => ListReactions, { keyTo: 'listId' })
  reactions: ListReactions[];

  @hasMany(() => Tag, {
    through: { model: () => TagListRelation, keyFrom: 'listId' },
  })
  tags: Tag[];
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<GenericList>) {
    super(data);
  }
}

export interface ListRelations {
  entities?: GenericEntityWithRelations;
}

export type ListWithRelations = GenericList & ListRelations;
