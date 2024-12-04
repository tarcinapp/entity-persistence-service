import {Entity, hasMany, model, property} from '@loopback/repository';
import _ from 'lodash';
import {GenericEntity, GenericEntityWithRelations} from './generic-entity.model';
import {ListEntityRelation} from './list-entity-relation.model';
import {ListReactions} from './list-reactions.model';
import {ListRelation} from './list-relation.model';
import {TagListRelation} from './tag-list-relation.model';
import {Tag} from './tag.model';

@model({
  settings: {
    strict: false,
    mongodb: {
      collection: process.env.collection_list ?? "GenericList"
    }
  }
})
export class GenericList extends Entity {
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
    jsonSchema: {
      minLength: 2,
      maxLength: _.parseInt(process.env.validation_listname_maxlength ?? "50")
    }
  })
  name: string;

  @property({
    type: 'string',
    required: false,
  })
  slug: string;

  @property({
    type: 'date',
    description: 'This field is filled by server at the time of the creation of the list.'
  })
  creationDateTime?: string;

  @property({
    required: false,
    type: 'date'
  })
  lastUpdatedDateTime?: string;

  @property({
    type: 'date',
    description: 'This is the list approval time.' +
      'Only those list with validFromDateTime property has a value can be' +
      'seen by other members.' +
      'If caller is not a member at the creation time, this field is filled' +
      'automatically by the server.',
    default: null,
    jsonSchema: {nullable: true}
  })
  validFromDateTime?: string;

  @property({
    type: 'date',
    description: 'This field indicates if the list is currently active.',
    default: null,
    jsonSchema: {nullable: true}
  })
  validUntilDateTime?: string | null;

  @property({
    type: 'string',
    description: 'public: anyone can see the list, if validFromDateTime has a value. ' +
      'protected: only the members of the owner groups can see the entity. ' +
      'private: only the owner user can see the entity. ' +
      'Note: This option only applies to the user in members role. Higher level' +
      'roles always see all the entities.',
    default: "protected",
    jsonSchema: {
      enum: ['public', 'protected', 'private'],
    }
  })
  visibility?: string;

  @property({
    required: false,
    type: 'number',
    default: 1
  })
  version?: number;

  @property({
    required: false,
    type: 'string'
  })
  lastUpdatedBy?: string;

  @property({
    required: false,
    type: 'string'
  })
  createdBy?: string;

  @property.array(String, {
    required: false,
    default: []
  })
  ownerUsers?: string[];

  @property.array(String, {
    required: false,
    default: []
  })
  ownerGroups?: string[];

  @property.array(String, {
    required: false,
    default: []
  })
  viewerUsers?: string[];

  @property.array(String, {
    required: false,
    default: []
  })
  viewerGroups?: string[];

  @property({
    type: 'number',
    default: 0
  })
  ownerUsersCount?: number;

  @property({
    type: 'number',
    default: 0
  })
  ownerGroupsCount?: number;

  @property({
    type: 'number',
    default: 0
  })
  viewerUsersCount?: number;

  @property({
    type: 'number',
    default: 0
  })
  viewerGroupsCount?: number;

  @property({
    type: 'string'
  })
  idempotencyKey?: string | undefined;

  @hasMany(() => GenericEntity, {through: {model: () => ListEntityRelation, keyFrom: 'listId', keyTo: 'entityId'}})
  genericEntities: GenericEntity[];

  @hasMany(() => ListRelation, {keyTo: 'from'})
  relations: ListRelation[];

  @hasMany(() => ListReactions, {keyTo: 'listId'})
  reactions: ListReactions[];

  @hasMany(() => Tag, {through: {model: () => TagListRelation, keyFrom: 'listId'}})
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
  genericEntities?: GenericEntityWithRelations
}

export type ListWithRelations = GenericList & ListRelations;
