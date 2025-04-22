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
  private isKindConfiguredForEntityReactions: boolean = false;
  private isKindConfiguredForListReactions: boolean = false;

  // Allowed kinds arrays
  private allowedKindsForEntitiesArr: string[] = [];
  private allowedKindsForListsArr: string[] = [];
  private allowedKindsForEntityListRelationsArr: string[] = [];
  private allowedKindsForEntityReactionsArr: string[] = [];
  private allowedKindsForListReactionsArr: string[] = [];

  // Default kinds
  private readonly defaultEntityKindValue: string = 'entity';
  private readonly defaultListKindValue: string = 'list';
  private readonly defaultRelationKindValue: string = 'relation';
  private readonly defaultEntityReactionKindValue: string = 'reaction';
  private readonly defaultListReactionKindValue: string = 'reaction';

  constructor() {
    this.initKindConfigurations();
  }

  // Add method to reset configuration for testing
  public resetConfiguration() {
    this.isKindConfiguredForEntities = false;
    this.isKindConfiguredForLists = false;
    this.isKindConfiguredForListEntityKinds = false;
    this.isKindConfiguredForEntityReactions = false;
    this.isKindConfiguredForListReactions = false;
    this.allowedKindsForEntitiesArr = [];
    this.allowedKindsForListsArr = [];
    this.allowedKindsForEntityListRelationsArr = [];
    this.allowedKindsForEntityReactionsArr = [];
    this.allowedKindsForListReactionsArr = [];
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

  public get allowedKindsForEntityReactions() {
    return this.allowedKindsForEntityReactionsArr;
  }

  public get allowedKindsForListReactions() {
    return this.allowedKindsForListReactionsArr;
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

  public get defaultEntityReactionKind() {
    return this.defaultEntityReactionKindValue;
  }

  public get defaultListReactionKind() {
    return this.defaultListReactionKindValue;
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

    if (_.has(process.env, 'entity_reaction_kinds')) {
      this.isKindConfiguredForEntityReactions = true;

      const kinds = _.split(process.env['entity_reaction_kinds'], ',').map(
        _.trim,
      );

      this.allowedKindsForEntityReactionsArr = [
        ...kinds,
        this.defaultEntityReactionKindValue,
      ];
    }

    if (_.has(process.env, 'list_reaction_kinds')) {
      this.isKindConfiguredForListReactions = true;

      const kinds = _.split(process.env['list_reaction_kinds'], ',').map(
        _.trim,
      );

      this.allowedKindsForListReactionsArr = [
        ...kinds,
        this.defaultListReactionKindValue,
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

  public isKindAcceptableForEntityReactions(kind: string) {
    if (this.isKindConfiguredForEntityReactions) {
      return this.allowedKindsForEntityReactionsArr.includes(kind);
    }

    return true;
  }

  public isKindAcceptableForListReactions(kind: string) {
    if (this.isKindConfiguredForListReactions) {
      return this.allowedKindsForListReactionsArr.includes(kind);
    }

    return true;
  }
}
