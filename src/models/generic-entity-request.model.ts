import {model} from '@loopback/repository';
import {GenericEntityBaseModel} from './base/generic-entity-base.model';

@model({
  settings: {
    strict: false,
    mongodb: {
      collection: process.env.collection_entity ?? "GenericEntity"
    }
  }
})
export class GenericEntityRequest extends GenericEntityBaseModel {

  // Exclude fields that should not be set by requests
  version?: never;
  idempotencyKey?: never;
  ownerUsersCount?: never;
  ownerGroupsCount?: never;
  viewerUsersCount?: never;
  viewerGroupsCount?: never;

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<GenericEntityRequest>) {
    super(data);
  }
}

export interface GenericEntityRequestRelations {
  // describe navigational properties here
}

export type GenericEntityRequestWithRelations = GenericEntityRequest & GenericEntityRequestRelations;
