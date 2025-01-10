import { Entity, model, property } from '@loopback/repository';

@model()
export class TagEntityRelation extends Entity {
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
  tagId: string;

  @property({
    type: 'string',
    required: true,
  })
  entityId: string;

  @property({
    type: 'date',
    defaultFn: 'now',
  })
  creationDateTime?: string;

  constructor(data?: Partial<TagEntityRelation>) {
    super(data);
  }
}

export interface TagEntityRelationRelations {
  // describe navigational properties here
}

export type TagEntityRelationWithRelations = TagEntityRelation &
  TagEntityRelationRelations;
