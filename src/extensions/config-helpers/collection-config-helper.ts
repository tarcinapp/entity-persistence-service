export class CollectionConfigHelper {
  private static instance: CollectionConfigHelper;
  private collectionNames: { [key: string]: string } = {};

  private constructor() {
    this.initializeCollectionNames();
  }

  public static getInstance(): CollectionConfigHelper {
    if (!CollectionConfigHelper.instance) {
      CollectionConfigHelper.instance = new CollectionConfigHelper();
    }

    return CollectionConfigHelper.instance;
  }

  private initializeCollectionNames(): void {
    this.collectionNames = {
      entity: process.env.collection_entity ?? 'Entity',
      list: process.env.collection_list ?? 'List',
      listEntityRelation:
        process.env.collection_list_list_entity_rel ?? 'ListToEntityRelation',
      entityReactions:
        process.env.collection_entity_reactions ?? 'EntityReaction',
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
