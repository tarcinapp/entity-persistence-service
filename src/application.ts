import { BootMixin } from '@loopback/boot';
import { ApplicationConfig } from '@loopback/core';
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
import { MongoPipelineHelper } from './extensions/utils/mongo-pipeline-helper';
import { MySequence } from './sequence';
import { LoggingService } from './services/logging.service';

export { ApplicationConfig };

export class EntityPersistenceApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set up the custom sequence
    this.sequence(MySequence);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });
    this.component(RestExplorerComponent);

    // Configure logging
    const config = getLoggingConfig();
    config.level =
      process.env.LOG_LEVEL ??
      (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
    const logger = createLoggerInstance(config);
    this.bind(LoggingBindings.LOGGER).to(logger);

    // Bind LoggingService
    this.service(LoggingService);

    // Bind MongoPipelineHelper as a service
    this.service(MongoPipelineHelper);

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
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
        // Skip default datasource binding in test mode
        dirs: process.env.NODE_ENV === 'test' ? [] : ['datasources'],
        extensions: ['.datasource.js'],
        nested: true,
      },
    };
  }
}
