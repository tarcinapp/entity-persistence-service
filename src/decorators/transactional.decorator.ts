/**
 * Metadata key for marking methods as transactional.
 * Used by TransactionalInterceptor to identify which methods need transaction wrapping.
 *
 * @internal
 */
export const TRANSACTIONAL_KEY = Symbol('transactional');

/**
 * @transactional() - Method Decorator for MongoDB Transactions
 *
 * Marks a repository method to run within a MongoDB transaction context.
 * Works in conjunction with TransactionalInterceptor for automatic transaction
 * lifecycle management.
 *
 * ## Key Features:
 * - Automatic ClientSession creation and injection into `options.session`
 * - Transaction propagation through nested repository calls
 * - Automatic commit on success
 * - Automatic rollback on any error
 * - Guaranteed session cleanup even on exceptions
 *
 * ## Usage:
 * ```typescript
 * import { transactional } from '../../decorators';
 *
 * export class CustomEntityThroughListRepository {
 *   @transactional()
 *   async create(
 *     data: DataObject<GenericEntity>,
 *     options?: Options,
 *   ): Promise<GenericEntity> {
 *     // All nested repository calls receive options.session
 *     const entity = await this.entityRepo.create(data, options);
 *     await this.relationRepo.create({
 *       _entityId: entity._id,
 *       _listId: this.sourceListId,
 *     }, options);
 *     return entity;
 *   }
 * }
 * ```
 *
 * ## Transaction Propagation:
 * When a transactional method calls another transactional method:
 * - First call: Starts new transaction, injects session
 * - Nested calls: Detect existing session, reuse it (no new transaction)
 * - Commit: Only the outermost transaction commits
 * - Error: Any error in any level causes full rollback
 *
 * ## When to Use:
 * - Creating/updating multiple related entities (e.g., entity + relation)
 * - Multi-step operations that must succeed together or fail together
 * - Orchestrator repositories (custom/ layer) that coordinate multiple repositories
 *
 * ## When NOT to Use:
 * - Read-only operations (find, count) - no rollback needed
 * - Methods that don't change data
 * - Simple single-entity CRUD operations
 *
 * @returns MethodDecorator that marks the method for transactional wrapping
 */
export function transactional() {
  return function (
    target: Object,
    propertyKey: string | symbol | undefined,
    descriptor: PropertyDescriptor,
  ) {
    if (propertyKey === undefined) {
      throw new Error('transactional decorator can only be applied to methods');
    }

    // Mark the method with metadata flag
    Object.defineProperty(descriptor.value, TRANSACTIONAL_KEY, {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return descriptor;
  };
}
