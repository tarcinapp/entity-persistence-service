import { model, property } from '@loopback/repository';
import { ReactionsCommonBase } from './base-models/reactions-common-base.model';
import { ListWithRelations } from './list.model';
import { CollectionConfigHelper } from '../extensions/config-helpers/collection-config-helper';

@model({
  settings: {
    strict: false,
    mongodb: {
      collection:
        CollectionConfigHelper.getInstance().getListReactionsCollectionName(),
    },
  },
})
export class ListReaction extends ReactionsCommonBase {
  @property({
    type: 'string',
    required: true,
  })
  _listId: string;

  @property({
    type: 'array',
    itemType: 'string',
    jsonSchema: {
      pattern:
        '^tapp://localhost/list-reactions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      uniqueItems: true,
    },
  })
  _parents?: string[];

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<ListReaction>) {
    super(data);
  }
}

export interface ListReactionRelations {
  list?: ListWithRelations;
}

export type ListReactionWithRelations = ListReaction & ListReactionRelations;
