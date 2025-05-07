import { BindingKey } from '@loopback/core';
import _, { cloneDeepWith, isEmpty } from 'lodash';
import { parse } from 'qs';
import type { Set, UserAndGroupInfo } from '../utils/set-helper';

export const UniquenessBindings = {
  CONFIG_READER: BindingKey.create<UniquenessConfigurationReader>(
    'extensions.uniqueness.configurationreader',
  ),
} as const;

export class UniquenessConfigurationReader {
  // Entity uniqueness configuration
  private isCommonEntityUniquenessConfigured: boolean | undefined;
  private commonEntityUniquenessFields: string[] = [];
  private kindEntityUniquenessFields: { [key: string]: string[] } = {};

  // List uniqueness configuration
  private isCommonListUniquenessConfigured: boolean | undefined;
  private commonListUniquenessFields: string[] = [];
  private kindListUniquenessFields: { [key: string]: string[] } = {};

  // List-Entity relation uniqueness configuration
  private isCommonListEntityRelUniquenessConfigured: boolean | undefined;
  private commonListEntityRelUniquenessFields: string[] = [];
  private kindListEntityRelUniquenessFields: { [key: string]: string[] } = {};

  constructor() {
    this.initConfigForEntities();
    this.initConfigForLists();
    this.initConfigForListEntityRelations();
  }

  private initConfigForEntities() {
    if (_.isString(process.env.uniqueness_entity_fields)) {
      this.isCommonEntityUniquenessConfigured = true;
      this.commonEntityUniquenessFields = process.env.uniqueness_entity_fields
        .replace(/\s/g, '')
        .split(',');
    } else {
      this.isCommonEntityUniquenessConfigured = false;
    }
  }

  private initConfigForLists() {
    if (_.isString(process.env.uniqueness_list_fields)) {
      this.isCommonListUniquenessConfigured = true;
      this.commonListUniquenessFields = process.env.uniqueness_list_fields
        .replace(/\s/g, '')
        .split(',');
    } else {
      this.isCommonListUniquenessConfigured = false;
    }
  }

  private initConfigForListEntityRelations() {
    if (_.isString(process.env.uniqueness_list_entity_rel_fields)) {
      this.isCommonListEntityRelUniquenessConfigured = true;
      this.commonListEntityRelUniquenessFields =
        process.env.uniqueness_list_entity_rel_fields
          .replace(/\s/g, '')
          .split(',');
    } else {
      this.isCommonListEntityRelUniquenessConfigured = false;
    }
  }

  public isUniquenessConfiguredForEntities(kind?: string): boolean {
    return (
      this.isCommonEntityUniquenessConfigured ??
      _.has(process.env, `uniqueness_entity_fields_for_${kind}`)
    );
  }

  public getFieldsForEntities(kind?: string): string[] {
    if (kind) {
      // if fields are already configured for the entity kind, return from the cache
      if (_.has(this.kindEntityUniquenessFields, kind)) {
        return this.kindEntityUniquenessFields[kind];
      }

      if (_.has(process.env, `uniqueness_entity_fields_for_${kind}`)) {
        const fields = _.get(
          process.env,
          `uniqueness_entity_fields_for_${kind}`,
        )!
          .replace(/\s/g, '')
          .split(',');

        this.kindEntityUniquenessFields[kind] = fields;

        return fields;
      }
    }

    return this.commonEntityUniquenessFields;
  }

  public getSetForEntities(
    ownerUsers?: (string | undefined)[],
    ownerGroups?: (string | undefined)[],
    kind?: string,
  ): Set | undefined {
    let setStr = '';
    // Check if there is a kind specific configuration
    if (_.has(process.env, `uniqueness_entity_scope_for_${kind}`)) {
      const value = _.get(process.env, `uniqueness_entity_scope_for_${kind}`);
      if (value) {
        setStr = value;
      }
    }

    // If there is no kind specific configuration, check if there is a general configuration
    if (!setStr && process.env.uniqueness_entity_scope) {
      setStr = process.env.uniqueness_entity_scope;
    }

    if (setStr) {
      const set = parse(setStr).set as Set;
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
      this.isCommonListUniquenessConfigured ??
      _.has(process.env, `uniqueness_list_fields_for_${kind}`)
    );
  }

  public getFieldsForLists(kind?: string): string[] {
    if (kind) {
      // if fields are already configured for the list kind, return from the cache
      if (_.has(this.kindListUniquenessFields, kind)) {
        return this.kindListUniquenessFields[kind];
      }

      if (_.has(process.env, `uniqueness_list_fields_for_${kind}`)) {
        const fields = _.get(process.env, `uniqueness_list_fields_for_${kind}`)!
          .replace(/\s/g, '')
          .split(',');

        this.kindListUniquenessFields[kind] = fields;

        return fields;
      }
    }

    return this.commonListUniquenessFields;
  }

  public getSetForLists(
    ownerUsers?: (string | undefined)[],
    ownerGroups?: (string | undefined)[],
    kind?: string,
  ): Set | undefined {
    let setStr = '';
    // Check if there is a kind specific configuration
    if (_.has(process.env, `uniqueness_list_scope_for_${kind}`)) {
      const value = _.get(process.env, `uniqueness_list_scope_for_${kind}`);
      if (value) {
        setStr = value;
      }
    }

    // If there is no kind specific configuration, check if there is a general configuration
    if (!setStr && process.env.uniqueness_list_scope) {
      setStr = process.env.uniqueness_list_scope;
    }

    if (setStr) {
      const set = parse(setStr).set as Set;
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
      this.isCommonListEntityRelUniquenessConfigured ??
      _.has(process.env, `uniqueness_list_entity_rel_fields_for_${kind}`)
    );
  }

  public getFieldsForListEntityRelations(kind?: string): string[] {
    if (kind) {
      // If fields are already configured for the kind, return from static field
      if (_.has(this.kindListEntityRelUniquenessFields, kind)) {
        return this.kindListEntityRelUniquenessFields[kind];
      }

      if (_.has(process.env, `uniqueness_list_entity_rel_fields_for_${kind}`)) {
        const fields = _.get(
          process.env,
          `uniqueness_list_entity_rel_fields_for_${kind}`,
        )!
          .replace(/\s/g, '')
          .split(',');

        this.kindListEntityRelUniquenessFields[kind] = fields;

        return fields;
      }
    }

    return this.commonListEntityRelUniquenessFields;
  }

  public getSetForListEntityRelations(kind?: string): Set | undefined {
    let setStr = '';
    // Check if there is a kind specific configuration
    if (_.has(process.env, `uniqueness_list_entity_rel_scope_for_${kind}`)) {
      const value = _.get(
        process.env,
        `uniqueness_list_entity_rel_scope_for_${kind}`,
      );
      if (value) {
        setStr = value;
      }
    }

    // If there is no kind specific configuration, check if there is a general configuration
    if (!setStr && process.env.uniqueness_list_entity_rel_scope) {
      setStr = process.env.uniqueness_list_entity_rel_scope;
    }

    if (setStr) {
      const set = parse(setStr).set as Set;

      return set;
    }
  }
}
