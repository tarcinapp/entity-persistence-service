import { BindingKey } from '@loopback/core';
import _ from 'lodash';

export const KindLimitsBindings = {
  CONFIG_READER: BindingKey.create<KindLimitsConfigurationReader>(
    'extensions.kind-limits.config-helper',
  ),
} as const;

/**
 * This class is used to read the configuration made to constraint allowed list of kinds.
 * Class can be used for entities, lists, reactions, etc..
 *
 * It's implemented only for entities so far.
 */
export class KindLimitsConfigurationReader {
  // this var keeps if there is a configuration. Validation calls are checking if this value true
  // before executing validation logic.
  private static IS_KIND_LIMITS_CONFIGURED_FOR_ENTITIES: boolean = false;

  // this var getting initialized at the constructor.
  // keeps acceptable values for entities. Validations are using this array, instead of keep parsing the string at each call.
  private static ALLOWED_KINDS_FOR_ENTITIES: string[] = [];

  // this var keeps if there is a configuration. Validation calls are checking if this value true
  // before executing validation logic.
  private static IS_KIND_LIMITS_CONFIGURED_FOR_LISTS: boolean = false;

  // this var getting initialized at the constructor.
  // keeps acceptable values for lists. Validations are using this array, instead of keep parsing the string at each call.
  private static ALLOWED_KINDS_FOR_LISTS: string[] = [];

  private static ALLOWED_KINDS_FOR_ENTITY_LIST_RELATIONS: string[] = [];

  private static IS_KIND_LIMITS_CONFIGURED_FOR_LIST_ENTITY_KINDS: boolean =
    false;

  private static DEFAULT_ENTITY_KIND: string = 'entity';
  private static DEFAULT_LIST_KIND: string = 'list';
  private static DEFAULT_RELATION_KIND: string = 'relation';

  static {
    this.initKindLimitConfigurations();
  }

  public get allowedKindsForEntities() {
    return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES;
  }

  public get allowedKindsForLists() {
    return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_LISTS;
  }

  public get allowedKindsForEntityListRelations() {
    return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITY_LIST_RELATIONS;
  }

  public get defaultEntityKind() {
    return KindLimitsConfigurationReader.DEFAULT_ENTITY_KIND;
  }

  public get defaultListKind() {
    return KindLimitsConfigurationReader.DEFAULT_LIST_KIND;
  }

  public get defaultRelationKind() {
    return KindLimitsConfigurationReader.DEFAULT_RELATION_KIND;
  }

  private static initKindLimitConfigurations() {
    if (_.has(process.env, 'entity_kinds')) {
      KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_ENTITIES =
        true;

      const kinds = _.split(process.env['entity_kinds'], ',').map(_.trim);

      KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES.push(
        ...kinds,
        KindLimitsConfigurationReader.DEFAULT_ENTITY_KIND,
      );
    }

    if (_.has(process.env, 'list_kinds')) {
      KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_LISTS = true;

      const kinds = _.split(process.env['list_kinds'], ',').map(_.trim);

      KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_LISTS.push(
        ...kinds,
        KindLimitsConfigurationReader.DEFAULT_LIST_KIND,
      );
    }

    if (_.has(process.env, 'list_entity_rel_kinds')) {
      KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_LIST_ENTITY_KINDS =
        true;

      const kinds = _.split(process.env['list_entity_rel_kinds'], ',').map(
        _.trim,
      );

      KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITY_LIST_RELATIONS.push(
        ...kinds,
        KindLimitsConfigurationReader.DEFAULT_RELATION_KIND,
      );
    }
  }

  public isKindAcceptableForEntity(kind: string) {
    if (KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_ENTITIES) {
      return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES.includes(
        kind,
      );
    }

    return true;
  }

  public isKindAcceptableForList(kind: string) {
    if (KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_LISTS) {
      return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_LISTS.includes(
        kind,
      );
    }

    return true;
  }

  public isKindAcceptableForListEntityRelations(kind: string) {
    if (
      KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_LIST_ENTITY_KINDS
    ) {
      return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITY_LIST_RELATIONS.includes(
        kind,
      );
    }

    return true;
  }
}
