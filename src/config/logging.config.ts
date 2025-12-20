import type { Logger } from 'winston';
import { format, createLogger, transports } from 'winston';
import { EnvConfigHelper } from '../extensions/config-helpers/env-config-helper';
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
        (info: {
          timestamp?: string;
          level: string;
          message: unknown;
          requestId?: string;
        }) => {
          const message =
            info.message instanceof Error
              ? info.message.message
              : String(info.message);

          const requestId = info.requestId ? ` [${info.requestId}]` : '';

          return `${info.timestamp} ${info.level}:${requestId} ${message}`;
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
  const configHelper = EnvConfigHelper.getInstance();
  const isTest = configHelper.NODE_ENV === 'test';

  return {
    level: configHelper.LOG_LEVEL ?? (isTest ? 'error' : 'info'),
    format: configHelper.LOG_FORMAT === 'text' ? 'text' : 'json',
    timestamp: configHelper.LOG_TIMESTAMP === 'true',
    service: configHelper.LOG_SERVICE ?? 'entity-persistence-service',
    environment: configHelper.NODE_ENV ?? 'development',
  };
};
