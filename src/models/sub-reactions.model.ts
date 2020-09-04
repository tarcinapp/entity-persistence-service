import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false}})
export class SubReactions extends Entity {
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
    defaultFn: 'now'
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
    default: [],
  })
  ownerUsers?: string[];

  @property({
    type: 'string',
  })
  reactionId?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<SubReactions>) {
    super(data);
  }
}

export interface SubReactionsRelations {
  // describe navigational properties here
}

export type SubReactionsWithRelations = SubReactions & SubReactionsRelations;
