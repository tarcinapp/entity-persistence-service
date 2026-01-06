/**
 * Unique symbol used as a metadata key for transactional methods.
 * This is used by the Interceptor to identify targets at runtime.
 */
export const TRANSACTIONAL_KEY = Symbol('transactional-key');

/**
 * @transactional() - Method Decorator for MongoDB Transactions
 *
 * Marks a controller or repository method to be wrapped in a MongoDB transaction.
 * The TransactionalInterceptor will detect this flag and manage the ClientSession.
 *
 * @returns MethodDecorator
 */
export function transactional() {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error('@transactional can only be applied to methods');
    }

    /**
     * Attach the TRANSACTIONAL_KEY to the method.
     * enumerable: false ensures it doesn't show up in logs or JSON.
     */
    Object.defineProperty(descriptor.value, TRANSACTIONAL_KEY, {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return descriptor;
  };
}