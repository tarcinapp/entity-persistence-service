import { BindingKey } from '@loopback/core';

import _, { cloneDeepWith, isEmpty } from 'lodash';
import { parse } from 'qs';
import type { Set, UserAndGroupInfo } from '../utils/set-helper';
import { EnvConfigHelper } from './env-config-helper';

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

  private env = EnvConfigHelper.getInstance();

  public isRecordLimitsConfiguredForEntities(kind?: string) {
    return (
      !!this.env.RECORD_LIMIT_ENTITY_COUNT ||
      this.isLimitConfiguredForKindForEntities(kind)
    );
  }

  public isLimitConfiguredForKindForEntities(kind?: string) {
    if (!kind) return false;
    return !!this.env.getRecordLimitEntityCountForKind(kind);
  }

  public getRecordLimitsCountForEntities(kind?: string) {
    const kindVal = kind ? this.env.getRecordLimitEntityCountForKind(kind) : undefined;
    if (kindVal !== undefined) {
      return Number(kindVal);
    }
    const generalVal = this.env.RECORD_LIMIT_ENTITY_COUNT;
    if (generalVal !== undefined) {
      return Number(generalVal);
    }
    return undefined;
  }

  public getRecordLimitsSetForEntities(
    ownerUsers?: (string | undefined)[],
    ownerGroups?: (string | undefined)[],
    kind?: string,
  ): Set | undefined {
    let setStr = '';
    // Kind-specific
    if (kind) {
      setStr = this.env.getRecordLimitEntityScopeForKind(kind) || '';
    }
    // General
    if (!setStr) {
      setStr = this.env.RECORD_LIMIT_ENTITY_SCOPE || '';
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
      const updatedSet = cloneDeepWith(set, (v, k) => {
        if (k === 'owners' || k === 'audience') {
          return userAndGroupInfo;
        }
      });
      return updatedSet as Set;
    }
    return undefined;
  }

  /////

  public isRecordLimitsConfiguredForLists(kind?: string) {
    return (
      !!this.env.RECORD_LIMIT_LIST_COUNT ||
      this.isLimitConfiguredForKindForLists(kind)
    );
  }

  public isLimitConfiguredForKindForLists(kind?: string) {
    if (!kind) return false;
    return !!this.env.getRecordLimitListCountForKind(kind);
  }

  public getRecordLimitsCountForLists(kind?: string) {
    const kindVal = kind ? this.env.getRecordLimitListCountForKind(kind) : undefined;
    if (kindVal !== undefined) {
      return Number(kindVal);
    }
    const generalVal = this.env.RECORD_LIMIT_LIST_COUNT;
    if (generalVal !== undefined) {
      return Number(generalVal);
    }
    return undefined;
  }

  public getRecordLimitsSetForLists(
    ownerUsers?: (string | undefined)[],
    ownerGroups?: (string | undefined)[],
    kind?: string,
  ): Set | undefined {
    let setStr = '';
    if (kind) {
      setStr = this.env.getRecordLimitListScopeForKind(kind) || '';
    }
    if (!setStr) {
      setStr = this.env.RECORD_LIMIT_LIST_SCOPE || '';
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
      const updatedSet = cloneDeepWith(set, (v, k) => {
        if (k === 'owners' || k === 'audience') {
          return userAndGroupInfo;
        }
      });
      return updatedSet as Set;
    }
    return undefined;
  }

  ///
  public isRecordLimitsConfiguredForListEntityCount(kind?: string) {
    return (
      !!this.env.RECORD_LIMIT_LIST_ENTITY_COUNT ||
      this.isLimitConfiguredForKindForListEntityCount(kind)
    );
  }

  public isLimitConfiguredForKindForListEntityCount(kind?: string) {
    if (!kind) return false;
    return !!this.env.getRecordLimitListEntityCountForKind(kind);
  }

  public getRecordLimitsCountForListEntityCount(kind?: string) {
    const kindVal = kind ? this.env.getRecordLimitListEntityCountForKind(kind) : undefined;
    if (kindVal !== undefined) {
      return Number(kindVal);
    }
    const generalVal = this.env.RECORD_LIMIT_LIST_ENTITY_COUNT;
    if (generalVal !== undefined) {
      return Number(generalVal);
    }
    return undefined;
  }

  ///
  public isRecordLimitsConfiguredForListEntityRelations(kind?: string) {
    return (
      !!this.env.RECORD_LIMIT_LIST_ENTITY_REL_COUNT ||
      this.isLimitConfiguredForKindForListEntityRelations(kind)
    );
  }

  public isLimitConfiguredForKindForListEntityRelations(kind?: string) {
    if (!kind) return false;
    return !!this.env.getRecordLimitListEntityRelCountForKind(kind);
  }

  public getRecordLimitsCountForListEntityRelations(kind?: string) {
    const kindVal = kind ? this.env.getRecordLimitListEntityRelCountForKind(kind) : undefined;
    if (kindVal !== undefined) {
      return Number(kindVal);
    }
    const generalVal = this.env.RECORD_LIMIT_LIST_ENTITY_REL_COUNT;
    if (generalVal !== undefined) {
      return Number(generalVal);
    }
    return undefined;
  }

  public getRecordLimitsSetForListEntityRelations(
    kind?: string,
  ): Set | undefined {
    let setStr = '';
    if (kind) {
      setStr = this.env.getRecordLimitListEntityRelScopeForKind(kind) || '';
    }
    if (!setStr) {
      setStr = this.env.RECORD_LIMIT_LIST_ENTITY_REL_SCOPE || '';
    }
    if (setStr) {
      const set = parse(setStr).set as Set;
      return set;
    }
    return undefined;
  }
}
