import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'EntityDb',
  connector: 'mongodb',
  host: process.env["db_host"],
  port: process.env["db_port"],
  user: process.env["db_user"],
  password: process.env["db_password"],
  database: process.env["db_database"],
  useNewUrlParser: true
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class EntityDbDataSource extends juggler.DataSource
  implements LifeCycleObserver {
  static dataSourceName = 'EntityDb';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.EntityDb', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}
