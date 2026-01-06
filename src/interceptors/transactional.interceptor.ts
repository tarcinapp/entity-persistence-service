import {
  BindingScope,
  globalInterceptor,
  injectable,
  Interceptor,
  InvocationContext,
  Next,
  inject,
} from '@loopback/core';
import {TRANSACTIONAL_KEY} from '../decorators/transactional.decorator';
import {EntityDbDataSource} from '../datasources/entity-db.datasource';

/**
 * TransactionalInterceptor
 * Automatically manages MongoDB transactions by binding a ClientSession
 * to the Request Context. This avoids parameter index issues and
 * allows clean injection in Controllers.
 */
@globalInterceptor('transactional', {tags: {namespace: 'globalInterceptors'}})
@injectable({scope: BindingScope.SINGLETON})
export class TransactionalInterceptor {
  constructor(
    @inject('datasources.EntityDb')
    public dataSource: EntityDbDataSource,
  ) { }

  value(): Interceptor {
    return (invocationCtx: InvocationContext, next: Next) => {
      return this.intercept(invocationCtx, next);
    };
  }

  async intercept(invocationCtx: InvocationContext, next: Next): Promise<any> {
    const method = (invocationCtx.target as any)[invocationCtx.methodName];
    const isTransactional = !!(method && method[TRANSACTIONAL_KEY as any]);

    if (!isTransactional) return next();

    const client = (this.dataSource.connector as any).client;
    const session = client.startSession();
    session.startTransaction();

    /**
     * BINDING: We store the session in the Request Context (parent).
     * The Controller will retrieve this via @inject('active.transaction.options').
     */
    if (invocationCtx.parent) {
      invocationCtx.parent.bind('active.transaction.options').to({session});
    }

    try {
      const result = await next();
      await session.commitTransaction();
      return result;
    } catch (error) {
      // Abort the transaction only if it wasn't already aborted
      if (session.transaction.state !== 'TRANSACTION_ABORTED') {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      // Ensure the session is closed regardless of outcome
      if (session) await session.endSession();
    }
  }
}
