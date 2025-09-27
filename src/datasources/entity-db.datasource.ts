import { inject, lifeCycleObserver, LifeCycleObserver } from '@loopback/core';
import { juggler } from '@loopback/repository';
import { EnvConfigHelper } from '../extensions/config-helpers/env-config-helper';

@lifeCycleObserver('datasource')
export class EntityDbDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static dataSourceName = 'EntityDb';

  constructor(
    @inject('datasources.config.EntityDb', { optional: true })
    dsConfig: object = {},
  ) {
    const env = EnvConfigHelper.getInstance();
    const config = {
      name: 'EntityDb',
      connector: 'mongodb',
      url: env.MONGODB_URL,
      database: env.MONGODB_DATABASE,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ...(env.MONGODB_URL
        ? {}
        : {
            host: env.MONGODB_HOST,
            port: env.MONGODB_PORT,
            user: env.MONGODB_USER,
            password: env.MONGODB_PASSWORD,
          }),
    };

    super({ ...dsConfig, ...config });
  }
}
