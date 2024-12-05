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
    required: true,
  })
  listId: string;

  @property({
    type: 'string',
    required: true,
  })
  entityId: string;

  @property({
    type: 'date',
    defaultFn: "now",
  })
  creationDateTime?: string;

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
