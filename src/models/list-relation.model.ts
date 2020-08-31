import {Entity, model, property} from '@loopback/repository';

@model()
export class ListRelation extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    default: "uuidv4",
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
  type: string;

  @property({
    type: 'date',
    defaultFn: "now",
  })
  creationDateTime?: string;


  constructor(data?: Partial<ListRelation>) {
    super(data);
  }
}

export interface ListRelationRelations {
  // describe navigational properties here
}

export type ListRelationWithRelations = ListRelation & ListRelationRelations;
