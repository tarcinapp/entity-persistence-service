import { RestBindings } from '@loopback/rest';
import type { Client } from '@loopback/testlab';
import { createRestAppClient, givenHttpServerConfig } from '@loopback/testlab';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { EntityPersistenceApplication } from '../..';
import { EntityDbDataSource } from '../../datasources/entity-db.datasource';
import {
  UniquenessBindings,
  UniquenessConfigurationReader,
  RecordLimitsBindings,
  RecordLimitsConfigurationReader,
  VisibilityConfigBindings,
  VisibilityConfigurationReader,
  IdempotencyConfigBindings,
  IdempotencyConfigurationReader,
  ValidFromConfigBindings,
  ValidfromConfigurationReader,
  ResponseLimitConfigBindings,
  ResponseLimitConfigurationReader,
  KindBindings,
  KindConfigurationReader,
} from '../../extensions';

export interface TestEnvironmentVariables {
  // Database Configuration
  mongodb_url?: string;
  mongodb_database?: string;
  mongodb_host?: string;
  mongodb_port?: string;
  mongodb_user?: string;
  mongodb_password?: string;

  // Collection Names
  collection_entity?: string;
  collection_list?: string;
  collection_list_entity_rel?: string;
  collection_entity_reaction?: string;
  collection_list_reaction?: string;
  collection_tag?: string;
  collection_list_tag_rel?: string;
  collection_entity_tag_rel?: string;

  // Allowed Kinds Configuration
  entity_kinds?: string;
  list_kinds?: string;
  list_entity_rel_kinds?: string;

  // Default Values Configuration
  // default_entity_kind?: string;
  // default_list_kind?: string;
  // default_relation_kind?: string;

  // Uniqueness Configuration
  uniqueness_entity_fields?: string;
  uniqueness_list_fields?: string;
  uniqueness_list_entity_rel_fields?: string;
  uniqueness_entity_set?: string;
  uniqueness_list_set?: string;
  uniqueness_list_entity_rel_set?: string;

  // Auto Approve Configuration
  autoapprove_entity?: string;
  autoapprove_list?: string;
  autoapprove_list_entity_relations?: string;

  // Visibility Configuration
  visibility_entity?: string;
  visibility_list?: string;
  visibility_entity_reaction?: string;
  visibility_list_reaction?: string;

  // Response Limits Configuration
  response_limit_entity?: string;
  response_limit_list_entity_rel?: string;
  response_limit_entity_reaction?: string;
  response_limit_list_reaction?: string;

  // Record Limits Configuration
  record_limit_entity_count?: string;
  record_limit_entity_set?: string;
  record_limit_list_count?: string;
  record_limit_list_set?: string;
  record_limit_list_entity_rel_count?: string;
  record_limit_list_entity_rel_set?: string;
  record_limit_entity_reaction_count?: string;
  record_limit_entity_reaction_set?: string;
  record_limit_list_reaction_count?: string;
  record_limit_list_reaction_set?: string;
  record_limit_tag_count?: string;
  record_limit_tag_set?: string;

  // Idempotency Configuration
  idempotency_entity?: string;
  idempotency_entity_set?: string;
  idempotency_list?: string;
  idempotency_list_set?: string;
  idempotency_list_entity_rel?: string;
  idempotency_list_entity_rel_set?: string;
  idempotency_entity_reaction?: string;
  idempotency_entity_reaction_set?: string;
  idempotency_list_reaction?: string;
  idempotency_list_reaction_set?: string;
  idempotency_tag?: string;
  idempotency_tag_set?: string;

  // Dynamic kind-specific configurations
  [key: `uniqueness_entity_fields_for_${string}`]: string;
  [key: `uniqueness_list_fields_for_${string}`]: string;
  [key: `uniqueness_list_entity_rel_fields_for_${string}`]: string;
  [key: `uniqueness_entity_set_for_${string}`]: string;
  [key: `uniqueness_list_set_for_${string}`]: string;
  [key: `uniqueness_list_entity_rel_set_for_${string}`]: string;

  [key: `visibility_entity_for_${string}`]: string;
  [key: `visibility_list_for_${string}`]: string;
  [key: `visibility_entity_reaction_for_${string}`]: string;
  [key: `visibility_list_reaction_for_${string}`]: string;
  [key: `visibility_tag_for_${string}`]: string;

  [key: `autoapprove_entity_for_${string}`]: string;
  [key: `autoapprove_list_for_${string}`]: string;
  [key: `autoapprove_list_entity_rel_for_${string}`]: string;
  [key: `autoapprove_entity_reaction_for_${string}`]: string;
  [key: `autoapprove_list_reaction_for_${string}`]: string;
  [key: `autoapprove_tag_for_${string}`]: string;

  [key: `response_limit_entity_for_${string}`]: string;
  [key: `response_limit_list_for_${string}`]: string;
  [key: `response_limit_list_entity_rel_for_${string}`]: string;
  [key: `response_limit_entity_reaction_for_${string}`]: string;
  [key: `response_limit_list_reaction_for_${string}`]: string;
  [key: `response_limit_tag_for_${string}`]: string;

  [key: `record_limit_entity_count_for_${string}`]: string;
  [key: `record_limit_entity_set_for_${string}`]: string;
  [key: `record_limit_list_count_for_${string}`]: string;
  [key: `record_limit_list_set_for_${string}`]: string;
  [key: `record_limit_list_entity_rel_count_for_${string}`]: string;
  [key: `record_limit_list_entity_rel_set_for_${string}`]: string;
  [key: `record_limit_entity_reaction_count_for_${string}`]: string;
  [key: `record_limit_entity_reaction_set_for_${string}`]: string;
  [key: `record_limit_list_reaction_count_for_${string}`]: string;
  [key: `record_limit_list_reaction_set_for_${string}`]: string;
  [key: `record_limit_tag_count_for_${string}`]: string;
  [key: `record_limit_tag_set_for_${string}`]: string;

  [key: `idempotency_entity_for_${string}`]: string;
  [key: `idempotency_entity_set_for_${string}`]: string;
  [key: `idempotency_list_for_${string}`]: string;
  [key: `idempotency_list_set_for_${string}`]: string;
  [key: `idempotency_list_entity_rel_for_${string}`]: string;
  [key: `idempotency_list_entity_rel_set_for_${string}`]: string;
  [key: `idempotency_entity_reaction_for_${string}`]: string;
  [key: `idempotency_entity_reaction_set_for_${string}`]: string;
  [key: `idempotency_list_reaction_for_${string}`]: string;
  [key: `idempotency_list_reaction_set_for_${string}`]: string;
  [key: `idempotency_tag_for_${string}`]: string;
  [key: `idempotency_tag_set_for_${string}`]: string;

  [key: string]: string | undefined;
}

export async function setupApplication(
  envVars?: TestEnvironmentVariables,
): Promise<AppWithClient> {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Set higher timeout for tests
  process.env.MOCHA_TIMEOUT = '10000';

  // Store original env vars
  const originalEnv: TestEnvironmentVariables = {
    // Database Configuration
    mongodb_url: process.env.mongodb_url,
    mongodb_database: process.env.mongodb_database,
    mongodb_host: process.env.mongodb_host,
    mongodb_port: process.env.mongodb_port,
    mongodb_user: process.env.mongodb_user,
    mongodb_password: process.env.mongodb_password,

    // Collection Names
    collection_entity: process.env.collection_entity,
    collection_list: process.env.collection_list,
    collection_list_entity_rel: process.env.collection_list_entity_rel,
    collection_entity_reaction: process.env.collection_entity_reaction,
    collection_list_reaction: process.env.collection_list_reaction,
    collection_tag: process.env.collection_tag,
    collection_list_tag_rel: process.env.collection_list_tag_rel,
    collection_entity_tag_rel: process.env.collection_entity_tag_rel,

    // Allowed Kinds Configuration
    entity_kinds: process.env.entity_kinds,
    list_kinds: process.env.list_kinds,
    list_entity_rel_kinds: process.env.list_entity_rel_kinds,

    // Default Values Configuration
    default_entity_kind: process.env.default_entity_kind,
    default_list_kind: process.env.default_list_kind,
    default_relation_kind: process.env.default_relation_kind,

    // Uniqueness Configuration
    uniqueness_entity_fields: process.env.uniqueness_entity_fields,
    uniqueness_list_fields: process.env.uniqueness_list_fields,
    uniqueness_list_entity_rel_fields:
      process.env.uniqueness_list_entity_rel_fields,
    uniqueness_entity_set: process.env.uniqueness_entity_set,
    uniqueness_list_set: process.env.uniqueness_list_set,
    uniqueness_list_entity_rel_set: process.env.uniqueness_list_entity_rel_set,

    // Auto Approve Configuration
    autoapprove_entity: process.env.autoapprove_entity,
    autoapprove_list: process.env.autoapprove_list,
    autoapprove_list_entity_relations:
      process.env.autoapprove_list_entity_relations,

    // Visibility Configuration
    visibility_entity: process.env.visibility_entity,
    visibility_list: process.env.visibility_list,
    visibility_entity_reaction: process.env.visibility_entity_reaction,
    visibility_list_reaction: process.env.visibility_list_reaction,

    // Response Limits Configuration
    response_limit_entity: process.env.response_limit_entity,
    response_limit_list_entity_rel: process.env.response_limit_list_entity_rel,
    response_limit_entity_reaction: process.env.response_limit_entity_reaction,
    response_limit_list_reaction: process.env.response_limit_list_reaction,

    // Record Limits Configuration
    record_limit_entity_count: process.env.record_limit_entity_count,
    record_limit_entity_set: process.env.record_limit_entity_set,
    record_limit_list_count: process.env.record_limit_list_count,
    record_limit_list_set: process.env.record_limit_list_set,
    record_limit_list_entity_rel_count:
      process.env.record_limit_list_entity_rel_count,
    record_limit_list_entity_rel_set:
      process.env.record_limit_list_entity_rel_set,
    record_limit_entity_reaction_count:
      process.env.record_limit_entity_reaction_count,
    record_limit_entity_reaction_set:
      process.env.record_limit_entity_reaction_set,
    record_limit_list_reaction_count:
      process.env.record_limit_list_reaction_count,
    record_limit_list_reaction_set: process.env.record_limit_list_reaction_set,
    record_limit_tag_count: process.env.record_limit_tag_count,
    record_limit_tag_set: process.env.record_limit_tag_set,

    // Idempotency Configuration
    idempotency_entity: process.env.idempotency_entity,
    idempotency_entity_set: process.env.idempotency_entity_set,
    idempotency_list: process.env.idempotency_list,
    idempotency_list_set: process.env.idempotency_list_set,
    idempotency_list_entity_rel: process.env.idempotency_list_entity_rel,
    idempotency_list_entity_rel_set:
      process.env.idempotency_list_entity_rel_set,
    idempotency_entity_reaction: process.env.idempotency_entity_reaction,
    idempotency_entity_reaction_set:
      process.env.idempotency_entity_reaction_set,
    idempotency_list_reaction: process.env.idempotency_list_reaction,
    idempotency_list_reaction_set: process.env.idempotency_list_reaction_set,
    idempotency_tag: process.env.idempotency_tag,
    idempotency_tag_set: process.env.idempotency_tag_set,

    // Store any existing dynamic kind-specific configurations
    ...Object.entries(process.env)
      .filter(
        ([key]) =>
          key.startsWith('uniqueness_entity_fields_for_') ||
          key.startsWith('uniqueness_list_fields_for_') ||
          key.startsWith('uniqueness_list_entity_rel_fields_for_') ||
          key.startsWith('uniqueness_entity_set_for_') ||
          key.startsWith('uniqueness_list_set_for_') ||
          key.startsWith('uniqueness_list_entity_rel_set_for_') ||
          key.startsWith('visibility_entity_for_') ||
          key.startsWith('visibility_list_for_') ||
          key.startsWith('visibility_entity_reaction_for_') ||
          key.startsWith('visibility_list_reaction_for_') ||
          key.startsWith('visibility_tag_for_') ||
          key.startsWith('autoapprove_entity_for_') ||
          key.startsWith('autoapprove_list_for_') ||
          key.startsWith('autoapprove_list_entity_rel_for_') ||
          key.startsWith('autoapprove_entity_reaction_for_') ||
          key.startsWith('autoapprove_list_reaction_for_') ||
          key.startsWith('autoapprove_tag_for_') ||
          key.startsWith('response_limit_entity_for_') ||
          key.startsWith('response_limit_list_for_') ||
          key.startsWith('response_limit_list_entity_rel_for_') ||
          key.startsWith('response_limit_entity_reaction_for_') ||
          key.startsWith('response_limit_list_reaction_for_') ||
          key.startsWith('response_limit_tag_for_') ||
          key.startsWith('record_limit_entity_count_for_') ||
          key.startsWith('record_limit_entity_set_for_') ||
          key.startsWith('record_limit_list_count_for_') ||
          key.startsWith('record_limit_list_set_for_') ||
          key.startsWith('record_limit_list_entity_rel_count_for_') ||
          key.startsWith('record_limit_list_entity_rel_set_for_') ||
          key.startsWith('record_limit_entity_reaction_count_for_') ||
          key.startsWith('record_limit_entity_reaction_set_for_') ||
          key.startsWith('record_limit_list_reaction_count_for_') ||
          key.startsWith('record_limit_list_reaction_set_for_') ||
          key.startsWith('record_limit_tag_count_for_') ||
          key.startsWith('record_limit_tag_set_for_') ||
          key.startsWith('idempotency_entity_for_') ||
          key.startsWith('idempotency_entity_set_for_') ||
          key.startsWith('idempotency_list_for_') ||
          key.startsWith('idempotency_list_set_for_') ||
          key.startsWith('idempotency_list_entity_rel_for_') ||
          key.startsWith('idempotency_list_entity_rel_set_for_') ||
          key.startsWith('idempotency_entity_reaction_for_') ||
          key.startsWith('idempotency_entity_reaction_set_for_') ||
          key.startsWith('idempotency_list_reaction_for_') ||
          key.startsWith('idempotency_list_reaction_set_for_') ||
          key.startsWith('idempotency_tag_for_') ||
          key.startsWith('idempotency_tag_set_for_'),
      )
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
  };

  // Clear all environment variables first
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });

  // Set new environment variables
  if (envVars) {
    Object.entries(envVars).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      }
    });
  }

  const mongod = await MongoMemoryServer.create();

  // Set MongoDB environment variables
  process.env.mongodb_url = mongod.getUri();
  process.env.mongodb_database = 'testdb';

  const app = new EntityPersistenceApplication({
    rest: {
      ...givenHttpServerConfig(),
      port: 0, // Let the OS pick an available port
    },
  });

  // Set project root and boot options for test environment
  app.projectRoot = __dirname;
  app.bootOptions = {
    controllers: {
      dirs: ['../../controllers'],
      extensions: ['.controller.ts'],
      nested: true,
    },
    repositories: {
      dirs: ['../../repositories'],
      extensions: ['.repository.ts'],
      nested: true,
    },
  };

  // Configure the app to use the in-memory MongoDB
  const mongoDsConfig = {
    name: 'EntityDb',
    connector: 'mongodb',
    url: mongod.getUri(),
    database: 'testdb',
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  app.bind('datasources.config.EntityDb').to(mongoDsConfig);

  // Create and bind the datasource
  const dataSource = new EntityDbDataSource(mongoDsConfig);
  app.dataSource(dataSource);

  app.bind(RestBindings.ERROR_WRITER_OPTIONS).to({
    debug: true,
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
  app.bind(KindBindings.CONFIG_READER).toClass(KindConfigurationReader);

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

  await app.boot();
  await app.start();

  const client = createRestAppClient(app);

  // Debug log
  // eslint-disable-next-line no-console
  console.log('App configuration:', {
    port: app.restServer.config.port,
    url: app.restServer.url,
    mongodb: mongod.getUri(),
  });

  return { app, client, mongod, originalEnv };
}

export interface AppWithClient {
  app: EntityPersistenceApplication;
  client: Client;
  mongod: MongoMemoryServer;
  originalEnv: TestEnvironmentVariables;
}

export async function teardownApplication(appWithClient: AppWithClient) {
  // Restore original env vars
  Object.entries(appWithClient.originalEnv).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  if (appWithClient.app) {
    await appWithClient.app.stop();
  }

  if (appWithClient.mongod) {
    await appWithClient.mongod.stop();
  }
}
