import {Entity, model, property} from '@loopback/repository';
import _ from 'lodash';

@model()
export class Tag extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    defaultFn: 'uuidv4',
  })
  id?: string;

  @property({
    type: 'string',
    jsonSchema: {
      minLength: 2,
      maxLength: _.parseInt(process.env.validation_tag_length || '50'),
    },
  })
  content: string;

  @property({
    type: 'date',
    defaultFn: 'now',
    description:
      'This field is filled by server at the time of the creation of the entity.',
  })
  creationDateTime?: string;

  constructor(data?: Partial<Tag>) {
    super(data);
  }
}

export interface TagRelations {
  // describe navigational properties here
}

export type TagWithRelations = Tag & TagRelations;
