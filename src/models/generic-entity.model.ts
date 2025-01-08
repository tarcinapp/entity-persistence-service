import {hasMany, model, property} from '@loopback/repository';
import {ListEntityCommonBase} from './base-models/list-entity-common-base.model';
import {RelationMetadataType} from './base-types/relation-metadata-under-entity.type';
import {Reactions} from './reactions.model';
import {EntityRelation} from './relation.model';
import {TagEntityRelation} from './tag-entity-relation.model';
import {Tag} from './tag.model';

@model({
  settings: {
    strict: false,
    mongodb: {
      collection: process.env.collection_entity ?? "GenericEntity"
    }
  }
})
export class GenericEntity extends ListEntityCommonBase {

  @property({
    type: 'object',
    description: 'Metadata for the relation target'
  })
  _relationMetadata: RelationMetadataType

  @hasMany(() => EntityRelation, {keyTo: 'from'})
  _children: EntityRelation[];

  @hasMany(() => Reactions, {keyTo: 'entityId'})
  reactions: Reactions[];

  @hasMany(() => Tag, {through: {model: () => TagEntityRelation, keyFrom: 'entityId'}})
  tags: Tag[];
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
