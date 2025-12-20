import { EnvConfigHelper } from './env-config-helper';

export class CollectionConfig {
  private static instance: CollectionConfig;
  private collectionNames: { [key: string]: string } = {};

  private constructor() {
    this.initializeCollectionNames();
  }

  public static getInstance(): CollectionConfig {
    if (!CollectionConfig.instance) {
      CollectionConfig.instance = new CollectionConfig();
    }

    return CollectionConfig.instance;
  }

  private initializeCollectionNames(): void {
    const env = EnvConfigHelper.getInstance();
    this.collectionNames = {
      entity: env.COLLECTION_ENTITY ?? 'Entity',
      list: env.COLLECTION_LIST ?? 'List',
      listEntityRelation:
        env.COLLECTION_LIST_ENTITY_REL ?? 'ListToEntityRelation',
      entityReactions: env.COLLECTION_ENTITY_REACTIONS ?? 'EntityReaction',
    };
  }

  public getEntityCollectionName(): string {
    return this.collectionNames.entity;
  }

  public getListCollectionName(): string {
    return this.collectionNames.list;
  }

  public getListEntityRelationCollectionName(): string {
    return this.collectionNames.listEntityRelation;
  }

  public getEntityReactionsCollectionName(): string {
    return this.collectionNames.entityReactions;
  }
}
