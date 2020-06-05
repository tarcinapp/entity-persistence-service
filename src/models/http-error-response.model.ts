import {Model, model, property} from '@loopback/repository';
import {SingleError} from './single-error.model';

@model()
export class HttpErrorResponse extends Model {
  @property({
    type: 'string',
    required: true,
  })
  status: string;

  @property({
    type: 'number',
    required: true,
  })
  statusCode: number;

  @property.array(SingleError)
  errors: SingleError[];

  constructor(data?: Partial<HttpErrorResponse>) {
    super(data);
  }
}

export interface HttpErrorRelations {
  // describe navigational properties here
}

export type HttpErrorWithRelations = HttpErrorResponse & HttpErrorRelations;
