import { Entity, model, property } from '@loopback/repository';

@model({ settings: { strict: false } })
export class SubListReactions extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    defaultFn: 'uuidv4',
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  kind: string;

  @property({
    type: 'date',
    defaultFn: 'now',
  })
  creationDateTime?: string;

  @property({
    type: 'date',
  })
  validFromDateTime?: string;

  @property({
    type: 'date',
    default: null,
    jsonSchema: { nullable: true },
  })
  validUntilDateTime?: string | null;

  @property({
    type: 'array',
    itemType: 'string',
    default: [],
  })
  ownerUsers?: string[];

  @property({
    type: 'string',
  })
  listReactionId?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<SubListReactions>) {
    super(data);
  }
}

export interface SubListReactionsRelations {
  // describe navigational properties here
}

export type SubListReactionsWithRelations = SubListReactions &
  SubListReactionsRelations;
