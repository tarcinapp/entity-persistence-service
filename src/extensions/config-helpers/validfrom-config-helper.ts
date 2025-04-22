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
  defaultEntityReactionAutoApprove: boolean = false;
  defaultListReactionAutoApprove: boolean = false;

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

  public getValidFromForListEntityRelations(kind?: string) {
    if (_.has(process.env, `autoapprove_list_entity_relations_for_${kind}`)) {
      return (
        _.get(process.env, `autoapprove_list_entity_relations_for_${kind}`) ===
        'true'
      );
    }

    if (_.has(process.env, `autoapprove_list_entity_relations`)) {
      return _.get(process.env, `autoapprove_list_entity_relations`) === 'true';
    }

    return this.defaultListEntityAutoApprove;
  }

  public getValidFromForEntityReactions(kind?: string) {
    if (_.has(process.env, `autoapprove_entity_reaction_for_${kind}`)) {
      return (
        _.get(process.env, `autoapprove_entity_reaction_for_${kind}`) === 'true'
      );
    }

    if (_.has(process.env, `autoapprove_entity_reaction`)) {
      return _.get(process.env, `autoapprove_entity_reaction`) === 'true';
    }

    return this.defaultEntityReactionAutoApprove;
  }

  public getValidFromForListReactions(kind?: string) {
    if (_.has(process.env, `autoapprove_list_reaction_for_${kind}`)) {
      return (
        _.get(process.env, `autoapprove_list_reaction_for_${kind}`) === 'true'
      );
    }

    if (_.has(process.env, `autoapprove_list_reaction`)) {
      return _.get(process.env, `autoapprove_list_reaction`) === 'true';
    }

    return this.defaultListReactionAutoApprove;
  }
}
