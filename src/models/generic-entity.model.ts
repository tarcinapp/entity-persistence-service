import {Entity, hasMany, model, property} from '@loopback/repository';
import {Reactions} from './reactions.model';
import {Relation} from './relation.model';
import {Tag} from './tag.model';
import {TagEntityRelation} from './tag-entity-relation.model';

@model({settings: {strict: false}})
export class GenericEntity extends Entity {
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
    default: ""
  })
  description?: string;

  @property({
    type: 'string',
    default: ""
  })
  thumbnail?: string;

  @property({
    type: 'string',
    default: ""
  })
  banner?: string;

  @property({
    type: 'date',
    defaultFn: "now",
    description: 'This field is filled by server at the time of the creation of the entity.'
  })
  creationDateTime?: string;

  @property({
    type: 'date',
    description: 'This is the entity approval time.' +
      'Only those entities with validFromDateTime property has a value can be' +
      'seen by other members.' +
      'If caller is not a member at the creation time, this field is filled' +
      'automatically by the server.'
  })
  validFromDateTime?: string;

  @property({
    type: 'date',
    description: 'This field indicates if the entity is currently active.'
  })
  validUntilDateTime?: string;

  @property({
    type: 'string',
    description: 'public: anyone can see the entity, if validFromDateTime has a value. ' +
      'protected: only the members of the owner groups can see the entity. ' +
      'private: only the owner user can see the entity. ' +
      'Note: This option only applies to the user in members role. Higher level' +
      'roles always see all the entities.',
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
  ownerGroups?: string[];

  @hasMany(() => Relation, {keyTo: 'from'})
  relations: Relation[];

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
