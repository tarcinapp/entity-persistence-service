import { inject, Provider } from '@loopback/core';
import { Request, RestBindings } from '@loopback/rest';

/**
 * Request-scoped context that provides access to request-specific data
 * throughout the application lifecycle, including repositories and services.
 */
export interface RequestContext {
  /**
   * Unique identifier for the current request.
   * Generated or extracted by RequestIdMiddleware.
   */
  requestId?: string;
}

/**
 * Provider that creates a RequestContext for each HTTP request.
 * This provider is bound with REQUEST scope, meaning a new instance
 * is created for each incoming request.
 *
 * Usage:
 * - Inject in repositories, services, or any component that needs request context
 * - Access requestId for logging and tracing
 *
 * Example:
 * ```typescript
 * constructor(
 *   @inject('request.context', { optional: true })
 *   private requestContext?: RequestContext,
 * ) {}
 * ```
 */
export class RequestContextProvider implements Provider<RequestContext> {
  constructor(
    @inject(RestBindings.Http.REQUEST, { optional: true })
    private request?: Request,
  ) {}

  value(): RequestContext {
    return {
      requestId: (this.request as any)?.requestId,
    };
  }
}

// Made with Bob
