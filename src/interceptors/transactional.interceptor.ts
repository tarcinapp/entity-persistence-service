import {
  BindingScope,
  globalInterceptor,
  injectable,
  Interceptor,
  InvocationContext,
  Next,
  inject,
} from '@loopback/core';
import { EntityDbDataSource } from '../datasources/entity-db.datasource';
import { TRANSACTIONAL_KEY } from '../decorators/transactional.decorator';

/**
 * TransactionalInterceptor
 * Automatically manages MongoDB transactions by binding a ClientSession
 * to the Request Context. This avoids parameter index issues and
 * allows clean injection in Controllers.
 */
@globalInterceptor('transactional', {
  tags: { namespace: 'globalInterceptors' },
})
@injectable({ scope: BindingScope.SINGLETON })
export class TransactionalInterceptor {
  constructor(
    @inject('datasources.EntityDb')
    public dataSource: EntityDbDataSource,
  ) {}

  value(): Interceptor {
    return (invocationCtx: InvocationContext, next: Next) => {
      return this.intercept(invocationCtx, next);
    };
  }

  async intercept(invocationCtx: InvocationContext, next: Next): Promise<any> {
    const method = (invocationCtx.target as any)[invocationCtx.methodName];
    const isTransactional = !!method?.[TRANSACTIONAL_KEY as any];

    if (!isTransactional) {
      return next();
    }

    const maxRetries = 3; // Maximum number of retries for WriteConflict
    let attempt = 0;

    while (attempt < maxRetries) {
      const client = (this.dataSource.connector as any).client;
      const session = client.startSession();
      session.startTransaction();

      if (invocationCtx.parent) {
        // Bind the session as non-enumerable to avoid circular JSON issues
        const options = { session };
        Object.defineProperty(options, 'session', {
          value: session,
          enumerable: false,
          configurable: true,
          writable: true,
        });
        invocationCtx.parent.bind('active.transaction.options').to(options);
      }

      try {
        const result = await next();
        await session.commitTransaction();

        return result; // Success: Exit the loop
      } catch (error) {
        await session.abortTransaction();

        /**
         * Check if the error is a WriteConflict or a TransientTransactionError.
         * MongoDB indicates retryable errors via ErrorLabels.
         */
        const isRetryable =
          error.code === 112 || // WriteConflict
          error.errorLabels?.includes('TransientTransactionError');

        if (isRetryable && attempt < maxRetries - 1) {
          attempt++;
          console.warn(
            `[Transaction] WriteConflict detected. Retrying attempt ${attempt}...`,
          );

          // Brief delay before retrying (exponential backoff could be used)
          await new Promise((resolve) => setTimeout(resolve, 10 * attempt));
          continue; // Retry the loop
        }

        // If not retryable or max retries reached, throw the error
        throw error;
      } finally {
        if (session) {
          await session.endSession();
        }
      }
    }
  }
}
