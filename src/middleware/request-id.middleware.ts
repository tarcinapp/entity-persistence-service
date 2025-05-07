import type { MiddlewareContext } from '@loopback/rest';
import { v4 as uuidv4 } from 'uuid';
import type { Middleware } from '../types/middleware';

export class RequestIdMiddleware implements Middleware {
  async handle(context: MiddlewareContext, next: () => Promise<any>) {
    const request = context.request;
    const response = context.response;

    // Get request ID from header or generate new one
    const requestId = request.headers['x-request-id'] ?? uuidv4();

    // Add request ID to request context
    request.headers['x-request-id'] = requestId;

    // Add request ID to response headers
    response.setHeader('X-Request-ID', requestId);

    // Add request ID to request object for logging
    (request as any).requestId = requestId;

    return next();
  }
}
