import { inject, lifeCycleObserver, LifeCycleObserver } from '@loopback/core';
import { juggler } from '@loopback/repository';

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
    const config = {
      name: 'EntityDb',
      connector: 'mongodb',
      url: process.env['mongodb_url'],
      database: process.env['mongodb_database'],
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ...(process.env['mongodb_url']
        ? {}
        : {
            host: process.env['mongodb_host'],
            port: process.env['mongodb_port'],
            user: process.env['mongodb_user'],
            password: process.env['mongodb_password'],
          }),
    };

    super({ ...dsConfig, ...config });
  }
}
