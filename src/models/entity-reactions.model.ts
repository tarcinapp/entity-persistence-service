import { model, property } from '@loopback/repository';
import { ReactionsCommonBase } from './base-models/reactions-common-base.model';
import { GenericEntityWithRelations } from './entity.model';
import { CollectionConfig } from '../extensions/config-helpers/collection-config';

@model({
  settings: {
    strict: false,
    mongodb: {
      collection:
        CollectionConfig.getInstance().getEntityReactionsCollectionName(),
    },
  },
})
export class EntityReaction extends ReactionsCommonBase {
  @property({
    type: 'string',
    required: true,
  })
  _entityId: string;

  @property({
    type: 'array',
    itemType: 'string',
    jsonSchema: {
      pattern:
        '^tapp://localhost/entity-reactions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      uniqueItems: true,
    },
  })
  _parents?: string[];

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<EntityReaction>) {
    super(data);
  }
}

export interface EntityReactionsRelations {
  entity?: GenericEntityWithRelations;
}

export type EntityReactionsWithRelations = EntityReaction &
  EntityReactionsRelations;
