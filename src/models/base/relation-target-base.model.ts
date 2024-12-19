import {Entity, model, property} from '@loopback/repository';

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
  relationMetadata?: {
    id?: string,
    kind?: string,
    creationDateTime?: string,
    lastUpdatedDateTime?: string,
    validFromDateTime?: string,
    validUntilDateTime?: string | null,
    listId?: string,
    entityId?: string,
    fromMetadata?: {
      validFromDateTime?: string,
      validUntilDateTime?: string | null,
      visibility?: string,
      ownerUsers?: string[],
      ownerGroups?: string[],
      viewerUsers?: string[],
      viewerGroups?: string[],
    } | null,
    idempotencyKey?: string | undefined,
    version?: number,
    lastUpdatedBy?: string,
    createdBy?: string,

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [prop: string]: any;
  } | null;

  constructor(data?: Partial<RelationTargetBase>) {
    super(data);
  }
}

export interface RelationTargetBaseRelations {
  // describe navigational properties here
}

export type RelationTargetBaseWithRelations = RelationTargetBase & RelationTargetBaseRelations;
