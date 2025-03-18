import type { ValueOrPromise } from '@loopback/core';
import type { Middleware, MiddlewareContext } from '@loopback/rest';
import type { LoggingService } from '../services/logging.service';

export function requestLoggingMiddleware(logger: LoggingService): Middleware {
  return async (
    context: MiddlewareContext,
    next: () => ValueOrPromise<unknown>,
  ) => {
    const { request, response } = context;
    const startTime = Date.now();

    // Log request details at debug level
    logger.debug(
      `Incoming request ${request.method} ${request.url}`,
      {
        method: request.method,
        url: request.url,
        query: request.query,
        headers: request.headers,
      },
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
      const logData: Record<string, unknown> = {
        method: request.method,
        url: request.url,
        statusCode,
        responseTime,
      };

      // If response is an array, include the count
      if (Array.isArray(result)) {
        logData.itemCount = result.length;
      }

      logger.debug(
        `Request completed ${request.method} ${request.url} ${statusCode} ${responseTime}ms`,
        logData,
        request,
      );

      return result;
    } catch (error) {
      // Calculate response time for failed requests
      const responseTime = Date.now() - startTime;

      // Log error details
      logger.error(
        `Request failed ${request.method} ${request.url} ${response.statusCode} ${responseTime}ms`,
        {
          method: request.method,
          url: request.url,
          statusCode: response.statusCode,
          responseTime,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
        request,
      );

      throw error;
    }
  };
}
