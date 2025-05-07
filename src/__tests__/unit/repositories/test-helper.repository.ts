import { juggler } from '@loopback/repository';
import { EntityPersistenceApplication } from '../../..';
import type { EntityDbDataSource } from '../../../datasources';
import {
  IdempotencyConfigurationReader,
  KindConfigurationReader,
  RecordLimitsConfigurationReader,
  ResponseLimitConfigurationReader,
  UniquenessConfigurationReader,
  ValidfromConfigurationReader,
  VisibilityConfigurationReader,
} from '../../../extensions';
import {
  LookupBindings,
  LookupHelper,
} from '../../../extensions/utils/lookup-helper';

export async function setupRepositoryTest(): Promise<{
  app: EntityPersistenceApplication;
  dataSource: juggler.DataSource;
  configReaders: {
    uniquenessConfigReader: UniquenessConfigurationReader;
    recordLimitConfigReader: RecordLimitsConfigurationReader;
    kindConfigReader: KindConfigurationReader;
    visibilityConfigReader: VisibilityConfigurationReader;
    validfromConfigReader: ValidfromConfigurationReader;
    idempotencyConfigReader: IdempotencyConfigurationReader;
    responseLimitConfigReader: ResponseLimitConfigurationReader;
  };
}> {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Create test-specific datasource config
  const testConfig = {
    name: 'EntityDb',
    connector: 'memory',
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  const app = new EntityPersistenceApplication();
  const dataSource = new juggler.DataSource(testConfig) as EntityDbDataSource;

  // Create configuration readers with default test settings
  const uniquenessConfigReader = new UniquenessConfigurationReader();
  const recordLimitConfigReader = new RecordLimitsConfigurationReader();
  const kindConfigReader = new KindConfigurationReader();
  const visibilityConfigReader = new VisibilityConfigurationReader();
  const validfromConfigReader = new ValidfromConfigurationReader();
  const idempotencyConfigReader = new IdempotencyConfigurationReader();
  const responseLimitConfigReader = new ResponseLimitConfigurationReader();

  // Add lookup helper binding for tests
  app.bind(LookupBindings.HELPER).toClass(LookupHelper);

  return {
    app,
    dataSource,
    configReaders: {
      uniquenessConfigReader,
      recordLimitConfigReader,
      kindConfigReader,
      visibilityConfigReader,
      validfromConfigReader,
      idempotencyConfigReader,
      responseLimitConfigReader,
    },
  };
}

export async function teardownRepositoryTest(
  app: EntityPersistenceApplication,
) {
  // Stop the app
  await app.stop();

  // Reset environment
  delete process.env.NODE_ENV;
}
