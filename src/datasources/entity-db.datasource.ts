import { inject, lifeCycleObserver, LifeCycleObserver } from '@loopback/core';
import { juggler } from '@loopback/repository';

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

@lifeCycleObserver('datasource')
export class EntityDbDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static dataSourceName = 'EntityDb';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.EntityDb', { optional: true })
    dsConfig: object = config,
  ) {
    if (process.env.NODE_ENV === 'test') {
      super({ ...dsConfig, connector: 'memory' });
    } else {
      super(dsConfig);
    }
  }
}
