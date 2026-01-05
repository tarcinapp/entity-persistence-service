import {
  DataObject,
  DefaultTransactionalRepository,
  Entity,
  juggler,
} from '@loopback/repository';

/**
 * EntityPersistenceBaseRepository - Universal Foundation for All Repositories
 *
 * This abstract base class provides common functionality shared across ALL repositories
 * in the Entity Persistence Service. It extends DefaultTransactionalRepository to enable
 * MongoDB transaction support.
 *
 * ## Responsibilities:
 * - Virtual field injection (_recordType) for API responses
 * - Data sanitization to strip non-persistent fields before write operations
 * - Transaction options propagation throughout the CRUD operations
 *
 * ## Architecture:
 * This is Level 1 of a three-tier repository hierarchy:
 * 1. EntityPersistenceBaseRepository (Universal Base) - THIS CLASS
 * 2. Business Base (Future) - Domain-specific logic like slugs, counts, idempotency
 * 3. Concrete Repositories - Entity, List, Reactions, Relations, Through repositories
 *
 * @template E - The entity model type (must extend Entity)
 * @template IdType - The type of the entity's ID field
 * @template Relations - Optional relations object type
 */
export abstract class EntityPersistenceBaseRepository<
  E extends Entity,
  IdType,
  Relations extends object = {},
> extends DefaultTransactionalRepository<E, IdType, Relations> {
  /**
   * The record type name to inject into API responses.
   * Each subclass MUST define this property to identify its record type.
   *
   * @example
   * ```typescript
   * protected readonly recordTypeName = 'entity';
   * ```
   */
  protected abstract readonly recordTypeName: string;

  /**
   * List of virtual/response-only fields that should never be persisted to the database.
   * Subclasses can override this to add model-specific virtual fields.
   *
   * @default ['_recordType']
   */
  protected readonly virtualFields: string[] = ['_recordType'];

  constructor(
    entityClass: typeof Entity & { prototype: E },
    dataSource: juggler.DataSource,
  ) {
    super(entityClass, dataSource);
  }

  /**
   * Injects the `_recordType` virtual field into a single record.
   * This field identifies the record type in API responses but is never persisted.
   *
   * @param record - The entity record to inject the record type into
   * @returns The same record with `_recordType` field added
   *
   * @example
   * ```typescript
   * const entity = await super.findById(id);
   * return this.injectRecordType(entity);
   * ```
   */
  protected injectRecordType<T extends E | (E & Relations)>(record: T): T {
    if (!record) {
      return record;
    }

    (record as Record<string, unknown>)._recordType = this.recordTypeName;

    return record;
  }

  /**
   * Injects the `_recordType` virtual field into an array of records.
   * This is a convenience method that applies `injectRecordType` to each element.
   *
   * @param records - The array of entity records to inject the record type into
   * @returns The same array with `_recordType` field added to each record
   *
   * @example
   * ```typescript
   * const entities = await super.find(filter);
   * return this.injectRecordTypeArray(entities);
   * ```
   */
  protected injectRecordTypeArray<T extends E | (E & Relations)>(
    records: T[],
  ): T[] {
    return records.map((record) => this.injectRecordType(record));
  }

  /**
   * Sanitizes incoming data by removing virtual/response-only fields before write operations.
   * This ensures that fields like `_recordType` are never accidentally persisted to the database.
   *
   * Subclasses can override `virtualFields` to add model-specific fields to be stripped.
   *
   * @param data - The data object to sanitize
   * @returns A new data object with virtual fields removed
   *
   * @example
   * ```typescript
   * async create(data: DataObject<E>, options?: Options) {
   *   data = this.sanitizeRecordType(data);
   *   return super.create(data, options);
   * }
   * ```
   */
  protected sanitizeRecordType(data: DataObject<E>): DataObject<E> {
    // Check if any virtual fields exist in the data
    const hasVirtualFields = this.virtualFields.some(
      (field) => field in (data as Record<string, unknown>),
    );

    if (!hasVirtualFields) {
      return data;
    }

    // Create a shallow copy and remove virtual fields
    const sanitized = { ...data } as Record<string, unknown>;

    for (const field of this.virtualFields) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }

    return sanitized as DataObject<E>;
  }
}
