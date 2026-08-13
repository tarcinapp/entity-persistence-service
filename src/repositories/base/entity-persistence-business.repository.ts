import type {
  DataObject,
  Entity,
  Filter,
  FilterExcludingWhere,
  Options,
  Where,
  Count,
  juggler,
} from '@loopback/repository';
import * as crypto from 'crypto';
import _ from 'lodash';
import slugify from 'slugify';
import { EntityPersistenceBaseRepository } from './entity-persistence-base.repository';
import { IDEMPOTENCY_EXCLUDED_FIELDS } from '../../models/base-types/unmodifiable-common-fields';
import type { IdempotencyConfigurationReader } from '../../extensions/config-helpers/idempotency-config-helper';
import type { KindConfigurationReader } from '../../extensions/config-helpers/kind-config-helper';
import type { ResponseLimitConfigurationReader } from '../../extensions/config-helpers/response-limit-config-helper';
import type { ValidfromConfigurationReader } from '../../extensions/config-helpers/validfrom-config-helper';
import type { VisibilityConfigurationReader } from '../../extensions/config-helpers/visibility-config-helper';
import type { LookupHelper } from '../../extensions/utils/lookup-helper';
import type { ListEntityCommonBase } from '../../models';
import { HttpErrorResponse } from '../../models';
import type { LoggingService } from '../../services/logging.service';
import type { LookupConstraintService } from '../../services/lookup-constraint.service';
import type { RecordLimitCheckerService } from '../../services/record-limit-checker.service';

/**
 * EntityPersistenceBusinessRepository - Specialized Base for Business Entities
 *
 * This abstract base class provides common business logic shared between
 * Entity and List repositories. It extends EntityPersistenceBaseRepository (Level 1).
 *
 * ## Responsibilities:
 * - Slug generation from entity names
 * - Count field management for owner/viewer arrays
 * - Kind-based filter manipulation to ensure _kind is always included
 * - Idempotency key calculation and idempotent record lookup
 * - Lookup processing for related entities
 * - Kind format and value validation
 * - Uniqueness checking for create and update operations
 *
 * ## Architecture:
 * This is Level 2 of a three-tier repository hierarchy:
 * 1. EntityPersistenceBaseRepository (Level 1) - Universal Base
 * 2. EntityPersistenceBusinessRepository (Level 2) - THIS CLASS - Business logic
 * 3. Concrete Repositories - Entity, List
 *
 * @template E - The business entity model type (must extend ListEntityCommonBase)
 * @template IdType - The type of the entity's ID field
 * @template Relations - Optional relations object type
 */
export abstract class EntityPersistenceBusinessRepository<
  E extends ListEntityCommonBase,
  IdType,
  Relations extends object = {},
> extends EntityPersistenceBaseRepository<E, IdType, Relations> {
  /**
   * The entity type name used in error messages (e.g., 'Entity', 'List').
   * Each subclass MUST define this property.
   */
  protected abstract readonly entityTypeName: string;

  /**
   * The error code prefix for this entity type (e.g., 'ENTITY', 'LIST').
   * Used to generate consistent error codes.
   */
  protected abstract readonly errorCodePrefix: string;

  /**
   * The URI path segment for this entity type (e.g., 'entities', 'lists').
   * Used to construct parent/child URIs.
   */
  protected abstract readonly uriPathSegment: string;

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

  /**
   * KindConfigurationReader for kind validation and defaults.
   * Must be injected by subclasses.
   */
  protected abstract readonly kindConfigReader: KindConfigurationReader;

  /**
   * VisibilityConfigurationReader for visibility defaults.
   * Must be injected by subclasses.
   */
  protected abstract readonly visibilityConfigReader: VisibilityConfigurationReader;

  /**
   * ValidfromConfigurationReader for auto-approval settings.
   * Must be injected by subclasses.
   */
  protected abstract readonly validfromConfigReader: ValidfromConfigurationReader;

  /**
   * IdempotencyConfigurationReader for idempotency field configuration.
   * Must be injected by subclasses.
   */
  protected abstract readonly idempotencyConfigReader: IdempotencyConfigurationReader;

  /**
   * ResponseLimitConfigurationReader for response limit settings.
   * Must be injected by subclasses.
   */
  protected abstract readonly responseLimitConfigReader: ResponseLimitConfigurationReader;

  constructor(
    entityClass: typeof Entity & { prototype: E },
    dataSource: juggler.DataSource,
  ) {
    super(entityClass, dataSource);
  }

  // ABSTRACT HOOK METHODS (Template Method Pattern)

  /**
   * Returns the default kind for this entity type.
   * Subclasses override to provide entity-specific default kind.
   */
  protected abstract getDefaultKind(): string;

  /**
   * Returns the idempotency fields for the given kind.
   * Subclasses override to use their specific config reader method.
   */
  protected abstract getIdempotencyFields(kind?: string): string[];

  /**
   * Returns the visibility for the given kind.
   * Subclasses override to use their specific config reader method.
   */
  protected abstract getVisibilityForKind(kind?: string): string;

  /**
   * Returns whether auto-approval is enabled for the given kind.
   * Subclasses override to use their specific config reader method.
   */
  protected abstract getValidFromForKind(kind?: string): boolean;

  /**
   * Returns the response limit for this entity type.
   * Subclasses override to use their specific config reader method.
   */
  protected abstract getResponseLimit(): number;

  /**
   * Validates if the kind is acceptable for this entity type.
   * Subclasses override to use their specific config reader method.
   */
  protected abstract isKindAcceptable(kind: string): boolean;

  /**
   * Returns the list of allowed kinds for this entity type.
   * Subclasses override to return from their specific config reader.
   */
  protected abstract getAllowedKinds(): string[];

  // STANDARD CRUD OPERATIONS

  /**
   * Finds records with standard business processing.
   * Includes response limiting, kind inclusion, lookup processing.
   */
  async find(
    filter?: Filter<E>,
    options?: Options,
  ): Promise<(E & Relations)[]> {
    try {
      const limit = filter?.limit ?? this.getResponseLimit();

      filter = {
        ...filter,
        limit: Math.min(limit, this.getResponseLimit()),
      };

      // Ensure _kind is always included
      filter = this.forceKindInclusion(filter);

      this.loggingService.info(
        `${this.entityTypeName}Repository.find - Modified filter:`,
        {
          filter,
        },
      );

      const records = await super.find(filter, options);
      const recordsWithLookup = await this.processLookups(
        records,
        filter,
        options,
      );

      return this.injectRecordTypeArray(recordsWithLookup);
    } catch (error) {
      this.loggingService.error(
        `${this.entityTypeName}Repository.find - Error:`,
        { error },
      );
      throw error;
    }
  }

  /**
   * Finds a single record by ID with standard business processing.
   */
  async findById(
    id: IdType,
    filter?: FilterExcludingWhere<E>,
    options?: Options,
  ): Promise<E & Relations> {
    try {
      // Ensure _kind is always included (cast to Filter for the helper)
      const forcedFilter = this.forceKindInclusion(filter as Filter<E>);
      const typedFilter = forcedFilter as FilterExcludingWhere<E>;

      const record = await super.findById(id, typedFilter, options);
      const recordWithLookup = await this.processLookup(
        record,
        filter as Filter<E>,
        options,
      );

      return this.injectRecordType(recordWithLookup);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((error as any).code === 'ENTITY_NOT_FOUND') {
        this.loggingService.warn(
          `${this.entityTypeName} with id '${id}' not found.`,
        );
        throw this.createNotFoundError(String(id));
      }

      this.loggingService.error(
        `${this.entityTypeName}Repository.findById - Unexpected Error:`,
        {
          error,
          id,
        },
      );

      throw error;
    }
  }

  /**
   * Creates a new record with idempotency and validation.
   */
  async create(data: DataObject<E>, options?: Options): Promise<E> {
    const idempotencyKey = this.calculateIdempotencyKey(data);
    const foundIdempotent = await this.findIdempotentRecord(idempotencyKey);

    if (foundIdempotent) {
      this.loggingService.info(
        `${this.entityTypeName}Repository.create - Idempotent record found. Skipping creation.`,
        {
          idempotencyKey,
          existingRecord: foundIdempotent,
        },
      );

      return this.injectRecordType(foundIdempotent);
    }

    if (idempotencyKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data as any)._idempotencyKey = idempotencyKey;
    }

    // Capture _parents before enrichment (modifyDataForCreation may mutate data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newParents: string[] = Array.isArray((data as any)._parents)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [...(data as any)._parents]
      : [];

    // Validate, enrich, and create
    const created = await this.createRecordFacade(data, options);

    if (newParents.length > 0) {
      const recordUri = this.buildParentUri(created._id as string);
      await this.syncParentChildReferences(recordUri, [], newParents, options);
    }

    return created;
  }

  /**
   * Replaces a record by ID with validation.
   */
  async replaceById(
    id: IdType,
    data: DataObject<E>,
    options?: Options,
  ): Promise<void> {
    // Capture _parents before modifyDataForUpdates sanitizes data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newParents: string[] | undefined = Array.isArray((data as any)._parents)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [...(data as any)._parents]
      : undefined;

    const collection = await this.modifyDataForUpdates(String(id), data);

    // Calculate idempotencyKey and assign it if present
    const idempotencyKey = this.calculateIdempotencyKey(collection.data);
    if (idempotencyKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (collection.data as any)._idempotencyKey = idempotencyKey;
    }

    const validEnrichedData = await this.validateDataForReplace(
      String(id),
      collection.data,
      options,
    );

    await super.replaceById(id, validEnrichedData, options);

    if (newParents !== undefined) {
      const recordUri = this.buildParentUri(String(id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldParents: string[] = Array.isArray((collection.existingData as any)._parents)
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (collection.existingData as any)._parents
        : [];
      await this.syncParentChildReferences(recordUri, oldParents, newParents, options);
    }
  }

  /**
   * Updates a record by ID with validation.
   */
  async updateById(
    id: IdType,
    data: DataObject<E>,
    options?: Options,
  ): Promise<void> {
    // Capture _parents before modifyDataForUpdates sanitizes data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newParents: string[] | undefined = Array.isArray((data as any)._parents)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [...(data as any)._parents]
      : undefined;

    const collection = await this.modifyDataForUpdates(String(id), data);

    // Merge incoming data with existing data to ensure completeness
    const mergedData = _.defaults({}, collection.data, collection.existingData);

    // Calculate idempotencyKey based on the fully merged entity
    const idempotencyKey = this.calculateIdempotencyKey(mergedData);

    // Store the idempotencyKey in the data being updated
    if (idempotencyKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (collection.data as any)._idempotencyKey = idempotencyKey;
    }

    const validEnrichedData = await this.validateDataForUpdate(
      String(id),
      collection.existingData,
      collection.data,
      options,
    );

    await super.updateById(id, validEnrichedData, options);

    if (newParents !== undefined) {
      const recordUri = this.buildParentUri(String(id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldParents: string[] = Array.isArray((collection.existingData as any)._parents)
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (collection.existingData as any)._parents
        : [];
      await this.syncParentChildReferences(recordUri, oldParents, newParents, options);
    }
  }

  /**
   * Updates all matching records with immutability checks.
   */
  async updateAll(
    data: DataObject<E>,
    where?: Where<E>,
    options?: Options,
  ): Promise<Count> {
    // Check if user is trying to change the _kind field, which is immutable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((data as any)._kind !== undefined) {
      throw this.createImmutableKindError();
    }

    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any)._lastUpdatedDateTime = now;

    // Generate slug and set count fields
    this.generateSlug(data);
    this.setCountFields(data);

    this.loggingService.info(
      `${this.entityTypeName}Repository.updateAll - Modified data:`,
      {
        data,
        where,
      },
    );

    return super.updateAll(data, where, options);
  }

  // LIFECYCLE FACADES

  /**
   * Creates a new record with full validation and enrichment pipeline.
   * This is the main entry point for record creation after idempotency check.
   */
  protected async createRecordFacade(
    data: DataObject<E>,
    options?: Options,
  ): Promise<E> {
    const enrichedData = await this.modifyDataForCreation(data);
    const validEnrichedData = await this.validateDataForCreation(
      enrichedData,
      options,
    );
    const created = await super.create(validEnrichedData, options);

    return this.injectRecordType(created);
  }

  /**
   * Modifies incoming data for creation with all managed fields.
   * Sets defaults for timestamps, version, visibility, slug, and counts.
   */
  protected async modifyDataForCreation(
    data: DataObject<E>,
  ): Promise<DataObject<E>> {
    // Strip virtual fields before persisting
    data = this.sanitizeRecordType(data);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const businessData = data as any;

    businessData._kind = businessData._kind ?? this.getDefaultKind();

    // Take the date of now to make sure we have exactly the same date in all date fields
    const now = new Date().toISOString();

    // Use incoming creationDateTime and lastUpdateDateTime if given
    businessData._createdDateTime = businessData._createdDateTime ?? now;
    businessData._lastUpdatedDateTime =
      businessData._lastUpdatedDateTime ?? now;

    // Auto-approve the record if it is configured
    const shouldAutoApprove = this.getValidFromForKind(businessData._kind);
    businessData._validFromDateTime =
      businessData._validFromDateTime ?? (shouldAutoApprove ? now : undefined);

    // Explicitly set validUntilDateTime to null if not provided
    businessData._validUntilDateTime = businessData._validUntilDateTime ?? null;

    // New data is starting from version 1
    businessData._version = 1;

    // Set visibility
    businessData._visibility =
      businessData._visibility ?? this.getVisibilityForKind(businessData._kind);

    // Prepare slug from the name and set to the record
    this.generateSlug(data);

    // Set owners count to make searching easier
    this.setCountFields(data);

    return data;
  }

  /**
   * Validates incoming data for creation.
   * Checks kind format, kind values, uniqueness, limits, and lookup constraints.
   */
  protected async validateDataForCreation(
    data: DataObject<E>,
    options?: Options,
  ): Promise<DataObject<E>> {
    this.checkDataKindFormat(data);
    this.checkDataKindValues(data);

    await Promise.all([
      this.checkUniquenessForCreate(this.entityClass, data, options),

      this.recordLimitChecker.checkLimits(
        this.entityClass as any,
        data,
        this as any,
        options,
      ),
      this.lookupConstraintService.validateLookupConstraints(
        data as E,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.entityClass as any,
        options,
      ),
    ]);

    return data;
  }

  /**
   * Modifies data for update operations (both replace and update).
   * Fetches existing data, updates version and timestamp.
   */
  protected async modifyDataForUpdates(
    id: string,
    data: DataObject<E>,
    options?: Options,
  ): Promise<{ data: DataObject<E>; existingData: E }> {
    // Strip virtual fields before persisting
    data = this.sanitizeRecordType(data);

    const existingData = await this.findById(id as IdType, undefined, options);

    if (!existingData) {
      throw this.createNotFoundError(id);
    }

    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const businessData = data as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingBusinessData = existingData as any;

    // Set new version
    businessData._version = (existingBusinessData._version ?? 1) + 1;

    // Use current date if not provided
    businessData._lastUpdatedDateTime =
      businessData._lastUpdatedDateTime ?? now;

    this.generateSlug(data);
    this.setCountFields(data);

    return {
      data,
      existingData,
    };
  }

  /**
   * Validates data for replace operations.
   * Checks kind immutability, uniqueness, limits, and lookup constraints.
   */
  protected async validateDataForReplace(
    id: string,
    data: DataObject<E>,
    options?: Options,
  ): Promise<DataObject<E>> {
    const existingRecord = await this.findById(id as IdType);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataKind = (data as any)._kind;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingKind = (existingRecord as any)._kind;

    // Check if user is trying to change the _kind field
    if (dataKind !== undefined && dataKind !== existingKind) {
      throw this.createImmutableKindError(existingKind);
    }

    await Promise.all([
      this.checkUniquenessForUpdate(
        this.entityClass,
        id as IdType,
        data,
        existingRecord,
        options,
      ),

      this.recordLimitChecker.checkLimits(
        this.entityClass as any,
        data,
        this as any,
        options,
      ),
      this.lookupConstraintService.validateLookupConstraints(
        data as E,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.entityClass as any,
        options,
      ),
    ]);

    return data;
  }

  /**
   * Validates data for update operations.
   * Checks kind immutability, uniqueness, limits, and lookup constraints.
   */
  protected async validateDataForUpdate(
    id: string,
    existingData: E,
    data: DataObject<E>,
    options?: Options,
  ): Promise<DataObject<E>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataKind = (data as any)._kind;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingKind = (existingData as any)._kind;

    // Check if user is trying to change the _kind field
    if (dataKind !== undefined && dataKind !== existingKind) {
      throw this.createImmutableKindError(existingKind);
    }

    // Merge existing data with incoming data to check limits and uniqueness
    const mergedData = _.assign(
      {},
      existingData && _.pickBy(existingData, (value) => value !== null),
      data,
    );

    await Promise.all([
      this.checkUniquenessForUpdate(
        this.entityClass,
        id as IdType,
        mergedData,
        existingData,
        options,
      ),

      this.recordLimitChecker.checkLimits(
        this.entityClass as any,
        mergedData,
        this as any,
        options,
      ),
      this.lookupConstraintService.validateLookupConstraints(
        mergedData as E,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.entityClass as any,
        options,
      ),
    ]);

    this.generateSlug(data);
    this.setCountFields(data);

    return data;
  }

  // KIND VALIDATION

  /**
   * Validates the format of the kind field.
   * Kind must not contain special characters or uppercase letters.
   */
  protected checkDataKindFormat(data: DataObject<E>): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kind = (data as any)._kind;
    if (kind) {
      const slugKind = this.kindConfigReader.validateKindFormat(kind);
      if (slugKind) {
        throw this.createInvalidKindFormatError(slugKind);
      }
    }
  }

  /**
   * Validates that the kind value is acceptable for this entity type.
   */
  protected checkDataKindValues(data: DataObject<E>): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kind = (data as any)._kind;
    if (kind && !this.isKindAcceptable(kind)) {
      throw this.createInvalidKindValueError(kind, this.getAllowedKinds());
    }
  }

  // IDEMPOTENCY

  /**
   * Calculates the idempotency key for the given data.
   * Uses the configured idempotency fields for this entity type.
   * Silently filters out any server-managed fields from the configured list
   * to prevent operator misconfiguration from corrupting idempotency semantics.
   */
  protected calculateIdempotencyKey(data: DataObject<E>): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kind = (data as any)._kind;
    const rawFields = this.getIdempotencyFields(kind);

    const safeFields = rawFields.filter(
      (f) => !IDEMPOTENCY_EXCLUDED_FIELDS.includes(f),
    );

    if (safeFields.length < rawFields.length) {
      const discarded = rawFields.filter((f) =>
        IDEMPOTENCY_EXCLUDED_FIELDS.includes(f),
      );
      this.loggingService.warn(
        `${this.entityTypeName}Repository.calculateIdempotencyKey - ` +
          `Ignoring server-managed fields configured as idempotency contributors: [${discarded.join(', ')}]. ` +
          `These fields must not be used for idempotency. Remove them from the idempotency configuration.`,
      );
    }

    return this.calculateIdempotencyKeyFromFields(data, safeFields);
  }

  // SLUG GENERATION

  /**
   * Generates a URL-friendly slug from the entity's _name field.
   * Only generates a slug if _name is present and _slug is not already set.
   *
   * @param data - The data object containing _name to slugify
   */
  protected generateSlug(data: DataObject<E>): void {
    const businessData = data as DataObject<ListEntityCommonBase>;
    if (businessData._name && !businessData._slug) {
      businessData._slug = slugify(businessData._name ?? '', {
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
    const businessData = data as DataObject<ListEntityCommonBase>;

    if (_.isArray(businessData._ownerUsers)) {
      businessData._ownerUsersCount = businessData._ownerUsers.length;
    }

    if (_.isArray(businessData._ownerGroups)) {
      businessData._ownerGroupsCount = businessData._ownerGroups.length;
    }

    if (_.isArray(businessData._viewerUsers)) {
      businessData._viewerUsersCount = businessData._viewerUsers.length;
    }

    if (_.isArray(businessData._viewerGroups)) {
      businessData._viewerGroupsCount = businessData._viewerGroups.length;
    }

    if (_.isArray(businessData._parents)) {
      businessData._parentsCount = businessData._parents.length;
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
    records: (E & Relations)[],
    filter?: Filter<E>,
    options?: Options,
  ): Promise<(E & Relations)[]> {
    if (!filter?.lookup) {
      return records;
    }

    return this.lookupHelper.processLookupForArray(
      records as any,
      filter as any,
      options,
    ) as Promise<(E & Relations)[]>;
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
    record: E & Relations,
    filter?: Filter<E>,
    options?: Options,
  ): Promise<E & Relations> {
    if (!filter?.lookup) {
      return record;
    }

    return this.lookupHelper.processLookupForOne(
      record as any,
      filter as any,
      options,
    ) as Promise<E & Relations>;
  }

  // IDEMPOTENCY MANAGEMENT

  /**
   * Searches for an existing record with the same idempotency key.
   *
   * @param idempotencyKey - The idempotency key to search for
   * @returns The existing record if found, null otherwise
   */
  protected async findIdempotentRecord(
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
   * Must be implemented by subclasses to use their specific idempotency configuration.
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

      // If value is an array, sort it before stringifying
      if (Array.isArray(value)) {
        return JSON.stringify([...value].sort());
      }

      return typeof value === 'object' ? JSON.stringify(value) : value;
    });

    const keyString = fieldValues.join(',');
    const hash = crypto.createHash('sha256').update(keyString);

    return hash.digest('hex');
  }

  // UNIQUENESS CHECKING

  /**
   * Checks uniqueness constraints for a new record being created.
   *
   * @param entityClass - The entity class for the record
   * @param newData - The data for the new record
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
   * Checks uniqueness constraints for an existing record being updated.
   * Merges existing data with incoming data before checking.
   *
   * @param entityClass - The entity class for the record
   * @param id - ID of the record being updated
   * @param newData - The new data for the record
   * @param existingData - The existing data of the record (optional, will be fetched if not provided)
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
   * Creates a standardized not found error for this entity type.
   *
   * @param id - The ID that was not found
   * @returns HttpErrorResponse with appropriate status and message
   */
  protected createNotFoundError(id: string): HttpErrorResponse {
    return new HttpErrorResponse({
      statusCode: 404,
      name: 'NotFoundError',
      message: `${this.entityTypeName} with id '${id}' could not be found.`,
      code: `${this.errorCodePrefix}-NOT-FOUND`,
    });
  }

  /**
   * Creates a standardized immutable kind error for this entity type.
   *
   * @param currentKind - The current kind value (optional)
   * @returns HttpErrorResponse with appropriate status and message
   */
  protected createImmutableKindError(currentKind?: string): HttpErrorResponse {
    const message = currentKind
      ? `${this.entityTypeName} kind cannot be changed after creation. Current kind is '${currentKind}'.`
      : `${this.entityTypeName} kind cannot be changed after creation.`;

    return new HttpErrorResponse({
      statusCode: 422,
      name: 'ImmutableKindError',
      message,
      code: `IMMUTABLE-${this.errorCodePrefix}-KIND`,
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
      message: `${this.entityTypeName} kind cannot contain special or uppercase characters. Use '${suggestedKind}' instead.`,
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
      message: `${this.entityTypeName} kind '${invalidKind}' is not valid. Use any of these values instead: ${validValues.join(', ')}`,
      code: `INVALID-${this.errorCodePrefix}-KIND`,
    });
  }

  /**
   * Constructs a parent URI for hierarchical relationships.
   *
   * @param parentId - The ID of the parent record
   * @returns The full URI string for the parent reference
   */
  protected buildParentUri(parentId: string): string {
    return `tapp://localhost/${this.uriPathSegment}/${parentId}`;
  }

  // HIERARCHICAL RELATIONSHIPS

  /**
   * Finds all parent records of a given record.
   * Extracts parent IDs from the _parents URI array and fetches the corresponding records.
   *
   * @param id - The ID of the record whose parents to find
   * @param filter - Optional filter to apply to the parent query
   * @param options - Optional options for transaction support
   * @returns Array of parent records with their relations
   */
  async findParents(
    id: string,
    filter?: Filter<E>,
    options?: Options,
  ): Promise<(E & Relations)[]> {
    try {
      // Get the record's parent references
      const record = await this.findById(
        id as IdType,
        { fields: { _parents: true } } as FilterExcludingWhere<E>,
      );

      const parents = record._parents;
      if (!parents || parents.length === 0) {
        return [];
      }

      // Extract parent IDs from the URIs
      const parentIds = parents.map((uri: string) => uri.split('/').pop());

      // Create a filter that includes the parent IDs
      const parentFilter: Filter<E> = {
        ...filter,
        where: {
          and: [
            { _id: { inq: parentIds } },
            ...(filter?.where ? [filter.where] : []),
          ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      };

      this.loggingService.info(
        `${this.entityTypeName}Repository.findParents - Parent filter:`,
        { parentFilter },
      );

      return await this.find(parentFilter, options);
    } catch (error) {
      this.loggingService.error(
        `${this.entityTypeName}Repository.findParents - Error:`,
        { error, id },
      );
      throw error;
    }
  }

  /**
   * Finds all child records of a given record.
   * Uses a forward lookup on the parent's `_children` array — mirrors `findParents`.
   *
   * @param id - The ID of the record whose children to find
   * @param filter - Optional filter to apply to the children query
   * @param options - Optional options for transaction support
   * @returns Array of child records with their relations
   */
  async findChildren(
    id: string,
    filter?: Filter<E>,
    options?: Options,
  ): Promise<(E & Relations)[]> {
    try {
      // Throws 404 if the parent does not exist
      const record = await this.findById(
        id as IdType,
        { fields: { _children: true } } as FilterExcludingWhere<E>,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children = (record as any)._children as string[] | undefined;
      if (!children || children.length === 0) {
        return [];
      }

      // Extract child IDs from the URIs
      const childIds = children.map((uri: string) => uri.split('/').pop());

      // Create a filter that includes the child IDs
      const childFilter: Filter<E> = {
        ...filter,
        where: {
          and: [
            { _id: { inq: childIds } },
            ...(filter?.where ? [filter.where] : []),
          ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      };

      this.loggingService.info(
        `${this.entityTypeName}Repository.findChildren - Child filter:`,
        { childFilter },
      );

      return await this.find(childFilter, options);
    } catch (error) {
      this.loggingService.error(
        `${this.entityTypeName}Repository.findChildren - Error:`,
        { error, id },
      );
      throw error;
    }
  }

  /**
   * Creates a child record with a reference to the specified parent.
   * Verifies parent existence before creating the child.
   *
   * @param parentId - The ID of the parent record
   * @param data - The data for the new child record (without _parents)
   * @param options - Optional options for transaction support
   * @returns The newly created child record
   */
  async createChild(
    parentId: string,
    data: Omit<E, '_id' | '_parents'>,
    options?: Options,
  ): Promise<E> {
    try {
      // Verify that the parent exists
      await this.findById(parentId as IdType, undefined, options);

      // Add the parent reference to the data
      const childData = {
        ...data,
        _parents: [this.buildParentUri(parentId)],
      };

      const created = await this.create(childData as DataObject<E>, options);
      const childUri = this.buildParentUri(created._id as string);
      await this.addChildReference(parentId, childUri, options);
      return created;
    } catch (error) {
      this.loggingService.error(
        `${this.entityTypeName}Repository.createChild - Error:`,
        { error, parentId },
      );
      throw error;
    }
  }

  // DELETION WITH REFERENCE CLEANUP

  /**
   * Removes this record's URI from parents' `_children` arrays and
   * children's `_parents` arrays before the record is deleted.
   * All operations run inside the active transaction session if present.
   */
  protected async cleanupHierarchyReferences(
    id: string,
    options?: Options,
  ): Promise<void> {
    const record = await this.findById(
      id as IdType,
      {
        fields: { _id: true, _parents: true, _children: true },
      } as FilterExcludingWhere<E>,
      options,
    );

    const recordUri = this.buildParentUri(id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const parentUri of (record as any)._parents ?? []) {
      const parentId = (parentUri as string).split('/').pop() as string;
      await this.removeChildReference(parentId, recordUri, options);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const childUri of (record as any)._children ?? []) {
      const childId = (childUri as string).split('/').pop() as string;
      await this.removeParentReference(childId, recordUri, options);
    }
  }

  async deleteById(id: IdType, options?: Options): Promise<void> {
    await this.cleanupHierarchyReferences(id as string, options);
    return super.deleteById(id, options);
  }

  async deleteAll(where?: Where<E>, options?: Options): Promise<Count> {
    const records = await this.find(
      {
        where,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fields: { _id: true, _parents: true, _children: true } as any,
      },
      options,
    );
    for (const record of records) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.cleanupHierarchyReferences((record as any)._id as string, options);
    }
    return super.deleteAll(where, options);
  }

  // HIERARCHY BOOKKEEPING

  /**
   * Diffs the old and new `_parents` arrays for a record and calls
   * `addChildReference` / `removeChildReference` on each affected parent.
   *
   * - Added parents (in newParents but not oldParents): gain the record URI in `_children`.
   * - Removed parents (in oldParents but not newParents): have the record URI pulled from `_children`.
   *
   * All operations run inside the active transaction session if present in `options`.
   */
  protected async syncParentChildReferences(
    recordUri: string,
    oldParents: string[],
    newParents: string[],
    options?: Options,
  ): Promise<void> {
    const added = newParents.filter(p => !oldParents.includes(p));
    const removed = oldParents.filter(p => !newParents.includes(p));

    for (const parentUri of added) {
      const parentId = parentUri.split('/').pop() as string;
      await this.addChildReference(parentId, recordUri, options);
    }

    for (const parentUri of removed) {
      const parentId = parentUri.split('/').pop() as string;
      await this.removeChildReference(parentId, recordUri, options);
    }
  }

  /**
   * Atomically adds a child URI to a parent record's `_children` array
   * and increments `_childrenCount` by 1.
   *
   * Uses a native MongoDB `$addToSet` + `$inc` updateOne — bypasses all
   * LoopBack lifecycle hooks intentionally. Does NOT touch `_version`,
   * `_lastUpdatedDateTime`, or `_lastUpdatedBy`.
   *
   * The caller is responsible for verifying parent existence before calling.
   * Runs inside the active transaction session if one is present in `options`.
   */
  protected async addChildReference(
    parentId: string,
    childUri: string,
    options?: Options,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collection = (this.dataSource.connector as any)?.collection(
      this.entityClass.modelName,
    );
    await collection.updateOne(
      { _id: parentId },
      {
        $addToSet: { _children: childUri },
        $inc: { _childrenCount: 1 },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { session: (options as any)?.session },
    );
  }

  /**
   * Atomically removes a child URI from a parent record's `_children` array
   * and decrements `_childrenCount` by 1.
   *
   * Uses a native MongoDB `$pull` + `$inc` updateOne — bypasses all
   * LoopBack lifecycle hooks intentionally. Does NOT touch `_version`,
   * `_lastUpdatedDateTime`, or `_lastUpdatedBy`.
   *
   * Runs inside the active transaction session if one is present in `options`.
   */
  protected async removeChildReference(
    parentId: string,
    childUri: string,
    options?: Options,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collection = (this.dataSource.connector as any)?.collection(
      this.entityClass.modelName,
    );
    await collection.updateOne(
      { _id: parentId },
      {
        $pull: { _children: childUri },
        $inc: { _childrenCount: -1 },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { session: (options as any)?.session },
    );
  }

  /**
   * Atomically removes a parent URI from a child record's `_parents` array
   * and decrements `_parentsCount` by 1.
   *
   * Used during deletion cleanup to remove stale parent references from
   * child records. Uses a native MongoDB `$pull` + `$inc` updateOne.
   * Does NOT touch `_version`, `_lastUpdatedDateTime`, or `_lastUpdatedBy`.
   *
   * Runs inside the active transaction session if one is present in `options`.
   */
  protected async removeParentReference(
    childId: string,
    parentUri: string,
    options?: Options,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collection = (this.dataSource.connector as any)?.collection(
      this.entityClass.modelName,
    );
    await collection.updateOne(
      { _id: childId },
      {
        $pull: { _parents: parentUri },
        $inc: { _parentsCount: -1 },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { session: (options as any)?.session },
    );
  }
}
