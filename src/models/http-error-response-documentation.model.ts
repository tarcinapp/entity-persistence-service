import {Model, model, property} from '@loopback/repository';
import {HttpErrorResponse} from '.';

@model({settings: {strict: true}})
export class HttpErrorResponseDocumentation extends Model {
  @property({
    required: true,
  })
  error: HttpErrorResponse;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<HttpErrorResponseDocumentation>) {
    super(data);
  }
}

export interface HttpErrorResponseDocumentationRelations {
  // describe navigational properties here
}

export type HttpErrorResponseDocumentationWithRelations = HttpErrorResponseDocumentation & HttpErrorResponseDocumentationRelations;
