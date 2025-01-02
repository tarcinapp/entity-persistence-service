import {Entity, model, property} from '@loopback/repository';
import {RelationMetadataType} from '../base-types/relation-metadata-under-entity.type';

@model({
  settings: {
    strict: false
  }
})
export class RelationTargetBase extends Entity {

  @property({
    type: 'object',
    description: 'Metadata for the relation target'
  })
  relationMetadata?: RelationMetadataType

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<RelationTargetBase>) {
    super(data);
  }
}

export interface RelationTargetBaseRelations {
  // describe navigational properties here
}

export type RelationTargetBaseWithRelations = RelationTargetBase & RelationTargetBaseRelations;
