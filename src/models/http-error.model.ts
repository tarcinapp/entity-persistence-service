import {Model, model, property} from '@loopback/repository';

@model({settings: {strict: false}})
export class HttpError extends Model {
  @property({
    type: 'number',
    required: true,
  })
  statusCode: number;

  @property({
    type: 'string',
    required: true,
  })
  message: string;

  @property({
    type: 'string',
  })
  errorCode?: string;


  constructor(data?: Partial<HttpError>) {
    super(data);
  }
}

export interface HttpErrorRelations {
  // describe navigational properties here
}

export type HttpErrorWithRelations = HttpError & HttpErrorRelations;
