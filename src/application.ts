import { BootMixin } from '@loopback/boot';
import {
  ApplicationConfig,
  asGlobalInterceptor,
  createBindingFromClass,
} from '@loopback/core';
import { RepositoryMixin } from '@loopback/repository';
import { RestApplication } from '@loopback/rest';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import { ServiceMixin } from '@loopback/service-proxy';
import path from 'path';
import {
  createLoggerInstance,
  LoggingBindings,
  getLoggingConfig,
} from './config/logging.config';
import { EnvConfigHelper } from './extensions/config-helpers/env-config-helper';
import { MongoPipelineHelper } from './extensions/utils/mongo-pipeline-helper';
import { TransactionalInterceptor } from './interceptors';
import { CustomEntityThroughListRepository } from './repositories';
import { MySequence } from './sequence';
import { LoggingService } from './services/logging.service';

export { ApplicationConfig };

export class EntityPersistenceApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set up the custom sequence for the request-response lifecycle
    this.sequence(MySequence);

    // Set up default home page for the application
    this.static('/', path.join(__dirname, '../public'));

    // Customize @loopback/rest-explorer configuration
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });
    this.component(RestExplorerComponent);

    // Configure logging based on the environment settings
    const env = EnvConfigHelper.getInstance();
    const config = getLoggingConfig();
    config.level =
      env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug');
    const logger = createLoggerInstance(config);
    this.bind(LoggingBindings.LOGGER).to(logger);

    // Bind core services for dependency injection
    this.service(LoggingService);
    this.service(MongoPipelineHelper);

    // Set the project root for the booter to locate artifacts
    this.projectRoot = __dirname;

    // Customize @loopback/boot Booter Conventions
    this.bootOptions = {
      controllers: {
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
      repositories: {
        dirs: ['repositories'],
        extensions: ['.repository.js'],
        nested: true,
      },
      datasources: {
        // Skip default datasource binding in test mode to allow mocking
        dirs: env.NODE_ENV === 'test' ? [] : ['datasources'],
        extensions: ['.datasource.js'],
        nested: true,
      },
      interceptors: {
        dirs: ['interceptors'],
        extensions: ['.interceptor.js'],
        nested: true,
      },
    };
  }
}
