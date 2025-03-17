import { inject, injectable } from '@loopback/core';
import winston from 'winston';
import { LoggingBindings } from '../config/logging.config';

interface RequestContext {
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  userAgent?: string;
  ip?: string;
  requestId?: string;
}

@injectable()
export class LoggingService {
  constructor(
    @inject(LoggingBindings.LOGGER)
    private logger: winston.Logger,
  ) {}

  error(message: string, meta?: Record<string, unknown>) {
    this.logger.error(message, {
      ...meta,
      timestamp: new Date().toISOString(),
    });
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.logger.warn(message, { ...meta, timestamp: new Date().toISOString() });
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.logger.info(message, { ...meta, timestamp: new Date().toISOString() });
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.logger.debug(message, {
      ...meta,
      timestamp: new Date().toISOString(),
    });
  }

  // Helper method for request logging
  logRequest(context: RequestContext) {
    const meta = {
      ...context,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      service: 'entity-persistence-service',
    };

    if (context.statusCode >= 500) {
      this.error('Request failed', meta);
    } else if (context.statusCode >= 400) {
      this.warn('Request warning', meta);
    } else {
      this.info('Request completed', meta);
    }
  }
}
