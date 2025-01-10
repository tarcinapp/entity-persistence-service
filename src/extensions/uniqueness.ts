import { BindingKey } from '@loopback/core';
import _, { cloneDeepWith, isEmpty } from 'lodash';
import qs from 'qs';
import { Set, UserAndGroupInfo } from '../extensions/set';

export namespace UniquenessBindings {
  export const CONFIG_READER = BindingKey.create<UniquenessConfigurationReader>(
    'extensions.uniqueness.configurationreader',
  );
}

export class UniquenessConfigurationReader {
  // this setting keeps if uniqueness is configured for all entities in all kinds
  private static IS_COMMON_ENTITY_UNIQUENESS_IS_CONFIGURED: boolean | undefined;

  // this setting keeps the fields array for all entities in all kinds
  private static COMMON_ENTITY_UNIQUENESS_FIELDS: string[];

  // this setting keeps the fields array for entities by their kinds
  private static KIND_ENTITY_UNIQUENESS_FIELDS: { property: string[] } | {} =
    {};

  // --------------------------------------------------------------------------

  // this setting keeps if uniqueness is configured for all lists in all kinds
  private static IS_COMMON_LIST_UNIQUENESS_IS_CONFIGURED: boolean | undefined;

  // this setting keeps the fields array for all lists in all kinds
  private static COMMON_LIST_UNIQUENESS_FIELDS: string[];

  // this setting keeps the fields array for entities by their kinds
  private static KIND_LIST_UNIQUENESS_FIELDS: { property: string[] } | {} = {};

  ///

  private static IS_COMMON_LIST_ENTITY_REL_UNIQUENESS_IS_CONFIGURED:
    | boolean
    | undefined;
  private static COMMON_LIST_ENTITY_REL_UNIQUENESS_FIELDS: string[];
  private static KIND_LIST_ENTITY_REL_UNIQUENESS_FIELDS:
    | { property: string[] }
    | {} = {};

  constructor() {
    if (
      !_.isBoolean(
        UniquenessConfigurationReader.IS_COMMON_ENTITY_UNIQUENESS_IS_CONFIGURED,
      )
    )
      this.initConfigForEntities();

    if (
      !_.isBoolean(
        UniquenessConfigurationReader.IS_COMMON_LIST_UNIQUENESS_IS_CONFIGURED,
      )
    )
      this.initConfigForLists();

    if (
      !_.isBoolean(
        UniquenessConfigurationReader.IS_COMMON_LIST_ENTITY_REL_UNIQUENESS_IS_CONFIGURED,
      )
    )
      this.initConfigForListEntityRelations();
  }

  /**
   * Sets the static fields for entity uniqueness configurations
   */
  private initConfigForEntities() {
    if (_.isString(process.env.uniqueness_entity_fields)) {
      UniquenessConfigurationReader.IS_COMMON_ENTITY_UNIQUENESS_IS_CONFIGURED =
        true;

      UniquenessConfigurationReader.COMMON_ENTITY_UNIQUENESS_FIELDS =
        process.env.uniqueness_entity_fields.replace(/\s/g, '').split(',');
    } else {
      UniquenessConfigurationReader.IS_COMMON_ENTITY_UNIQUENESS_IS_CONFIGURED =
        false;
    }
  }

  private initConfigForLists() {
    if (_.isString(process.env.uniqueness_list_fields)) {
      UniquenessConfigurationReader.IS_COMMON_LIST_UNIQUENESS_IS_CONFIGURED =
        true;

      UniquenessConfigurationReader.COMMON_LIST_UNIQUENESS_FIELDS =
        process.env.uniqueness_list_fields.replace(/\s/g, '').split(',');
    } else {
      UniquenessConfigurationReader.IS_COMMON_LIST_UNIQUENESS_IS_CONFIGURED =
        false;
    }
  }

  private initConfigForListEntityRelations() {
    if (_.isString(process.env.uniqueness_list_entity_rel_fields)) {
      UniquenessConfigurationReader.IS_COMMON_LIST_ENTITY_REL_UNIQUENESS_IS_CONFIGURED =
        true;

      UniquenessConfigurationReader.COMMON_LIST_ENTITY_REL_UNIQUENESS_FIELDS =
        process.env.uniqueness_list_entity_rel_fields
          .replace(/\s/g, '')
          .split(',');
    } else {
      UniquenessConfigurationReader.IS_COMMON_LIST_ENTITY_REL_UNIQUENESS_IS_CONFIGURED =
        false;
    }
  }

  public isUniquenessConfiguredForEntities(kind?: string): boolean {
    return (
      UniquenessConfigurationReader.IS_COMMON_ENTITY_UNIQUENESS_IS_CONFIGURED ??
      _.has(process.env, `uniqueness_entity_fields_for_${kind}`)
    );
  }

  public getFieldsForEntities(kind?: string): string[] {
    if (kind) {
      // if fields are already configured in static field for the entity, return from the static field instead of parsing the config string
      if (
        _.has(UniquenessConfigurationReader.KIND_ENTITY_UNIQUENESS_FIELDS, kind)
      )
        return _.get(
          UniquenessConfigurationReader.KIND_ENTITY_UNIQUENESS_FIELDS,
          kind,
        );

      if (_.has(process.env, `uniqueness_entity_fields_for_${kind}`)) {
        const fields = _.get(
          process.env,
          `uniqueness_entity_fields_for_${kind}`,
        )!
          .replace(/\s/g, '')
          .split(',');

        UniquenessConfigurationReader.KIND_ENTITY_UNIQUENESS_FIELDS = _.set(
          UniquenessConfigurationReader.KIND_ENTITY_UNIQUENESS_FIELDS,
          kind,
          fields,
        );

        return fields;
      }
    }

    return UniquenessConfigurationReader.COMMON_ENTITY_UNIQUENESS_FIELDS;
  }

  public getSetForEntities(
    ownerUsers?: (string | undefined)[],
    ownerGroups?: (string | undefined)[],
    kind?: string,
  ): Set | undefined {
    let setStr: string | undefined;

    if (process.env.uniqueness_entity_set)
      setStr = process.env.uniqueness_entity_set;

    if (_.has(process.env, `uniqueness_entity_set_for_${kind}`))
      setStr = _.get(process.env, `uniqueness_entity_set_for_${kind}`);

    if (setStr) {
      const set = qs.parse(setStr).set as Set;
      const userAndGroupInfo: UserAndGroupInfo = {};

      if (!isEmpty(ownerUsers)) {
        userAndGroupInfo.userIds = ownerUsers?.join(',');
      }

      if (!isEmpty(ownerGroups)) {
        userAndGroupInfo.groupIds = ownerGroups?.join(',');
      }

      // Use _.cloneDeepWith for inline recursive replacement
      const updatedSet = cloneDeepWith(set, (v, k) => {
        if (k === 'owners' || k === 'audience') {
          return userAndGroupInfo;
        }
      });

      return updatedSet as Set;
    }
  }

  public isUniquenessConfiguredForLists(kind?: string): boolean {
    return (
      UniquenessConfigurationReader.IS_COMMON_LIST_UNIQUENESS_IS_CONFIGURED ??
      _.has(process.env, `uniqueness_list_fields_for_${kind}`)
    );
  }

  public getFieldsForLists(kind?: string): string[] {
    if (kind) {
      // if fields are already configured in static field for the list, return from the static field instead of parsing the config string
      if (
        _.has(UniquenessConfigurationReader.KIND_LIST_UNIQUENESS_FIELDS, kind)
      )
        return _.get(
          UniquenessConfigurationReader.KIND_LIST_UNIQUENESS_FIELDS,
          kind,
        );

      if (_.has(process.env, `uniqueness_list_fields_for_${kind}`)) {
        const fields = _.get(process.env, `uniqueness_list_fields_for_${kind}`)!
          .replace(/\s/g, '')
          .split(',');

        UniquenessConfigurationReader.KIND_LIST_UNIQUENESS_FIELDS = _.set(
          UniquenessConfigurationReader.KIND_LIST_UNIQUENESS_FIELDS,
          kind,
          fields,
        );

        return fields;
      }
    }

    return UniquenessConfigurationReader.COMMON_LIST_UNIQUENESS_FIELDS;
  }

  public getSetForLists(
    ownerUsers?: (string | undefined)[],
    ownerGroups?: (string | undefined)[],
    kind?: string,
  ): Set | undefined {
    let setStr: string | undefined;

    if (process.env.uniqueness_list_set)
      setStr = process.env.uniqueness_list_set;

    if (_.has(process.env, `uniqueness_list_set_for_${kind}`))
      setStr = _.get(process.env, `uniqueness_list_set_for_${kind}`);

    if (setStr) {
      const set = qs.parse(setStr).set as Set;
      const userAndGroupInfo: UserAndGroupInfo = {};

      if (!isEmpty(ownerUsers)) {
        userAndGroupInfo.userIds = ownerUsers?.join(',');
      }

      if (!isEmpty(ownerGroups)) {
        userAndGroupInfo.groupIds = ownerGroups?.join(',');
      }

      // Use _.cloneDeepWith for inline recursive replacement
      const updatedSet = cloneDeepWith(set, (v, k) => {
        if (k === 'owners' || k === 'audience') {
          return userAndGroupInfo;
        }
      });

      return updatedSet as Set;
    }
  }

  public isUniquenessConfiguredForListEntityRelations(kind?: string): boolean {
    return (
      UniquenessConfigurationReader.IS_COMMON_LIST_ENTITY_REL_UNIQUENESS_IS_CONFIGURED ??
      _.has(process.env, `uniqueness_list_entity_rel_fields_for_${kind}`)
    );
  }

  public getFieldsForListEntityRelations(kind?: string): string[] {
    if (kind) {
      // If fields are already configured for the kind, return from static field
      if (
        _.has(
          UniquenessConfigurationReader.KIND_LIST_ENTITY_REL_UNIQUENESS_FIELDS,
          kind,
        )
      )
        return _.get(
          UniquenessConfigurationReader.KIND_LIST_ENTITY_REL_UNIQUENESS_FIELDS,
          kind,
        );

      if (_.has(process.env, `uniqueness_list_entity_rel_fields_for_${kind}`)) {
        const fields = _.get(
          process.env,
          `uniqueness_list_entity_rel_fields_for_${kind}`,
        )!
          .replace(/\s/g, '')
          .split(',');

        UniquenessConfigurationReader.KIND_LIST_ENTITY_REL_UNIQUENESS_FIELDS =
          _.set(
            UniquenessConfigurationReader.KIND_LIST_ENTITY_REL_UNIQUENESS_FIELDS,
            kind,
            fields,
          );

        return fields;
      }
    }

    return UniquenessConfigurationReader.COMMON_LIST_ENTITY_REL_UNIQUENESS_FIELDS;
  }

  public getSetForListEntityRelations(kind?: string): Set | undefined {
    let setStr: string | undefined;

    if (_.has(process.env, `uniqueness_list_entity_rel_set_for_${kind}`))
      setStr = _.get(process.env, `uniqueness_list_entity_rel_set_for_${kind}`);

    if (!setStr && process.env.uniqueness_list_entity_rel_set)
      setStr = process.env.uniqueness_list_entity_rel_set;

    if (setStr) {
      const set = qs.parse(setStr).set as Set;
      return set;
    }
  }
}
