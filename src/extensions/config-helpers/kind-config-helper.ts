import { BindingKey } from '@loopback/core';
import _ from 'lodash';

export const KindBindings = {
  CONFIG_READER: BindingKey.create<KindConfigurationReader>(
    'extensions.kind.configurationreader',
  ),
} as const;

/**
 * This class is used to read the configuration made to constraint allowed list of kinds.
 * Class can be used for entities, lists, reactions, etc..
 *
 * It's implemented only for entities so far.
 */
export class KindConfigurationReader {
  // Configuration flags
  private isKindConfiguredForEntities: boolean = false;
  private isKindConfiguredForLists: boolean = false;
  private isKindConfiguredForListEntityKinds: boolean = false;

  // Allowed kinds arrays
  private allowedKindsForEntitiesArr: string[] = [];
  private allowedKindsForListsArr: string[] = [];
  private allowedKindsForEntityListRelationsArr: string[] = [];

  // Default kinds
  private readonly defaultEntityKindValue: string = 'entity';
  private readonly defaultListKindValue: string = 'list';
  private readonly defaultRelationKindValue: string = 'relation';

  constructor() {
    this.initKindConfigurations();
  }

  // Add method to reset configuration for testing
  public resetConfiguration() {
    this.isKindConfiguredForEntities = false;
    this.isKindConfiguredForLists = false;
    this.isKindConfiguredForListEntityKinds = false;
    this.allowedKindsForEntitiesArr = [];
    this.allowedKindsForListsArr = [];
    this.allowedKindsForEntityListRelationsArr = [];
    this.initKindConfigurations();
  }

  public get allowedKindsForEntities() {
    return this.allowedKindsForEntitiesArr;
  }

  public get allowedKindsForLists() {
    return this.allowedKindsForListsArr;
  }

  public get allowedKindsForEntityListRelations() {
    return this.allowedKindsForEntityListRelationsArr;
  }

  public get defaultEntityKind() {
    return this.defaultEntityKindValue;
  }

  public get defaultListKind() {
    return this.defaultListKindValue;
  }

  public get defaultRelationKind() {
    return this.defaultRelationKindValue;
  }

  private initKindConfigurations() {
    if (_.has(process.env, 'entity_kinds')) {
      this.isKindConfiguredForEntities = true;

      const kinds = _.split(process.env['entity_kinds'], ',').map(_.trim);

      this.allowedKindsForEntitiesArr = [...kinds, this.defaultEntityKindValue];
    }

    if (_.has(process.env, 'list_kinds')) {
      this.isKindConfiguredForLists = true;

      const kinds = _.split(process.env['list_kinds'], ',').map(_.trim);

      this.allowedKindsForListsArr = [...kinds, this.defaultListKindValue];
    }

    if (_.has(process.env, 'list_entity_rel_kinds')) {
      this.isKindConfiguredForListEntityKinds = true;

      const kinds = _.split(process.env['list_entity_rel_kinds'], ',').map(
        _.trim,
      );

      this.allowedKindsForEntityListRelationsArr = [
        ...kinds,
        this.defaultRelationKindValue,
      ];
    }
  }

  public isKindAcceptableForEntity(kind: string) {
    if (this.isKindConfiguredForEntities) {
      return this.allowedKindsForEntitiesArr.includes(kind);
    }

    return true;
  }

  public isKindAcceptableForList(kind: string) {
    if (this.isKindConfiguredForLists) {
      return this.allowedKindsForListsArr.includes(kind);
    }

    return true;
  }

  public isKindAcceptableForListEntityRelations(kind: string) {
    if (this.isKindConfiguredForListEntityKinds) {
      return this.allowedKindsForEntityListRelationsArr.includes(kind);
    }

    return true;
  }
}
