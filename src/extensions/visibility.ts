import {BindingKey} from '@loopback/core';
import _ from 'lodash';

export namespace VisibilityConfigBindings {
  export const CONFIG_READER = BindingKey.create<VisibilityConfigurationReader>(
    'extensions.visibility.configurationreader',
  );
}

export class VisibilityConfigurationReader {

  defaultEntityVisibility: string = "protected";
  defaultListVisibility: string = "protected";

  /**
   *
   */
  constructor() {

  }

  public isVisibilityConfiguredForEntities(kind?: string) {
    return _.has(process.env, 'visibility_entity') || this.isVisibilityConfiguredForKindForEntities(kind);
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

  public getVisibilityForLists(kind: string | undefined) {

    if (_.has(process.env, `visibility_list_for_${kind}`)) {
      return _.get(process.env, `visibility_list_for_${kind}`);
    }

    if (_.has(process.env, `visibility_list`)) {
      return _.get(process.env, `visibility_list`);
    }

    return this.defaultListVisibility;
  }
}
