import { BindingKey } from '@loopback/core';
import _, { cloneDeepWith, isEmpty } from 'lodash';
import { parse } from 'qs';
import type { Set, UserAndGroupInfo } from '../utils/set-helper';

export const RecordLimitsBindings = {
  CONFIG_READER: BindingKey.create<RecordLimitsConfigurationReader>(
    'extensions.record-limits.configurationreader',
  ),
} as const;

/**
 * This class is helper to read configuration made to limit number of records
 * in the database.
 * Repository implementation can communicate with this class to generate the scope
 * to where the limit needs to be applied (set), and to get the limit integer.
 */
export class RecordLimitsConfigurationReader {
  public isRecordLimitsConfiguredForEntities(kind?: string) {
    return (
      _.has(process.env, 'record_limit_entity_count') ||
      this.isLimitConfiguredForKindForEntities(kind)
    );
  }

  public isLimitConfiguredForKindForEntities(kind?: string) {
    return _.has(process.env, `record_limit_entity_count_for_${kind}`);
  }

  public getRecordLimitsCountForEntities(kind?: string) {
    if (_.has(process.env, `record_limit_entity_count_for_${kind}`)) {
      return _.toInteger(
        _.get(process.env, `record_limit_entity_count_for_${kind}`),
      );
    }

    if (_.has(process.env, `record_limit_entity_count`)) {
      return _.toInteger(_.get(process.env, `record_limit_entity_count`));
    }
  }

  public getRecordLimitsSetForEntities(
    ownerUsers?: (string | undefined)[],
    ownerGroups?: (string | undefined)[],
    kind?: string,
  ): Set | undefined {
    let setStr = '';
    // Check if there is a kind specific configuration
    if (_.has(process.env, `record_limit_entity_scope_for_${kind}`)) {
      const value = _.get(process.env, `record_limit_entity_scope_for_${kind}`);
      if (value) {
        setStr = value;
      }
    }

    // If there is no kind specific configuration, check if there is a general configuration
    if (!setStr && process.env.record_limit_entity_scope) {
      setStr = process.env.record_limit_entity_scope;
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

  /////

  public isRecordLimitsConfiguredForLists(kind?: string) {
    return (
      _.has(process.env, 'record_limit_list_count') ||
      this.isLimitConfiguredForKindForLists(kind)
    );
  }

  public isLimitConfiguredForKindForLists(kind?: string) {
    return _.has(process.env, `record_limit_list_count_for_${kind}`);
  }

  public getRecordLimitsCountForLists(kind?: string) {
    if (_.has(process.env, `record_limit_list_count_for_${kind}`)) {
      return _.toInteger(
        _.get(process.env, `record_limit_list_count_for_${kind}`),
      );
    }

    if (_.has(process.env, `record_limit_list_count`)) {
      return _.toInteger(_.get(process.env, `record_limit_list_count`));
    }
  }

  public getRecordLimitsSetForLists(
    ownerUsers?: (string | undefined)[],
    ownerGroups?: (string | undefined)[],
    kind?: string,
  ): Set | undefined {
    let setStr = '';
    // Check if there is a kind specific configuration
    if (_.has(process.env, `record_limit_list_scope_for_${kind}`)) {
      const value = _.get(process.env, `record_limit_list_scope_for_${kind}`);
      if (value) {
        setStr = value;
      }
    }

    // If there is no kind specific configuration, check if there is a general configuration
    if (!setStr && process.env.record_limit_list_scope) {
      setStr = process.env.record_limit_list_scope;
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

  ///
  public isRecordLimitsConfiguredForListEntityRelations(kind?: string) {
    return (
      _.has(process.env, 'record_limit_list_entity_rel_count') ||
      this.isLimitConfiguredForKindForListEntityRelations(kind)
    );
  }

  public isLimitConfiguredForKindForListEntityRelations(kind?: string) {
    return _.has(process.env, `record_limit_list_entity_rel_count_for_${kind}`);
  }

  public getRecordLimitsCountForListEntityRelations(kind?: string) {
    if (_.has(process.env, `record_limit_list_entity_rel_count_for_${kind}`)) {
      return _.toInteger(
        _.get(process.env, `record_limit_list_entity_rel_count_for_${kind}`),
      );
    }

    if (_.has(process.env, `record_limit_list_entity_rel_count`)) {
      return _.toInteger(
        _.get(process.env, `record_limit_list_entity_rel_count`),
      );
    }
  }

  public getRecordLimitsSetForListEntityRelations(
    kind?: string,
  ): Set | undefined {
    let setStr = '';
    // Check if there is a kind specific configuration
    if (_.has(process.env, `record_limit_list_entity_rel_scope_for_${kind}`)) {
      const value = _.get(
        process.env,
        `record_limit_list_entity_rel_scope_for_${kind}`,
      );
      if (value) {
        setStr = value;
      }
    }

    // If there is no kind specific configuration, check if there is a general configuration
    if (!setStr && process.env.record_limit_list_entity_rel_scope) {
      setStr = process.env.record_limit_list_entity_rel_scope;
    }

    if (setStr) {
      const set = parse(setStr).set as Set;

      return set;
    }
  }
}
