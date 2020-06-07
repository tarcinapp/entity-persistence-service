import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'EntityDb',
  connector: 'mongodb',
  url: 'mongodb://entityrwappuser:Tarcinapp123!@entity-db:27017/tarcinapp',
  host: 'entity-db',
  port: 27017,
  user: 'entityrwappuser',
  password: 'Tarcinapp123!',
  database: 'tarcinapp',
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
