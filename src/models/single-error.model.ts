import {Model, model, property} from '@loopback/repository';

@model()
export class SingleError extends Model {
  @property({
    type: 'string',
    required: true,
  })
  code: string;

  @property({
    type: 'string',
    required: true,
  })
  message: string;

  @property({
    type: 'string',
  })
  source?: string;


  constructor(data?: Partial<SingleError>) {
    super(data);
  }
}

export interface SingleErrorRelations {
  // describe navigational properties here
}

export type SingleErrorWithRelations = SingleError & SingleErrorRelations;
