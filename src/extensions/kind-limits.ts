import {BindingKey} from '@loopback/core';
import _ from 'lodash';

export namespace KindLimitsBindings {
  export const CONFIG_READER = BindingKey.create<KindLimitsConfigurationReader>(
    'extensions.kind-limits.configurationreader',
  );
}

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

  static {
    this.initKindLimitConfigurations();
  }

  constructor() {
  }

  public get allowedKindsForEntities() {
    return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES;
  }

  public get allowedKindsForLists() {
    return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_LISTS;
  }

  private static initKindLimitConfigurations() {

    if (_.has(process.env, 'entity_kinds')) {
      KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_ENTITIES = true;

      let kinds = _.split(process.env['entity_kinds'], ',')
        .map(_.trim);

      KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES = kinds;
    }

    if (_.has(process.env, 'list_kinds')) {
      KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_LISTS = true;

      let kinds = _.split(process.env['list_kinds'], ',')
        .map(_.trim);

      KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_LISTS = kinds;
    }
  }

  public isKindAcceptableForEntity(kind: string) {

    if (KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_ENTITIES)
      return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES.includes(kind);

    return true;
  }

  public isKindAcceptableForList(kind: string) {
    if (KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_LISTS)
      return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_LISTS.includes(kind);

    return true;
  }
}
