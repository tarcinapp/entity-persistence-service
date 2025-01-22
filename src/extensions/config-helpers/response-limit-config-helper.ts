import { BindingKey } from '@loopback/core';
import _ from 'lodash';

export const ResponseLimitConfigBindings = {
  CONFIG_READER: BindingKey.create<ResponseLimitConfigurationReader>(
    'extensions.response-limit.configurationreader',
  ),
} as const;

export class ResponseLimitConfigurationReader {
  private readonly defaultResponseLimit = 50;
  private entityResponseLimit: number;
  private listResponseLimit: number;
  private listEntityRelResponseLimit: number;

  constructor() {
    this.initResponseLimits();
  }

  private initResponseLimits() {
    const envEntityLimit = process.env.response_limit_entity;
    const envListLimit = process.env.response_limit_list;
    const envListEntityRelLimit = process.env.response_limit_list_entity_rel;

    this.entityResponseLimit = envEntityLimit
      ? _.parseInt(envEntityLimit)
      : this.defaultResponseLimit;
    this.listResponseLimit = envListLimit
      ? _.parseInt(envListLimit)
      : this.defaultResponseLimit;
    this.listEntityRelResponseLimit = envListEntityRelLimit
      ? _.parseInt(envListEntityRelLimit)
      : this.defaultResponseLimit;
  }

  public getEntityResponseLimit(): number {
    return this.entityResponseLimit;
  }

  public getListResponseLimit(): number {
    return this.listResponseLimit;
  }

  public getListEntityRelResponseLimit(): number {
    return this.listEntityRelResponseLimit;
  }
}
