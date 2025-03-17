import type { Logger } from 'winston';
import { format, createLogger, transports } from 'winston';
import type { LoggingConfig } from '../types/logging.types';

export const LoggingBindings = {
  LOGGER: 'logging.logger',
  CONFIG: 'logging.config',
};

export const createFormat = (config: LoggingConfig) => {
  const formats = [];

  if (config.timestamp) {
    formats.push(format.timestamp());
  }

  if (config.format === 'json') {
    formats.push(format.json());
  } else {
    formats.push(
      format.printf(
        (info: { timestamp?: string; level: string; message: unknown }) => {
          const message =
            info.message instanceof Error
              ? info.message.message
              : String(info.message);

          return `${info.timestamp} ${info.level}: ${message}`;
        },
      ),
    );
  }

  return format.combine(...formats);
};

export function createLoggerInstance(config: LoggingConfig): Logger {
  return createLogger({
    level: config.level,
    format: createFormat(config),
    defaultMeta: {
      service: config.service,
      environment: config.environment,
    },
    transports: [
      new transports.Console({
        format: createFormat(config),
      }),
    ],
  });
}

export const getLoggingConfig = (): LoggingConfig => {
  const isTest = process.env.NODE_ENV === 'test';

  return {
    level: process.env.LOG_LEVEL ?? (isTest ? 'error' : 'info'),
    format: process.env.LOG_FORMAT === 'json' ? 'json' : 'text',
    timestamp: process.env.LOG_TIMESTAMP === 'true',
    service: process.env.LOG_SERVICE ?? 'entity-persistence-service',
    environment: process.env.NODE_ENV ?? 'development',
  };
};
