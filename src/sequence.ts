import { inject } from '@loopback/context';
import {
  FindRoute,
  InvokeMethod,
  InvokeMiddleware,
  ParseParams,
  Reject,
  RequestContext,
  RestBindings,
  Send,
  SequenceHandler,
} from '@loopback/rest';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { requestLoggingMiddleware } from './middleware/request-logging.middleware';
import { LoggingService } from './services/logging.service';

const SequenceActions = RestBindings.SequenceActions;

export class MySequence implements SequenceHandler {
  /**
   * Optional invoker for registered middleware in a chain.
   * To be injected via SequenceActions.INVOKE_MIDDLEWARE.
   */
  @inject(SequenceActions.INVOKE_MIDDLEWARE, { optional: true })
  protected invokeMiddleware: InvokeMiddleware = () => false;

  private requestIdMiddleware: RequestIdMiddleware;
  private requestLoggingMiddleware: ReturnType<typeof requestLoggingMiddleware>;

  constructor(
    @inject(SequenceActions.FIND_ROUTE) protected findRoute: FindRoute,
    @inject(SequenceActions.PARSE_PARAMS) protected parseParams: ParseParams,
    @inject(SequenceActions.INVOKE_METHOD) protected invoke: InvokeMethod,
    @inject(SequenceActions.SEND) public send: Send,
    @inject(SequenceActions.REJECT) public reject: Reject,
    @inject('services.LoggingService') logger: LoggingService,
  ) {
    this.requestIdMiddleware = new RequestIdMiddleware();
    this.requestLoggingMiddleware = requestLoggingMiddleware(logger);
  }

  async handle(context: RequestContext) {
    try {
      const { request, response } = context;

      // Apply request ID middleware first
      await this.requestIdMiddleware.handle(context, async () => {
        // Then apply request logging middleware
        await this.requestLoggingMiddleware(context, async () => {
          const finished = await this.invokeMiddleware(context);
          if (finished) {
            return;
          }

          const route = this.findRoute(request);
          const args = await this.parseParams(request, route);
          const result = await this.invoke(route, args);
          this.send(response, result);

          return result;
        });
      });
    } catch (err) {
      // Ensure error is logged with request ID
      const { request, response } = context;
      const logger = await context.get<LoggingService>(
        'services.LoggingService',
      );
      // Normalize framework validation error code (LoopBack uses VALIDATION_FAILED).
      // We prefer hyphenated code for consistency with other codes used in this project.
      try {
        if (err && err.code === 'VALIDATION_FAILED') {
          err.code = 'VALIDATION-FAILED';
        }
      } catch (_) {
        // ignore any failure while normalizing error
      }

      // Normalize invalid inclusion filter error. LoopBack uses the underscore variant
      // INVALID_INCLUSION_FILTER and leaves the name as the generic "Error".
      try {
        if (err && err.code === 'INVALID_INCLUSION_FILTER') {
          err.code = 'INVALID-INCLUSION-FILTER';
          if (!err.name || err.name === 'Error') {
            err.name = 'InvalidInclusionFilterError';
          }
        }
      } catch (_) {
        // ignore any failure while normalizing error
      }

      // Normalize malformed query/filter errors. LoopBack promotes raw Error objects from
      // query-parameter coercion and where-clause validation into 400 responses, but leaves
      // the generic name "Error" and omits a machine-readable code. We detect these by
      // checking for a 400 status, no existing code, and a message that matches known
      // query-parsing patterns, then replace them with a consistent name and code.
      try {
        const isGenericError =
          err && (!err.name || err.name === 'Error' || err.name === 'BadRequestError');
        const isBadRequest =
          err?.statusCode === 400 || err?.status === 400;
        const hasNoCode = !err?.code;
        const isQueryFilterError =
          typeof err?.message === 'string' &&
          /the where clause|is not a valid filter|invalid filter syntax|is not an object/i.test(
            err.message,
          );

        if (isGenericError && isBadRequest && hasNoCode && isQueryFilterError) {
          err.name = 'MalformedQueryFilterError';
          err.code = 'MALFORMED-QUERY-FILTER';
        }
      } catch (_) {
        // ignore any failure while normalizing error
      }

      // Attach requestId to the error payload when available
      try {
        if (request && (request as any).requestId) {
          (err as any).requestId = (request as any).requestId;
        }
      } catch (_) {
        // best-effort only
      }

      // Error logging is handled by the request logging middleware
      this.reject(context, err);
    }
  }
}
