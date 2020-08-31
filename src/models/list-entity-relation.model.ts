import {Entity, model, property} from '@loopback/repository';

@model()
export class ListEntityRelation extends Entity {
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

  constructor(data?: Partial<ListEntityRelation>) {
    super(data);
  }
}

export interface ListEntityRelationRelations {
  // describe navigational properties here
}

export type ListEntityRelationWithRelations = ListEntityRelation & ListEntityRelationRelations;
