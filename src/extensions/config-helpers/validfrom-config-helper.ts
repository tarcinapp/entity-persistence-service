import { BindingKey } from '@loopback/core';
import _ from 'lodash';

export const ValidFromConfigBindings = {
  CONFIG_READER: BindingKey.create<ValidfromConfigurationReader>(
    'extensions.validfrom.configurationreader',
  ),
};

export class ValidfromConfigurationReader {
  defaultEntityAutoApprove: boolean = false;
  defaultListAutoApprove: boolean = false;
  defaultListEntityAutoApprove: boolean = false;

  public getValidFromForEntities(kind?: string) {
    if (_.has(process.env, `autoapprove_entity_for_${kind}`)) {
      return _.get(process.env, `autoapprove_entity_for_${kind}`) === 'true';
    }

    if (_.has(process.env, `autoapprove_entity`)) {
      return _.get(process.env, `autoapprove_entity`) === 'true';
    }

    return this.defaultEntityAutoApprove;
  }

  public getValidFromForLists(kind?: string) {
    if (_.has(process.env, `autoapprove_list_for_${kind}`)) {
      return _.get(process.env, `autoapprove_list_for_${kind}`) === 'true';
    }

    if (_.has(process.env, `autoapprove_list`)) {
      return _.get(process.env, `autoapprove_list`) === 'true';
    }

    return this.defaultListAutoApprove;
  }

  getValidFromForListEntityRelations(kind?: string) {
    if (_.has(process.env, `autoapprove_list_entity_relations_for_${kind}`)) {
      return (
        _.get(process.env, `autoapprove_list_entity_relations_for_${kind}`) ===
        'true'
      );
    }

    if (_.has(process.env, `autoapprove_list_entity_relations`)) {
      return _.get(process.env, `autoapprove_list_entity_relations`) === 'true';
    }

    return this.defaultListAutoApprove;
  }
}
