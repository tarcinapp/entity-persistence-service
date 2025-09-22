import { BindingKey } from '@loopback/core';

import _ from 'lodash';
import { EnvConfigHelper } from './env-config-helper';

export const ValidFromConfigBindings = {
  CONFIG_READER: BindingKey.create<ValidfromConfigurationReader>(
    'extensions.validfrom.configurationreader',
  ),
};

export class ValidfromConfigurationReader {
  private env = EnvConfigHelper.getInstance();
  defaultEntityAutoApprove: boolean = false;
  defaultListAutoApprove: boolean = false;
  defaultListEntityAutoApprove: boolean = false;
  defaultEntityReactionAutoApprove: boolean = false;
  defaultListReactionAutoApprove: boolean = false;

  public getValidFromForEntities(kind?: string) {
    if (kind) {
      const kindVal = this.env.getAutoApproveEntityForKind(kind);
      if (kindVal !== undefined) return kindVal;
    }
    if (this.env.AUTOAPPROVE_ENTITY !== undefined) {
      return this.env.AUTOAPPROVE_ENTITY;
    }
    return this.defaultEntityAutoApprove;
  }

  public getValidFromForLists(kind?: string) {
    if (kind) {
      const kindVal = this.env.getAutoApproveListForKind(kind);
      if (kindVal !== undefined) return kindVal;
    }
    if (this.env.AUTOAPPROVE_LIST !== undefined) {
      return this.env.AUTOAPPROVE_LIST;
    }
    return this.defaultListAutoApprove;
  }

  public getValidFromForListEntityRelations(kind?: string) {
    if (kind) {
      const kindVal = this.env.getAutoApproveListEntityRelationsForKind(kind);
      if (kindVal !== undefined) return kindVal;
    }
    if (this.env.AUTOAPPROVE_LIST_ENTITY_RELATIONS !== undefined) {
      return this.env.AUTOAPPROVE_LIST_ENTITY_RELATIONS;
    }
    return this.defaultListEntityAutoApprove;
  }

  public getValidFromForEntityReactions(kind?: string) {
    if (kind) {
      const kindVal = this.env.getAutoApproveEntityReactionForKind(kind);
      if (kindVal !== undefined) return kindVal;
    }
    if (this.env.AUTOAPPROVE_ENTITY_REACTION !== undefined) {
      return this.env.AUTOAPPROVE_ENTITY_REACTION;
    }
    return this.defaultEntityReactionAutoApprove;
  }

  public getValidFromForListReactions(kind?: string) {
    if (kind) {
      const kindVal = this.env.getAutoApproveListReactionForKind(kind);
      if (kindVal !== undefined) return kindVal;
    }
    if (this.env.AUTOAPPROVE_LIST_REACTION !== undefined) {
      return this.env.AUTOAPPROVE_LIST_REACTION;
    }
    return this.defaultListReactionAutoApprove;
  }
}
