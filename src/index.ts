import type {} from './extensions/types/inclusion-augmentation';
import { RestBindings } from '@loopback/rest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { parse } from 'qs';
import type { ApplicationConfig } from './application';
import { EntityPersistenceApplication } from './application';
import {
  UniquenessBindings,
  UniquenessConfigurationReader,
  VisibilityConfigBindings,
  VisibilityConfigurationReader,
  IdempotencyConfigBindings,
  IdempotencyConfigurationReader,
  RecordLimitsBindings,
  RecordLimitsConfigurationReader,
  ValidFromConfigBindings,
  ValidfromConfigurationReader,
  ResponseLimitConfigBindings,
  ResponseLimitConfigurationReader,
  KindBindings,
  KindConfigurationReader,
} from './extensions';
import { LookupBindings, LookupHelper } from './extensions/utils/lookup-helper';
import {
  MongoPipelineHelper,
  MongoPipelineHelperBindings,
} from './extensions/utils/mongo-pipeline-helper';
import { LookupConstraintBindings } from './services/lookup-constraint.bindings';
import { LookupConstraintService } from './services/lookup-constraint.service';
import { RecordLimitCheckerBindings } from './services/record-limit-checker.bindings';
import { RecordLimitCheckerService } from './services/record-limit-checker.service';

export * from './application';

let mongod: MongoMemoryServer | undefined;

async function setupInMemoryMongoDB() {
  // Check if we're in production or if MongoDB config is provided
  const hasMongoConfig = !!(
    process.env['mongodb_url'] ??
    (process.env['mongodb_host'] &&
      process.env['mongodb_port'] &&
      process.env['mongodb_user'] &&
      process.env['mongodb_password'])
  );

  if (process.env.NODE_ENV !== 'production' && !hasMongoConfig) {
    // Create and start in-memory MongoDB instance
    mongod = new MongoMemoryServer();
    await mongod.start();
    const uri = mongod.getUri();

    // Set MongoDB environment variables
    process.env['mongodb_url'] = uri;
    process.env['mongodb_database'] = 'memory-db';
  }
}

export async function main(options: ApplicationConfig = {}) {
  // Set up in-memory MongoDB if needed
  await setupInMemoryMongoDB();

  const app = new EntityPersistenceApplication(options);

  app.bind(RestBindings.ERROR_WRITER_OPTIONS).to({
    debug: process.env.NODE_ENV !== 'production',
    safeFields: ['errorCode', 'message'],
  });

  // add uniqueness configuration reader to context
  app
    .bind(UniquenessBindings.CONFIG_READER)
    .toClass(UniquenessConfigurationReader);

  // add record limits configuration reader to context
  app
    .bind(RecordLimitsBindings.CONFIG_READER)
    .toClass(RecordLimitsConfigurationReader);

  // add kind limits configuration reader to context

  app
    .bind(VisibilityConfigBindings.CONFIG_READER)
    .toClass(VisibilityConfigurationReader);

  app
    .bind(IdempotencyConfigBindings.CONFIG_READER)
    .toClass(IdempotencyConfigurationReader);

  app
    .bind(ValidFromConfigBindings.CONFIG_READER)
    .toClass(ValidfromConfigurationReader);

  // add response limit configuration reader to context
  app
    .bind(ResponseLimitConfigBindings.CONFIG_READER)
    .toClass(ResponseLimitConfigurationReader);

  app.bind(KindBindings.CONFIG_READER).toClass(KindConfigurationReader);

  // add lookup helper to context
  app.bind(LookupBindings.HELPER).toClass(LookupHelper);

  // add mongo pipeline helper to context
  app.bind(MongoPipelineHelperBindings.HELPER).toClass(MongoPipelineHelper);

  // add record limit checker service to context
  app
    .bind(RecordLimitCheckerBindings.SERVICE)
    .toClass(RecordLimitCheckerService);

  // add lookup constraint service to context
  app.bind(LookupConstraintBindings.SERVICE).toClass(LookupConstraintService);

  await app.boot();
  await app.start();

  const url = app.restServer.url;
  // eslint-disable-next-line no-console
  console.log(`Server is running at ${url}`);
  // eslint-disable-next-line no-console
  console.log(`Try ${url}/ping`);

  return app;
}

if (require.main === module) {
  // Run the application
  const config = {
    rest: {
      port: +(process.env.PORT ?? 3000),
      host: process.env.HOST,
      // The `gracePeriodForClose` provides a graceful close for http/https
      // servers with keep-alive clients. The default value is `Infinity`
      // (don't force-close). If you want to immediately destroy all sockets
      // upon stop, set its value to `0`.
      // See https://www.npmjs.com/package/stoppable
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true,
      },
      expressSettings: {
        'x-powered-by': false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'query parser': (query: any) => {
          return parse(query, { depth: 10 });
        },
      },
    },
  };
  main(config).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}
