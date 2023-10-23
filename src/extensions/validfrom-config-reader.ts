import {BindingKey} from '@loopback/core';
import _ from 'lodash';

export namespace ValidFromConfigBindings {
  export const CONFIG_READER = BindingKey.create<ValidfromConfigurationReader>(
    'extensions.validfrom.configurationreader',
  );
}

export class ValidfromConfigurationReader {

  defaultEntityAutoApprove: boolean = false;

  constructor() {

  }

  public getValidFromForEntities(kind?: string) {

    if (_.has(process.env, `autoapprove_entity_for_${kind}`)) {
      return _.get(process.env, `autoapprove_entity_for_${kind}`) == 'true';
    }

    if (_.has(process.env, `autoapprove_entity`)) {
      return _.get(process.env, `autoapprove_entity`) == 'true';
    }

    return this.defaultEntityAutoApprove;
  }
}
