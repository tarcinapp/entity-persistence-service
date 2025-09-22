import { BindingKey } from '@loopback/core';
import _, { cloneDeepWith, isEmpty } from 'lodash';
import { parse } from 'qs';
import type { Set, UserAndGroupInfo } from '../utils/set-helper';
import { EnvConfigHelper } from './env-config-helper';

export const UniquenessBindings = {
  CONFIG_READER: BindingKey.create<UniquenessConfigurationReader>(
    'extensions.uniqueness.configurationreader',
  ),
} as const;

export class UniquenessConfigurationReader {
  private env = EnvConfigHelper.getInstance();
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
    const val = this.env.UNIQUENESS_ENTITY_FIELDS;
    if (typeof val === 'string') {
      this.isCommonEntityUniquenessConfigured = true;
      this.commonEntityUniquenessFields = val.replace(/\s/g, '').split(',');
    } else {
      this.isCommonEntityUniquenessConfigured = false;
    }
  }

  private initConfigForLists() {
    const val = this.env.UNIQUENESS_LIST_FIELDS;
    if (typeof val === 'string') {
      this.isCommonListUniquenessConfigured = true;
      this.commonListUniquenessFields = val.replace(/\s/g, '').split(',');
    } else {
      this.isCommonListUniquenessConfigured = false;
    }
  }

  private initConfigForListEntityRelations() {
    const val = this.env.UNIQUENESS_LIST_ENTITY_REL_FIELDS;
    if (typeof val === 'string') {
      this.isCommonListEntityRelUniquenessConfigured = true;
      this.commonListEntityRelUniquenessFields = val.replace(/\s/g, '').split(',');
    } else {
      this.isCommonListEntityRelUniquenessConfigured = false;
    }
  }

  public isUniquenessConfiguredForEntities(kind?: string): boolean {
    return (
      this.isCommonEntityUniquenessConfigured ??
      !!this.env.getUniquenessEntityFieldsForKind(kind)
    );
  }

  public getFieldsForEntities(kind?: string): string[] {
    if (kind) {
      if (_.has(this.kindEntityUniquenessFields, kind)) {
        return this.kindEntityUniquenessFields[kind];
      }
      const val = this.env.getUniquenessEntityFieldsForKind(kind);
      if (val) {
        const fields = val.replace(/\s/g, '').split(',');
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
    if (kind) {
      setStr = this.env.getUniquenessEntityScopeForKind(kind) || '';
    }
    if (!setStr) {
      setStr = this.env.UNIQUENESS_ENTITY_SCOPE || '';
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
  }

  public isUniquenessConfiguredForLists(kind?: string): boolean {
    return (
      this.isCommonListUniquenessConfigured ??
      !!this.env.getUniquenessListFieldsForKind(kind)
    );
  }

  public getFieldsForLists(kind?: string): string[] {
    if (kind) {
      if (_.has(this.kindListUniquenessFields, kind)) {
        return this.kindListUniquenessFields[kind];
      }
      const val = this.env.getUniquenessListFieldsForKind(kind);
      if (val) {
        const fields = val.replace(/\s/g, '').split(',');
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
    if (kind) {
      setStr = this.env.getUniquenessListScopeForKind(kind) || '';
    }
    if (!setStr) {
      setStr = this.env.UNIQUENESS_LIST_SCOPE || '';
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
  }

  public isUniquenessConfiguredForListEntityRelations(kind?: string): boolean {
    return (
      this.isCommonListEntityRelUniquenessConfigured ??
      !!this.env.getUniquenessListEntityRelFieldsForKind(kind)
    );
  }

  public getFieldsForListEntityRelations(kind?: string): string[] {
    if (kind) {
      if (_.has(this.kindListEntityRelUniquenessFields, kind)) {
        return this.kindListEntityRelUniquenessFields[kind];
      }
      const val = this.env.getUniquenessListEntityRelFieldsForKind(kind);
      if (val) {
        const fields = val.replace(/\s/g, '').split(',');
        this.kindListEntityRelUniquenessFields[kind] = fields;
        return fields;
      }
    }
    return this.commonListEntityRelUniquenessFields;
  }

  public getSetForListEntityRelations(kind?: string): Set | undefined {
    let setStr = '';
    if (kind) {
      setStr = this.env.getUniquenessListEntityRelScopeForKind(kind) || '';
    }
    if (!setStr) {
      setStr = this.env.UNIQUENESS_LIST_ENTITY_REL_SCOPE || '';
    }
    if (setStr) {
      const set = parse(setStr).set as Set;
      return set;
    }
  }
}
