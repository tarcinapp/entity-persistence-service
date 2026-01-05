import {
  DataObject,
  Entity,
  Filter,
  FilterExcludingWhere,
  Options,
  juggler,
} from '@loopback/repository';
import * as crypto from 'crypto';
import _ from 'lodash';
import slugify from 'slugify';
import { EntityPersistenceBaseRepository } from './entity-persistence-base.repository';
import { LookupHelper } from '../extensions/utils/lookup-helper';
import { RecordLimitCheckerService } from '../services/record-limit-checker.service';
import { LookupConstraintService } from '../services/lookup-constraint.service';
import { LoggingService } from '../services/logging.service';
import { HttpErrorResponse, ReactionsCommonBase } from '../models';

/**
 * EntityPersistenceReactionRepository - Level 2B Specialized Base for Reaction Entities
 *
 * This abstract base class provides common reaction logic shared between
 * EntityReactionsRepository and ListReactionsRepository. It extends EntityPersistenceBaseRepository (Level 1).
 *
 * ## Responsibilities:
 * - Slug generation from reaction names
 * - Count field management for owner/viewer arrays
 * - Kind-based filter manipulation to ensure _kind is always included
 * - Idempotency key calculation and idempotent reaction lookup
 * - Lookup processing for related entities
 * - Raw findById without injection (for internal use)
 * - Version management for updates
 * - Uniqueness checking for create and update operations
 *
 * ## Architecture:
 * This is Level 2B of a three-tier repository hierarchy:
 * 1. EntityPersistenceBaseRepository (Level 1) - Universal Base
 * 2. EntityPersistenceReactionRepository (Level 2B) - THIS CLASS - Reaction logic
 * 3. Concrete Repositories - EntityReactions, ListReactions
 *
 * @template E - The reaction entity model type (must extend ReactionsCommonBase)
 * @template IdType - The type of the entity's ID field
 * @template Relations - Optional relations object type
 */
export abstract class EntityPersistenceReactionRepository<
  E extends ReactionsCommonBase,
  IdType,
  Relations extends object = {},
> extends EntityPersistenceBaseRepository<E, IdType, Relations> {
  /**
   * The reaction type name used in error messages (e.g., 'Entity reaction', 'List reaction').
   * Each subclass MUST define this property.
   */
  protected abstract readonly reactionTypeName: string;

  /**
   * The error code prefix for this reaction type (e.g., 'ENTITY-REACTION', 'LIST-REACTION').
   * Used to generate consistent error codes.
   */
  protected abstract readonly errorCodePrefix: string;

  /**
   * The URI path segment for this reaction type (e.g., 'entity-reactions', 'list-reactions').
   * Used to construct parent/child URIs.
   */
  protected abstract readonly uriPathSegment: string;

  /**
   * The field name for the source reference (e.g., '_entityId', '_listId').
   * Used for immutability checks on updates.
   */
  protected abstract readonly sourceIdFieldName: string;

  /**
   * LookupHelper instance for processing lookups.
   * Must be injected by subclasses.
   */
  protected abstract readonly lookupHelper: LookupHelper;

  /**
   * RecordLimitCheckerService instance for uniqueness and limit checks.
   * Must be injected by subclasses.
   */
  protected abstract readonly recordLimitChecker: RecordLimitCheckerService;

  /**
   * LookupConstraintService instance for validating lookup constraints.
   * Must be injected by subclasses.
   */
  protected abstract readonly lookupConstraintService: LookupConstraintService;

  /**
   * LoggingService instance for logging.
   * Must be injected by subclasses.
   */
  protected abstract readonly loggingService: LoggingService;

  constructor(
    entityClass: typeof Entity & { prototype: E },
    dataSource: juggler.DataSource,
  ) {
    super(entityClass, dataSource);
  }

  // SLUG GENERATION

  /**
   * Generates a URL-friendly slug from the reaction's _name field.
   * Only generates a slug if _name is present and _slug is not already set.
   *
   * @param data - The data object containing _name to slugify
   */
  protected generateSlug(data: DataObject<E>): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reactionData = data as any;
    if (reactionData._name && !reactionData._slug) {
      reactionData._slug = slugify(reactionData._name ?? '', {
        lower: true,
        strict: true,
      });
    }
  }

  // COUNT FIELD MANAGEMENT

  /**
   * Updates count fields based on the length of their corresponding arrays.
   * Only updates a count field if its related array is present in the data object.
   *
   * @param data - The data object containing arrays to count
   */
  protected setCountFields(data: DataObject<E>): void {
    const reactionData = data as DataObject<ReactionsCommonBase>;

    if (_.isArray(reactionData._ownerUsers)) {
      reactionData._ownerUsersCount = reactionData._ownerUsers.length;
    }

    if (_.isArray(reactionData._ownerGroups)) {
      reactionData._ownerGroupsCount = reactionData._ownerGroups.length;
    }

    if (_.isArray(reactionData._viewerUsers)) {
      reactionData._viewerUsersCount = reactionData._viewerUsers.length;
    }

    if (_.isArray(reactionData._viewerGroups)) {
      reactionData._viewerGroupsCount = reactionData._viewerGroups.length;
    }

    if (_.isArray(reactionData._parents)) {
      reactionData._parentsCount = reactionData._parents.length;
    }
  }

  // KIND-BASED FILTER MANIPULATION

  /**
   * Ensures that the `_kind` field is always included in query results.
   * This is essential for proper kind-based processing and filtering.
   *
   * @param filter - The filter to modify
   * @returns The modified filter with _kind inclusion guaranteed
   */
  protected forceKindInclusion(
    filter: Filter<E> | undefined,
  ): Filter<E> | undefined {
    if (!filter) {
      return filter;
    }

    if (!filter.fields) {
      return filter;
    }

    // If fields is an array, ensure _kind is included
    if (Array.isArray(filter.fields)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!filter.fields.includes('_kind' as any)) {
        return {
          ...filter,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fields: [...filter.fields, '_kind' as any],
        };
      }

      return filter;
    }

    // If fields is an object (inclusion/exclusion mode)
    const fieldEntries = Object.entries(filter.fields);
    const hasInclusionMode = fieldEntries.some(([_, value]) => value === true);

    if (hasInclusionMode) {
      // Inclusion mode: ensure _kind: true
      return {
        ...filter,
        fields: {
          ...filter.fields,
          _kind: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      };
    }

    // Exclusion mode: remove _kind if it's set to false
    const updatedFields = { ...filter.fields } as Record<string, boolean>;
    if (updatedFields._kind === false) {
      delete updatedFields._kind;
    }

    return {
      ...filter,
      fields: updatedFields as typeof filter.fields,
    };
  }

  // LOOKUP PROCESSING

  /**
   * Processes lookups for an array of records if the filter contains lookup configuration.
   *
   * @param records - Array of records to process
   * @param filter - Filter containing lookup configuration
   * @param options - Optional transaction options
   * @returns Processed records with lookups resolved
   */
  protected async processLookups(
    records: E[],
    filter?: Filter<E>,
    options?: Options,
  ): Promise<E[]> {
    if (!filter?.lookup) {
      return records;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.lookupHelper.processLookupForArray(
      records as any,
      filter as any,
      options,
    ) as unknown as Promise<E[]>;
  }

  /**
   * Processes lookup for a single record if the filter contains lookup configuration.
   *
   * @param record - Single record to process
   * @param filter - Filter containing lookup configuration
   * @param options - Optional transaction options
   * @returns Processed record with lookups resolved
   */
  protected async processLookup(
    record: E,
    filter?: Filter<E>,
    options?: Options,
  ): Promise<E> {
    if (!filter?.lookup) {
      return record;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.lookupHelper.processLookupForOne(
      record as any,
      filter as any,
      options,
    ) as unknown as Promise<E>;
  }

  // IDEMPOTENCY MANAGEMENT

  /**
   * Searches for an existing reaction with the same idempotency key.
   *
   * @param idempotencyKey - The idempotency key to search for
   * @returns The existing reaction if found, null otherwise
   */
  protected async findIdempotentReaction(
    idempotencyKey: string | undefined,
  ): Promise<E | null> {
    if (_.isString(idempotencyKey) && !_.isEmpty(idempotencyKey)) {
      const sameRecord = await this.findOne({
        where: {
          and: [
            {
              _idempotencyKey: idempotencyKey,
            },
          ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });

      return sameRecord;
    }

    return null;
  }

  /**
   * Calculates an idempotency key hash from the specified fields.
   *
   * @param data - The data object to calculate the key from
   * @param idempotencyFields - Array of field paths to include in the hash
   * @returns SHA-256 hash of the field values, or undefined if no fields configured
   */
  protected calculateIdempotencyKeyFromFields(
    data: DataObject<E>,
    idempotencyFields: string[],
  ): string | undefined {
    if (idempotencyFields.length === 0) {
      return undefined;
    }

    const fieldValues = idempotencyFields.map((idempotencyField) => {
      const value = _.get(data, idempotencyField);

      if (Array.isArray(value)) {
        return JSON.stringify([...value].sort());
      }

      return typeof value === 'object' ? JSON.stringify(value) : value;
    });

    const keyString = fieldValues.join(',');
    const hash = crypto.createHash('sha256').update(keyString);

    return hash.digest('hex');
  }

  // RAW FIND BY ID (WITHOUT RECORD TYPE INJECTION)

  /**
   * Finds a reaction by ID without injecting record type.
   * Used internally for update operations where we need the raw data.
   *
   * @param id - The ID of the reaction to find
   * @param filter - Optional filter for field selection
   * @returns The raw reaction data
   * @throws HttpErrorResponse if not found
   */
  protected async findByIdRaw(
    id: string,
    filter?: FilterExcludingWhere<E>,
  ): Promise<E> {
    try {
      const reaction = await super.findById(id as IdType, filter);
      return reaction;
    } catch (error) {
      if (error.code === 'ENTITY_NOT_FOUND') {
        this.loggingService.warn(
          `${this.reactionTypeName} with id '${id}' not found.`,
        );
        throw this.createNotFoundError(id);
      }

      throw error;
    }
  }

  // UNIQUENESS CHECKING

  /**
   * Checks uniqueness constraints for a new reaction being created.
   *
   * @param entityClass - The entity class for the reaction
   * @param newData - The data for the new reaction
   * @param options - Optional transaction options
   */
  protected async checkUniquenessForCreate(
    entityClass: typeof Entity & { prototype: E },
    newData: DataObject<E>,
    options?: Options,
  ): Promise<void> {
    await this.recordLimitChecker.checkUniqueness(
      entityClass,
      newData,
      this,
      options,
    );
  }

  /**
   * Checks uniqueness constraints for an existing reaction being updated.
   * Merges existing data with incoming data before checking.
   *
   * @param entityClass - The entity class for the reaction
   * @param id - ID of the reaction being updated
   * @param newData - The new data for the reaction
   * @param existingData - The existing data of the reaction
   * @param options - Optional transaction options
   */
  protected async checkUniquenessForUpdate(
    entityClass: typeof Entity & { prototype: E },
    id: IdType,
    newData: DataObject<E>,
    existingData?: E,
    options?: Options,
  ): Promise<void> {
    const existing = existingData ?? (await this.findById(id));
    const mergedData = _.assign(
      {},
      existing && _.pickBy(existing, (value) => value !== null),
      newData,
    );
    await this.recordLimitChecker.checkUniqueness(
      entityClass,
      mergedData,
      this,
      options,
    );
  }

  // ERROR HELPERS

  /**
   * Creates a standardized not found error for this reaction type.
   *
   * @param id - The ID that was not found
   * @returns HttpErrorResponse with appropriate status and message
   */
  protected createNotFoundError(id: string): HttpErrorResponse {
    return new HttpErrorResponse({
      statusCode: 404,
      name: 'NotFoundError',
      message: `${this.reactionTypeName} with id '${id}' could not be found.`,
      code: `${this.errorCodePrefix}-NOT-FOUND`,
    });
  }

  /**
   * Creates a standardized immutable kind error for this reaction type.
   *
   * @param currentKind - The current kind value (optional)
   * @returns HttpErrorResponse with appropriate status and message
   */
  protected createImmutableKindError(currentKind?: string): HttpErrorResponse {
    const message = currentKind
      ? `${this.reactionTypeName} kind cannot be changed after creation. Current kind is '${currentKind}'.`
      : `${this.reactionTypeName} kind cannot be changed after creation.`;

    return new HttpErrorResponse({
      statusCode: 422,
      name: 'ImmutableKindError',
      message,
      code: `IMMUTABLE-${this.errorCodePrefix}-KIND`,
    });
  }

  /**
   * Creates a standardized immutable source ID error for this reaction type.
   *
   * @param fieldName - The name of the source ID field (e.g., '_entityId', '_listId')
   * @param currentValue - The current value of the field (optional)
   * @returns HttpErrorResponse with appropriate status and message
   */
  protected createImmutableSourceIdError(
    fieldName: string,
    currentValue?: string,
  ): HttpErrorResponse {
    const fieldDisplayName = fieldName.replace('_', '').replace('Id', ' ID');
    const message = currentValue
      ? `${this.reactionTypeName} ${fieldDisplayName} cannot be changed after creation. Current ${fieldDisplayName} is '${currentValue}'.`
      : `${this.reactionTypeName} ${fieldDisplayName} cannot be changed after creation.`;

    return new HttpErrorResponse({
      statusCode: 422,
      name: `Immutable${fieldName.charAt(1).toUpperCase() + fieldName.slice(2).replace('Id', 'Id')}Error`,
      message,
      code: `IMMUTABLE-${fieldName.toUpperCase().replace('_', '')}`,
    });
  }

  /**
   * Creates a standardized invalid kind format error.
   *
   * @param suggestedKind - The suggested valid format for the kind
   * @returns HttpErrorResponse with appropriate status and message
   */
  protected createInvalidKindFormatError(
    suggestedKind: string,
  ): HttpErrorResponse {
    return new HttpErrorResponse({
      statusCode: 422,
      name: 'InvalidKindError',
      message: `${this.reactionTypeName} kind cannot contain special or uppercase characters. Use '${suggestedKind}' instead.`,
      code: `INVALID-${this.errorCodePrefix}-KIND`,
    });
  }

  /**
   * Creates a standardized invalid kind value error.
   *
   * @param invalidKind - The invalid kind value provided
   * @param validValues - Array of valid kind values
   * @returns HttpErrorResponse with appropriate status and message
   */
  protected createInvalidKindValueError(
    invalidKind: string,
    validValues: string[],
  ): HttpErrorResponse {
    return new HttpErrorResponse({
      statusCode: 422,
      name: 'InvalidKindError',
      message: `${this.reactionTypeName} kind '${invalidKind}' is not valid. Use any of these values instead: ${validValues.join(', ')}`,
      code: `INVALID-${this.errorCodePrefix}-KIND`,
    });
  }

  /**
   * Constructs a parent URI for hierarchical relationships.
   *
   * @param parentId - The ID of the parent reaction
   * @returns The full URI string for the parent reference
   */
  protected buildParentUri(parentId: string): string {
    return `tapp://localhost/${this.uriPathSegment}/${parentId}`;
  }
}
