import {Entity, model, property} from '@loopback/repository';

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
    required: true,
  })
  description: string;

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
    description: 'public: anyone can see the entity, if validFromDateTime has a value.' +
      'private: only the owner user can see the entity' +
      'Note: This option only applies to the user in members role. Higher level' +
      'roles always see all the entities.',
    default: 'public'
  })
  visibility?: string;

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
