import { globalInterceptor, InvocationContext, Next } from '@loopback/core';
import { Options } from '@loopback/repository';
import { TRANSACTIONAL_KEY } from '../decorators/transactional.decorator';

/**
 * TransactionalInterceptor - Global MongoDB Transaction Handler
 *
 * This interceptor provides declarative transaction management for repository methods
 * decorated with @transactional(). It ensures ACID compliance for multi-step operations.
 *
 * ## How It Works:
 * 1. Checks if method has @transactional() decorator via metadata
 * 2. Inspects options.session (ClientSession) parameter:
 *    - If exists: Join existing transaction (propagation)
 *    - If missing: Start new transaction via dataSource
 * 3. Injects session into options object
 * 4. On success: Commits transaction
 * 5. On error: Rolls back all changes
 * 6. Always: Ends session immediately after
 *
 * ## Transaction Propagation Logic:
 * - JOINING: When nested repository calls have session, reuse it (no new transaction)
 * - STARTING: When no session exists, begin new transaction from dataSource
 * - NESTED: Multiple transactional methods work atomically together
 *
 * @example
 * ```typescript
 * // In CustomEntityThroughListRepository
 * @transactional()
 * async create(data: DataObject<E>, options?: Options): Promise<E> {
 *   const entity = await this.entityRepo.create(data, options);
 *   // options.session is injected and propagates to nested calls
 *   const relation = await this.relationRepo.create({
 *     _entityId: entity._id,
 *     _listId: this.sourceListId,
 *   }, options);
 *   return entity;
 * }
 * ```
 */
@globalInterceptor('transactional', {
  tags: { namespace: 'globalInterceptors' },
})
export class TransactionalInterceptor {
  intercept(invocationCtx: InvocationContext, next: Next): any {
    // Check if this method has @transactional() decorator
    const isTransactional =
      invocationCtx.target?.constructor?.prototype?.[
        invocationCtx.methodName
      ]?.hasOwnProperty(TRANSACTIONAL_KEY);

    if (!isTransactional) {
      // Not a transactional method, proceed normally
      return next();
    }

    // Get the method arguments
    const args = invocationCtx.args;

    // Find the options parameter (usually the last parameter for repository methods)
    // Repository methods typically follow pattern: create(data, options?)
    // find(filter?, options?), findById(id, filter?, options?), etc.
    let options: Options = {};
    let optionsIndex = -1;

    // Identify which argument is the options object
    for (let i = args.length - 1; i >= 0; i--) {
      const arg = args[i];
      if (
        arg &&
        typeof arg === 'object' &&
        !Array.isArray(arg) &&
        !(arg instanceof Date) &&
        typeof arg.prototype === 'undefined'
      ) {
        // This might be options - check if it has known option properties
        if (
          typeof arg === 'object' &&
          (arg.session !== undefined ||
            arg.transaction !== undefined ||
            arg.skipValidation !== undefined ||
            arg.strict !== undefined)
        ) {
          options = arg;
          optionsIndex = i;
          break;
        }
      }
    }

    // If no options found, create one
    if (optionsIndex === -1) {
      optionsIndex = args.length;
      options = {};
      args.push(options);
    } else {
      options = args[optionsIndex];
    }

    // Check if a session already exists (transaction propagation)
    const existingSession = (options as any)?.session;

    if (existingSession) {
      // Transaction already in progress - join it
      // No need to manage transaction lifecycle
      return next();
    }

    // Start a new transaction
    const session: any = null;

    // Execute the async transaction logic
    return this.executeWithTransaction(
      invocationCtx,
      next,
      args,
      optionsIndex,
      options,
    );
  }

  private async executeWithTransaction(
    invocationCtx: InvocationContext,
    next: Next,
    args: any[],
    optionsIndex: number,
    options: Options,
  ): Promise<any> {
    let session: any = null;

    try {
      // Get the MongoDB client session from the dataSource
      const target = invocationCtx.target as any;
      const dataSource = target?.dataSource;

      if (!dataSource) {
        throw new Error(
          'DataSource not found on target. Cannot start transaction.',
        );
      }

      // Start a new session from the MongoDB client
      const mongoConnector = dataSource.connector;
      if (!mongoConnector?.client) {
        throw new Error(
          'MongoDB client not accessible via dataSource connector.',
        );
      }

      session = mongoConnector.client.startSession();

      // Begin transaction on the session
      session.startTransaction();

      // Inject the session into options for propagation
      (options as any).session = session;

      // Replace the options argument with the updated one
      args[optionsIndex] = options;

      // Execute the method with transaction
      try {
        const result = await next();

        // Commit transaction on success
        await session.commitTransaction();

        return result;
      } catch (error) {
        // Rollback transaction on error
        await session.abortTransaction();
        throw error;
      }
    } finally {
      // Always end the session
      if (session) {
        await session.endSession();
      }
    }
  }
}
