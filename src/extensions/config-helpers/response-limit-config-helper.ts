import { BindingKey } from '@loopback/core';
import _ from 'lodash';

export const ResponseLimitConfigBindings = {
  CONFIG_READER: BindingKey.create<ResponseLimitConfigurationReader>(
    'extensions.response-limit.configurationreader',
  ),
} as const;

export class ResponseLimitConfigurationReader {
  private static entityResponseLimit: number;
  private static listResponseLimit: number;
  private static listEntityRelResponseLimit: number;
  private static DEFAULT_RESPONSE_LIMIT = 50;

  static {
    this.initResponseLimits();
  }

  private static initResponseLimits() {
    const envEntityLimit = process.env.response_limit_entity;
    const envListLimit = process.env.response_limit_list;
    const envListEntityRelLimit = process.env.response_limit_list_entity_rel;

    this.entityResponseLimit = envEntityLimit
      ? _.parseInt(envEntityLimit)
      : this.DEFAULT_RESPONSE_LIMIT;
    this.listResponseLimit = envListLimit
      ? _.parseInt(envListLimit)
      : this.DEFAULT_RESPONSE_LIMIT;
    this.listEntityRelResponseLimit = envListEntityRelLimit
      ? _.parseInt(envListEntityRelLimit)
      : this.DEFAULT_RESPONSE_LIMIT;
  }

  public getEntityResponseLimit(): number {
    return ResponseLimitConfigurationReader.entityResponseLimit;
  }

  public getListResponseLimit(): number {
    return ResponseLimitConfigurationReader.listResponseLimit;
  }

  public getListEntityRelResponseLimit(): number {
    return ResponseLimitConfigurationReader.listEntityRelResponseLimit;
  }
}
