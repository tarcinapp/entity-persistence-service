import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strict: false,
    mongodb: {
      collection: "GenericListToEntityRelation"
    }
  }
})
export class GenericListEntityRelation extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    defaultFn: "uuidv4",
  })
  id?: string;

  @property({
    type: 'string',
    default: 'relation'
  })
  kind?: string;

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
    required: true,
  })
  listId: string;

  @property({
    type: 'string',
    required: true,
  })
  entityId: string;

  // Define the 'fromMetadata' field
  @property({
    type: 'object',
    description: 'Metadata for the source entity'
  })
  fromMetadata?: {
    validFromDateTime?: string;
    validUntilDateTime?: string;
    visibility?: string;
    ownerUsers?: string[];
    ownerGroups?: string[];
    viewerUsers?: string[];
    viewerGroups?: string[];
  };

  // Define the 'toMetadata' field
  @property({
    type: 'object',
    description: 'Metadata for the destination entity',
  })
  toMetadata?: {
    validFromDateTime?: string;
    validUntilDateTime?: string;
    visibility?: string;
    ownerUsers?: string[];
    ownerGroups?: string[];
    viewerUsers?: string[];
    viewerGroups?: string[];
  };

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<GenericListEntityRelation>) {
    super(data);
  }
}

export interface GenericListEntityRelationRelations {
  // describe navigational properties here
}

export type ListEntityRelationWithRelations = GenericListEntityRelation & GenericListEntityRelationRelations;
