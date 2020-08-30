import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false}})
export class Reactions extends Entity {
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
  })
  content?: string;

  @property({
    type: 'date',
    defaultFn: "now"
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
    type: 'array',
    itemType: 'string',
  })
  ownerUsers?: string[];

  @property({
    type: 'string',
  })
  entityId?: string;
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Reactions>) {
    super(data);
  }
}

export interface ReactionsRelations {
  // describe navigational properties here
}

export type ReactionsWithRelations = Reactions & ReactionsRelations;
