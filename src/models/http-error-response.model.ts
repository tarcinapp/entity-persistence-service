import { Model, model, property } from '@loopback/repository';
import { getJsonSchema } from '@loopback/rest';

@model()
export class SingleError extends Model {
  @property({
    type: 'string',
  })
  path?: string;

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
    type: 'object',
    required: true,
  })
  info?: object;

  constructor(data?: Partial<SingleError>) {
    super(data);
  }
}

export interface SingleErrorRelations {
  // describe navigational properties here
}

export type SingleErrorWithRelations = SingleError & SingleErrorRelations;

@model()
export class HttpErrorResponse extends Model {
  @property({
    type: 'number',
    required: true,
  })
  statusCode: number;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'string',
    required: true,
  })
  message: string;

  @property({
    type: 'string',
    required: true,
  })
  code: string;

  @property.array(Object, {
    // <------- We should be able to use '@property.array(SingleError, {' here, according to the documentation. But this usage cause lb4 to fail when creating schema descriptor.
    jsonSchema: getJsonSchema(SingleError),
  })
  details: SingleError[];

  @property({
    type: 'number',
    required: true,
  })
  status: number;

  constructor(data?: Partial<HttpErrorResponse>) {
    super(data);
  }
}

export interface HttpErrorRelations {
  // describe navigational properties here
}

export type HttpErrorWithRelations = HttpErrorResponse & HttpErrorRelations;
