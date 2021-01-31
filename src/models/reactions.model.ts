import {Entity, hasMany, model, property} from '@loopback/repository';
import {SubReactions} from './sub-reactions.model';

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
    type: 'date',
    defaultFn: "now"
  })
  creationDateTime?: string;

  @property({
    type: 'date',
    defaultFn: process.env.autoapprove_entity_reaction ? 'now' : undefined,
  })
  validFromDateTime?: string;

  @property({
    type: 'date',
    default: null,
    jsonSchema: {nullable: true}
  })
  validUntilDateTime?: string | null;

  @property({
    type: 'array',
    itemType: 'string',
    default: []
  })
  ownerUsers?: string[];

  @property({
    type: 'string',
  })
  entityId?: string;

  @hasMany(() => SubReactions, {keyTo: 'reactionId'})
  subReactions: SubReactions[];
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
