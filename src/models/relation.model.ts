import {Entity, model, property} from '@loopback/repository';

@model()
export class Relation extends Entity {
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
  from: string;

  @property({
    type: 'string',
    required: true,
  })
  to: string;

  @property({
    type: 'string',
    required: true,
  })
  kind: string;

  @property({
    type: 'date',
    defaultFn: "now"
  })
  creationDateTime?: string;

  @property({
    required: false,
    type: 'date'
  })
  lastUpdatedDateTime?: string;

  @property({
    required: false,
    type: 'string'
  })
  createdBy?: string;

  @property({
    required: false,
    type: 'string'
  })
  lastUpdatedBy?: string;
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Relation>) {
    super(data);
  }
}

export interface RelationRelations {
  // describe navigational properties here
}

export type RelationWithRelations = Relation & RelationRelations;
