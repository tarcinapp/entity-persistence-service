import {BindingKey} from '@loopback/core';
import _ from 'lodash';

export namespace KindLimitsBindings {
  export const CONFIG_READER = BindingKey.create<KindLimitsConfigurationReader>(
    'extensions.kind-limits.configurationreader',
  );
}

export class KindLimitsConfigurationReader {

  // this var keeps if there is a configuration. Validation calls are checking if this value true
  // before executing validation logic. 
  private static IS_KIND_LIMITS_CONFIGURED_FOR_ENTITIES: boolean = false;

  // this var getting initialized at the constructor.
  // keeps acceptable values for entities. Validations are using this array, instead of keep parsing the string at each call.
  private static ALLOWED_KINDS_FOR_ENTITIES: string[] = [];

  static {
    this.initKindLimitConfigurations();
  }

  constructor() {
  }

  public get allowedKindsForEntities() {
    return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES;
  }

  private static initKindLimitConfigurations() {

    if (_.has(process.env, 'entity_kinds')) {
      KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_ENTITIES = true;

      let kinds = _.split(process.env['entity_kinds'], ',')
        .map(_.trim);

      KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES = kinds;
    }
  }

  public isKindAcceptableForEntity(kind: string) {

    if (KindLimitsConfigurationReader.IS_KIND_LIMITS_CONFIGURED_FOR_ENTITIES)
      return KindLimitsConfigurationReader.ALLOWED_KINDS_FOR_ENTITIES.includes(kind);

    return true;
  }
}