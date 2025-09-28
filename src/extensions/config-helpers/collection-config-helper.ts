import { EnvConfigHelper } from './env-config-helper';

export class CollectionConfigHelper {
  private static instance: CollectionConfigHelper;

  private constructor() {}

  public static getInstance(): CollectionConfigHelper {
    if (!CollectionConfigHelper.instance) {
      CollectionConfigHelper.instance = new CollectionConfigHelper();
    }
    return CollectionConfigHelper.instance;
  }

  public getEntityCollectionName(): string {
    return EnvConfigHelper.getInstance().COLLECTION_ENTITY ?? 'Entity';
  }

  public getListCollectionName(): string {
    return EnvConfigHelper.getInstance().COLLECTION_LIST ?? 'List';
  }

  public getListEntityRelationCollectionName(): string {
    return EnvConfigHelper.getInstance().COLLECTION_LIST_ENTITY_REL ?? 'ListToEntityRelation';
  }

  public getEntityReactionsCollectionName(): string {
    return EnvConfigHelper.getInstance().COLLECTION_ENTITY_REACTIONS ?? 'EntityReaction';
  }

  public getListReactionsCollectionName(): string {
    return EnvConfigHelper.getInstance().COLLECTION_LIST_REACTIONS ?? 'ListReactions';
  }
}
