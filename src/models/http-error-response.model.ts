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
    jsonSchema: {
      examples: [
        // 400 Bad Request
        'MALFORMED-QUERY-FILTER',
        // 404 Not Found
        'ENTITY-NOT-FOUND',
        'LIST-NOT-FOUND',
        'RELATION-NOT-FOUND',
        'ENTITY-REACTION-NOT-FOUND',
        'LIST-REACTION-NOT-FOUND',
        // 409 Conflict
        'ENTITY-UNIQUENESS-VIOLATION',
        'LIST-UNIQUENESS-VIOLATION',
        'RELATION-UNIQUENESS-VIOLATION',
        'ENTITY-REACTION-UNIQUENESS-VIOLATION',
        'LIST-REACTION-UNIQUENESS-VIOLATION',
        // 422 Unprocessable Entity
        'VALIDATION-FAILED',
        'INVALID-INCLUSION-FILTER',
        'INVALID-ENTITY-KIND',
        'INVALID-LIST-KIND',
        'INVALID-RELATION-KIND',
        'INVALID-ENTITY-REACTION-KIND',
        'INVALID-LIST-REACTION-KIND',
        'IMMUTABLE-ENTITY-KIND',
        'IMMUTABLE-LIST-KIND',
        'IMMUTABLE-RELATION-KIND',
        'IMMUTABLE-ENTITY-REACTION-KIND',
        'IMMUTABLE-LIST-REACTION-KIND',
        'IMMUTABLE-ENTITY-ID',
        'IMMUTABLE-LIST-ID',
        'RELATION-MISSING-IDS',
        'SOURCE-RECORD-NOT-MATCH',
        'ENTITY-INVALID-LOOKUP-REFERENCE',
        'ENTITY-INVALID-LOOKUP-KIND',
        'ENTITY-INVALID-PARENT-ENTITY-ID',
        'ENTITY-INVALID-PARENT-LIST-ID',
        'LIST-INVALID-LOOKUP-REFERENCE',
        'LIST-INVALID-LOOKUP-KIND',
        'LIST-INVALID-PARENT-ENTITY-ID',
        'LIST-INVALID-PARENT-LIST-ID',
        'ENTITY-REACTION-INVALID-LOOKUP-REFERENCE',
        'ENTITY-REACTION-INVALID-LOOKUP-KIND',
        'ENTITY-REACTION-INVALID-PARENT-ENTITY-ID',
        'ENTITY-REACTION-INVALID-PARENT-LIST-ID',
        'LIST-REACTION-INVALID-LOOKUP-REFERENCE',
        'LIST-REACTION-INVALID-LOOKUP-KIND',
        'LIST-REACTION-INVALID-PARENT-ENTITY-ID',
        'LIST-REACTION-INVALID-PARENT-LIST-ID',
        // 429 Too Many Requests
        'ENTITY-LIMIT-EXCEEDED',
        'LIST-LIMIT-EXCEEDED',
        'RELATION-LIMIT-EXCEEDED',
        'ENTITY-REACTION-LIMIT-EXCEEDED',
        'LIST-REACTION-LIMIT-EXCEEDED',
        // 500 Internal Server Error
        'INTERNAL-SERVER-ERROR',
      ],
    },
  })
  code: string;

  @property({
    type: 'string',
  })
  requestId?: string;

  @property.array(Object, {
    // <------- We should be able to use '@property.array(SingleError, {' here, according to the documentation. But this usage cause lb4 to fail when creating schema descriptor.
    jsonSchema: getJsonSchema(SingleError),
  })
  details: SingleError[];

  constructor(data?: Partial<HttpErrorResponse>) {
    super(data);
  }
}

export interface HttpErrorRelations {
  // describe navigational properties here
}

export type HttpErrorWithRelations = HttpErrorResponse & HttpErrorRelations;
