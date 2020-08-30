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
  type: string;

  @property({
    type: 'date',
  })
  creationDateTime?: string;


  constructor(data?: Partial<Relation>) {
    super(data);
  }
}

export interface RelationRelations {
  // describe navigational properties here
}

export type RelationWithRelations = Relation & RelationRelations;
