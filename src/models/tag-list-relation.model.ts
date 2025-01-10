import { Entity, model, property } from '@loopback/repository';

@model()
export class TagListRelation extends Entity {
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
  listId: string;

  @property({
    type: 'string',
    required: true,
  })
  tagId: string;

  @property({
    type: 'date',
    defaultFn: 'now',
  })
  creationDateTime?: string;

  constructor(data?: Partial<TagListRelation>) {
    super(data);
  }
}

export interface TagListRelationRelations {
  // describe navigational properties here
}

export type TagListRelationWithRelations = TagListRelation &
  TagListRelationRelations;
