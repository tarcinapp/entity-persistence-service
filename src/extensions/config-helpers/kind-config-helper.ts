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
  // this var keeps if there is a configuration. Validation calls are checking if this value true
  // before executing validation logic.
  private static IS_KIND_CONFIGURED_FOR_ENTITIES: boolean = false;

  // this var getting initialized at the constructor.
  // keeps acceptable values for entities. Validations are using this array, instead of keep parsing the string at each call.
  private static ALLOWED_KINDS_FOR_ENTITIES: string[] = [];

  // this var keeps if there is a configuration. Validation calls are checking if this value true
  // before executing validation logic.
  private static IS_KIND_CONFIGURED_FOR_LISTS: boolean = false;

  // this var getting initialized at the constructor.
  // keeps acceptable values for lists. Validations are using this array, instead of keep parsing the string at each call.
  private static ALLOWED_KINDS_FOR_LISTS: string[] = [];

  private static ALLOWED_KINDS_FOR_ENTITY_LIST_RELATIONS: string[] = [];

  private static IS_KIND_CONFIGURED_FOR_LIST_ENTITY_KINDS: boolean = false;

  private static DEFAULT_ENTITY_KIND: string = 'entity';
  private static DEFAULT_LIST_KIND: string = 'list';
  private static DEFAULT_RELATION_KIND: string = 'relation';

  static {
    this.initKindConfigurations();
  }

  // Add method to reset configuration for testing
  public static resetConfiguration() {
    this.IS_KIND_CONFIGURED_FOR_ENTITIES = false;
    this.IS_KIND_CONFIGURED_FOR_LISTS = false;
    this.IS_KIND_CONFIGURED_FOR_LIST_ENTITY_KINDS = false;
    this.ALLOWED_KINDS_FOR_ENTITIES = [];
    this.ALLOWED_KINDS_FOR_LISTS = [];
    this.ALLOWED_KINDS_FOR_ENTITY_LIST_RELATIONS = [];
    this.initKindConfigurations();
  }

  public get allowedKindsForEntities() {
    return KindConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES;
  }

  public get allowedKindsForLists() {
    return KindConfigurationReader.ALLOWED_KINDS_FOR_LISTS;
  }

  public get allowedKindsForEntityListRelations() {
    return KindConfigurationReader.ALLOWED_KINDS_FOR_ENTITY_LIST_RELATIONS;
  }

  public get defaultEntityKind() {
    return KindConfigurationReader.DEFAULT_ENTITY_KIND;
  }

  public get defaultListKind() {
    return KindConfigurationReader.DEFAULT_LIST_KIND;
  }

  public get defaultRelationKind() {
    return KindConfigurationReader.DEFAULT_RELATION_KIND;
  }

  private static initKindConfigurations() {
    if (_.has(process.env, 'entity_kinds')) {
      KindConfigurationReader.IS_KIND_CONFIGURED_FOR_ENTITIES = true;

      const kinds = _.split(process.env['entity_kinds'], ',').map(_.trim);

      KindConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES.push(
        ...kinds,
        KindConfigurationReader.DEFAULT_ENTITY_KIND,
      );
    }

    if (_.has(process.env, 'list_kinds')) {
      KindConfigurationReader.IS_KIND_CONFIGURED_FOR_LISTS = true;

      const kinds = _.split(process.env['list_kinds'], ',').map(_.trim);

      KindConfigurationReader.ALLOWED_KINDS_FOR_LISTS.push(
        ...kinds,
        KindConfigurationReader.DEFAULT_LIST_KIND,
      );
    }

    if (_.has(process.env, 'list_entity_rel_kinds')) {
      KindConfigurationReader.IS_KIND_CONFIGURED_FOR_LIST_ENTITY_KINDS = true;

      const kinds = _.split(process.env['list_entity_rel_kinds'], ',').map(
        _.trim,
      );

      KindConfigurationReader.ALLOWED_KINDS_FOR_ENTITY_LIST_RELATIONS.push(
        ...kinds,
        KindConfigurationReader.DEFAULT_RELATION_KIND,
      );
    }
  }

  public isKindAcceptableForEntity(kind: string) {
    if (KindConfigurationReader.IS_KIND_CONFIGURED_FOR_ENTITIES) {
      return KindConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES.includes(kind);
    }

    return true;
  }

  public isKindAcceptableForList(kind: string) {
    if (KindConfigurationReader.IS_KIND_CONFIGURED_FOR_LISTS) {
      return KindConfigurationReader.ALLOWED_KINDS_FOR_LISTS.includes(kind);
    }

    return true;
  }

  public isKindAcceptableForListEntityRelations(kind: string) {
    if (KindConfigurationReader.IS_KIND_CONFIGURED_FOR_LIST_ENTITY_KINDS) {
      return KindConfigurationReader.ALLOWED_KINDS_FOR_ENTITY_LIST_RELATIONS.includes(
        kind,
      );
    }

    return true;
  }
}
