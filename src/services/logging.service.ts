import { inject, injectable } from '@loopback/core';
import { Request } from '@loopback/rest';
import winston from 'winston';
import { LoggingBindings } from '../config/logging.config';
import { EnvConfigHelper } from '../extensions/config-helpers/env-config-helper';

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

  private getRequestId(request?: Request): string | undefined {
    return (request as any)?.requestId;
  }

  error(message: string, meta?: Record<string, unknown>, request?: Request) {
    this.logger.error(message, {
      ...meta,
      timestamp: new Date().toISOString(),
      requestId: this.getRequestId(request),
    });
  }

  warn(message: string, meta?: Record<string, unknown>, request?: Request) {
    this.logger.warn(message, {
      ...meta,
      timestamp: new Date().toISOString(),
      requestId: this.getRequestId(request),
    });
  }

  info(message: string, meta?: Record<string, unknown>, request?: Request) {
    this.logger.info(message, {
      ...meta,
      timestamp: new Date().toISOString(),
      requestId: this.getRequestId(request),
    });
  }

  debug(message: string, meta?: Record<string, unknown>, request?: Request) {
    this.logger.debug(message, {
      ...meta,
      timestamp: new Date().toISOString(),
      requestId: this.getRequestId(request),
    });
  }

  // Helper method for request logging
  logRequest(context: RequestContext) {
    const meta = {
      ...context,
      timestamp: new Date().toISOString(),
      environment: EnvConfigHelper.getInstance().NODE_ENV ?? 'development',
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
