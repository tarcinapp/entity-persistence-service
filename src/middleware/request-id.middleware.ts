import type { MiddlewareContext } from '@loopback/rest';
import { v4 as uuidv4 } from 'uuid';
import { EnvConfigHelper } from '../extensions/config-helpers/env-config-helper';
import type { Middleware } from '../types/middleware';

export class RequestIdMiddleware implements Middleware {
  async handle(context: MiddlewareContext, next: () => Promise<any>) {
    const request = context.request;
    const response = context.response;

    const headerName =
      EnvConfigHelper.getInstance().REQUEST_ID_HEADER ?? 'x-request-id';
    const headerKey = headerName.toLowerCase();

    // Get request ID from configured header (case-insensitive) or generate new one
    const incoming = request.headers[headerKey];
    const requestId = Array.isArray(incoming)
      ? incoming[0]
      : (incoming ?? uuidv4());

    // Add request ID to request context (store under lowercase key for consistency)
    request.headers[headerKey] = requestId;

    // Add request ID to response headers using configured casing
    response.setHeader(headerName, requestId);

    // Add request ID to request object for logging and downstream use
    (request as any).requestId = requestId;

    return next();
  }
}
