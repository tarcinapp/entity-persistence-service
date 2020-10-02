import {Entity, hasMany, model, property} from '@loopback/repository';
import {SubReactions} from './sub-reactions.model';

@model({settings: {strict: false}})
export class ListReactions extends Entity {
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
    required: false,
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
    default: null
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
  listId?: string;

  @hasMany(() => SubReactions, {keyTo: 'listReactionId'})
  subReactions: SubReactions[];
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<ListReactions>) {
    super(data);
  }
}

export interface ListReactionsRelations {
  // describe navigational properties here
}

export type ListReactionsWithRelations = ListReactions & ListReactionsRelations;
