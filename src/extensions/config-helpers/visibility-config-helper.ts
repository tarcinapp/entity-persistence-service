import { BindingKey } from '@loopback/core';
import _ from 'lodash';

export const VisibilityConfigBindings = {
  CONFIG_READER: BindingKey.create<VisibilityConfigurationReader>(
    'extensions.visibility.configurationreader',
  ),
};

export class VisibilityConfigurationReader {
  defaultEntityVisibility: string = 'protected';
  defaultListVisibility: string = 'protected';
  defaultEntityReactionVisibility: string = 'protected';
  defaultListReactionVisibility: string = 'protected';

  public isVisibilityConfiguredForEntities(kind?: string) {
    return (
      _.has(process.env, 'visibility_entity') ||
      this.isVisibilityConfiguredForKindForEntities(kind)
    );
  }

  public isVisibilityConfiguredForKindForEntities(kind?: string): boolean {
    return _.has(process.env, `visibility_entity_for_${kind}`);
  }

  public getVisibilityForEntities(kind?: string) {
    if (_.has(process.env, `visibility_entity_for_${kind}`)) {
      return _.get(process.env, `visibility_entity_for_${kind}`);
    }

    if (_.has(process.env, `visibility_entity`)) {
      return _.get(process.env, `visibility_entity`);
    }

    return this.defaultEntityVisibility;
  }

  public isVisibilityConfiguredForLists(kind?: string) {
    return (
      _.has(process.env, 'visibility_list') ||
      this.isVisibilityConfiguredForKindForLists(kind)
    );
  }

  public isVisibilityConfiguredForKindForLists(kind?: string): boolean {
    return _.has(process.env, `visibility_list_for_${kind}`);
  }

  public getVisibilityForLists(kind?: string) {
    if (_.has(process.env, `visibility_list_for_${kind}`)) {
      return _.get(process.env, `visibility_list_for_${kind}`);
    }

    if (_.has(process.env, `visibility_list`)) {
      return _.get(process.env, `visibility_list`);
    }

    return this.defaultListVisibility;
  }

  public isVisibilityConfiguredForEntityReactions(kind?: string) {
    return (
      _.has(process.env, 'visibility_entity_reaction') ||
      this.isVisibilityConfiguredForKindForEntityReactions(kind)
    );
  }

  public isVisibilityConfiguredForKindForEntityReactions(
    kind?: string,
  ): boolean {
    return _.has(process.env, `visibility_entity_reaction_for_${kind}`);
  }

  public getVisibilityForEntityReactions(kind?: string) {
    if (_.has(process.env, `visibility_entity_reaction_for_${kind}`)) {
      return _.get(process.env, `visibility_entity_reaction_for_${kind}`);
    }

    if (_.has(process.env, `visibility_entity_reaction`)) {
      return _.get(process.env, `visibility_entity_reaction`);
    }

    return this.defaultEntityReactionVisibility;
  }

  public isVisibilityConfiguredForListReactions(kind?: string) {
    return (
      _.has(process.env, 'visibility_list_reaction') ||
      this.isVisibilityConfiguredForKindForListReactions(kind)
    );
  }

  public isVisibilityConfiguredForKindForListReactions(kind?: string): boolean {
    return _.has(process.env, `visibility_list_reaction_for_${kind}`);
  }

  public getVisibilityForListReactions(kind?: string) {
    if (_.has(process.env, `visibility_list_reaction_for_${kind}`)) {
      return _.get(process.env, `visibility_list_reaction_for_${kind}`);
    }

    if (_.has(process.env, `visibility_list_reaction`)) {
      return _.get(process.env, `visibility_list_reaction`);
    }

    return this.defaultListReactionVisibility;
  }
}
