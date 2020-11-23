import {RestBindings} from '@loopback/rest';
import {ApplicationConfig, EntityPersistenceApplication} from './application';
import {UniquenessBindings, UniquenessConfigurationReader} from './extensions';

export * from './application';

export async function main(options: ApplicationConfig = {}) {
  const app = new EntityPersistenceApplication(options);

  app.bind(RestBindings.ERROR_WRITER_OPTIONS).to({
    debug: process.env.NODE_ENV != 'production',
    safeFields: ['errorCode', 'message']
  });

  // add uniqueness configuration reader to context
  app.bind(UniquenessBindings.CONFIG_READER)
    .toClass(UniquenessConfigurationReader);

  await app.boot();
  await app.start();

  const url = app.restServer.url;
  console.log(`Server is running at ${url}`);
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
        'x-powered-by': false
      }
    },
  };
  main(config).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}
