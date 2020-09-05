import {Entity, hasMany, model, property} from '@loopback/repository';
import {GenericEntity} from './generic-entity.model';
import {ListEntityRelation} from './list-entity-relation.model';
import {ListReactions} from './list-reactions.model';
import {ListRelation} from './list-relation.model';

@model({settings: {strict: false}})
export class List extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    defaultFn: "uuidv4"
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  kind: string;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'string',
    required: false,
  })
  description?: string;

  @property({
    type: 'string',
  })
  thumbnail?: string;

  @property({
    type: 'string',
  })
  banner?: string;

  @property({
    type: 'date',
    defaultFn: "now",
  })
  creationDateTime?: string;

  @property({
    type: 'date',
  })
  validFromDateTime?: string;

  @property({
    type: 'date',
  })
  validUntilDateTime?: string;

  @property({
    type: 'string',
    default: 'public'
  })
  visibility?: string;

  @property.array(String, {
    required: false,
    default: []
  })
  ownerUsers?: string[];

  @property.array(String, {
    required: false,
    default: []
  })
  tags?: string[];

  @hasMany(() => GenericEntity, {through: {model: () => ListEntityRelation, keyTo: 'entityId'}})
  genericEntities: GenericEntity[];

  @hasMany(() => ListRelation, {keyTo: 'from'})
  relations: ListRelation[];

  @hasMany(() => ListReactions)
  reactions: ListReactions[];
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<List>) {
    super(data);
  }
}

export interface ListRelations {
  // describe navigational properties here
}

export type ListWithRelations = List & ListRelations;
