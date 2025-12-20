import { BindingKey } from '@loopback/core';

import _ from 'lodash';
import { EnvConfigHelper } from './env-config-helper';

export const ResponseLimitConfigBindings = {
  CONFIG_READER: BindingKey.create<ResponseLimitConfigurationReader>(
    'extensions.response-limit.configurationreader',
  ),
} as const;

export class ResponseLimitConfigurationReader {
  private readonly defaultResponseLimit = 50;
  private env = EnvConfigHelper.getInstance();

  public getEntityResponseLimit(): number {
    return this.env.RESPONSE_LIMIT_ENTITY ?? this.defaultResponseLimit;
  }

  public getListResponseLimit(): number {
    return this.env.RESPONSE_LIMIT_LIST ?? this.defaultResponseLimit;
  }

  public getListEntityRelResponseLimit(): number {
    return this.env.RESPONSE_LIMIT_LIST_ENTITY_REL ?? this.defaultResponseLimit;
  }

  public getEntityReactionResponseLimit(): number {
    return this.env.RESPONSE_LIMIT_ENTITY_REACTION ?? this.defaultResponseLimit;
  }

  public getListReactionResponseLimit(): number {
    return this.env.RESPONSE_LIMIT_LIST_REACTION ?? this.defaultResponseLimit;
  }
}
