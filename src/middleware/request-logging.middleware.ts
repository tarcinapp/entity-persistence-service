import type { ValueOrPromise } from '@loopback/core';
import type { Middleware, MiddlewareContext } from '@loopback/rest';
import { EnvConfigHelper } from '../extensions/config-helpers/env-config-helper';
import type { LoggingService } from '../services/logging.service';

// Get the singleton instance once at module level for performance
const envConfig = EnvConfigHelper.getInstance();

/**
 * HTTP Error interface for type-safe error handling
 */
interface HttpError extends Error {
  statusCode?: number;
  status?: number;
}

/**
 * Build log data for incoming request
 */
function buildRequestLogData(
  request: MiddlewareContext['request'],
): Record<string, unknown> {
  const logData: Record<string, unknown> = {
    method: request.method,
    url: request.url,
    query: request.query,
    headers: request.headers,
  };

  // Include request body at debug level if LOG_REQUEST_BODY is enabled
  // WARNING: This can log sensitive data (passwords, tokens, PII)
  if (envConfig.LOG_REQUEST_BODY === 'true' && request.body) {
    logData.body = request.body;
  }

  return logData;
}

/**
 * Build log data for successful response
 */
function buildSuccessLogData(
  request: MiddlewareContext['request'],
  statusCode: number,
  responseTime: number,
  result: unknown,
): Record<string, unknown> {
  const logData: Record<string, unknown> = {
    method: request.method,
    url: request.url,
    statusCode,
    responseTime,
  };

  // If response is an array, include the count
  if (Array.isArray(result)) {
    logData.recordCount = result.length;
  }

  return logData;
}

/**
 * Build log data for error response
 */
function buildErrorLogData(
  request: MiddlewareContext['request'],
  error: Error,
  derivedStatus: number,
  responseTime: number,
): Record<string, unknown> {
  return {
    method: request.method,
    url: request.url,
    statusCode: derivedStatus,
    responseTime,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  };
}

export function requestLoggingMiddleware(logger: LoggingService): Middleware {
  return async (
    context: MiddlewareContext,
    next: () => ValueOrPromise<unknown>,
  ) => {
    const { request, response } = context;
    const startTime = Date.now();

    // Log request details at debug level
    const requestLogData = buildRequestLogData(request);
    logger.debug(
      `Incoming request ${request.method} ${request.url}`,
      requestLogData,
      request,
    );

    try {
      // Process the request
      const result = await next();

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Get response status code
      const statusCode = response.statusCode;

      // Log response details
      const responseLogData = buildSuccessLogData(
        request,
        statusCode,
        responseTime,
        result,
      );

      logger.debug(
        `Request completed ${request.method} ${request.url} ${statusCode} ${responseTime}ms`,
        responseLogData,
        request,
      );

      return result;
    } catch (error) {
      // Calculate response time for failed requests
      const responseTime = Date.now() - startTime;

      // Derive correct HTTP status for the error (response.statusCode may still be 200 here)
      const httpError = error as HttpError;
      const derivedStatus =
        httpError.statusCode ??
        httpError.status ??
        (response.statusCode >= 400 ? response.statusCode : 500);

      // Log error details
      const errorLogData = buildErrorLogData(
        request,
        error as Error,
        derivedStatus,
        responseTime,
      );

      logger.error(
        `Request failed ${request.method} ${request.url} ${derivedStatus} ${responseTime}ms`,
        errorLogData,
        request,
      );

      throw error;
    }
  };
}
