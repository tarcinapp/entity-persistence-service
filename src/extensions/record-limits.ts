import {BindingKey} from '@loopback/core';
import _ from 'lodash';
import qs from 'qs';
import {Set} from '../extensions/set';

export namespace RecordLimitsBindings {
  export const CONFIG_READER = BindingKey.create<RecordLimitsConfigurationReader>(
    'extensions.record-limits.configurationreader',
  );
}

export class RecordLimitsConfigurationReader {

  constructor() {

  }

  public isRecordLimitsConfiguredForEntities(kind?: string) {
    return _.has(process.env, 'record_limit_entity_count') || this.isLimitConfiguredForKindForEntities(kind);
  }

  public isLimitConfiguredForKindForEntities(kind?: string) {
    return _.has(process.env, `record_limit_entity_count_for_${kind}`);
  }

  public getRecordLimitsCountForEntities(kind?: string) {

    if (_.has(process.env, `record_limit_entity_count_for_${kind}`)) {
      return _.toInteger(_.get(process.env, `record_limit_entity_count_for_${kind}`));
    }

    if (_.has(process.env, `record_limit_entity_count`)) {
      return _.toInteger(_.get(process.env, `record_limit_entity_count`));
    }
  }

  public getRecordLimitsSetForEntities(ownerUsers?: (string | undefined)[], ownerGroups?: (string | undefined)[], kind?: string): Set | undefined {

    let setStr: string | undefined;

    setStr = _.get(process.env, `record_limit_entity_set_for_${kind}`);

    if (!setStr) {
      setStr = _.get(process.env, 'record_limit_entity_set');
    }

    if (setStr) {
      setStr = setStr.replace(/(set\[.*owners\])/g, '$1='
        + (ownerUsers ? ownerUsers?.join(',') : '')
        + ';'
        + (ownerGroups ? ownerGroups?.join(',') : ''));

      return (qs.parse(setStr)).set as Set;
    }
  }
}