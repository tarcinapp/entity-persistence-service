import type {
  Count,
  DataObject,
  Entity,
  Filter,
  FilterExcludingWhere,
  Options,
  Where,
  juggler,
} from '@loopback/repository';
import * as crypto from 'crypto';
import _ from 'lodash';
import slugify from 'slugify';
import {EntityPersistenceBaseRepository} from './entity-persistence-base.repository';
import type {
  KindConfigurationReader,
  IdempotencyConfigurationReader,
  VisibilityConfigurationReader,
  ValidfromConfigurationReader,
} from '../../extensions';
import type {ResponseLimitConfigurationReader} from '../../extensions/config-helpers/response-limit-config-helper';
import type {LookupHelper} from '../../extensions/utils/lookup-helper';
import type {MongoPipelineHelper} from '../../extensions/utils/mongo-pipeline-helper';
import type {ReactionsCommonBase} from '../../models';
import {HttpErrorResponse} from '../../models';
import type {LoggingService} from '../../services/logging.service';
import type {LookupConstraintService} from '../../services/lookup-constraint.service';
import type {RecordLimitCheckerService} from '../../services/record-limit-checker.service';

/**
 * EntityPersistenceReactionRepository - Specialized Base for Reaction Entities
 *
 * This abstract base class is the "Brain" for all reaction repositories. It centralizes:
 * - CRUD operations with response limiting, lookup processing, and record type injection
 * - Lifecycle orchestration (Modify -> Validate -> Create)
 * - MongoDB pipeline aggregation for filtered reactions
 * - Idempotency management
 * - Hierarchical relationships (findParents, findChildren, createChild)
 * - Immutability enforcement for _kind and source ID fields
 *
 * ## Architecture:
 * This is Level 2 of a three-tier repository hierarchy:
 * 1. EntityPersistenceBaseRepository (Level 1) - Universal Base
 * 2. EntityPersistenceReactionRepository (Level 2) - THIS CLASS - Reaction logic
 * 3. Concrete Repositories - EntityReactionsRepository, ListReactionsRepository
 *
 * ## Template Method Pattern:
 * Concrete repositories implement abstract hooks:
 * - Configuration getters: getDefaultKind, getIdempotencyFields, getVisibilityForKind, etc.
 * - Target existence: checkTargetExistence (verify Entity/List exists)
 * - Pipeline building: getSourceCollectionName, buildPipeline
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
  // ABSTRACT IDENTITY PROPERTIES
  /**
   * The reaction type name used in error messages (e.g., 'Entity reaction', 'List reaction').
   */
  protected abstract readonly reactionTypeName: string;

  /**
   * The error code prefix for this reaction type (e.g., 'ENTITY-REACTION', 'LIST-REACTION').
   */
  protected abstract readonly errorCodePrefix: string;

  /**
   * The URI path segment for this reaction type (e.g., 'entity-reactions', 'list-reactions').
   */
  protected abstract readonly uriPathSegment: string;

  /**
   * The field name for the source reference (e.g., '_entityId', '_listId').
   * Used for immutability checks on updates.
   */
  protected abstract readonly sourceIdFieldName: string;

  // ABSTRACT DEPENDENCY PROPERTIES
  protected abstract readonly kindConfigReader: KindConfigurationReader;
  protected abstract readonly visibilityConfigReader: VisibilityConfigurationReader;
  protected abstract readonly validfromConfigReader: ValidfromConfigurationReader;
  protected abstract readonly idempotencyConfigReader: IdempotencyConfigurationReader;
  protected abstract readonly responseLimitConfigReader: ResponseLimitConfigurationReader;
  protected abstract readonly lookupHelper: LookupHelper;
  protected abstract readonly loggingService: LoggingService;
  protected abstract readonly recordLimitChecker: RecordLimitCheckerService;
  protected abstract readonly lookupConstraintService: LookupConstraintService;
  protected abstract readonly mongoPipelineHelper: MongoPipelineHelper;

  // ABSTRACT HOOK METHODS - Configuration
  /**
   * Gets the default kind for reactions when none is provided.
   */
  protected abstract getDefaultKind(): string;

  /**
   * Gets the idempotency fields for a given kind.
   */
  protected abstract getIdempotencyFields(kind?: string): string[];

  /**
   * Gets the default visibility for a given kind.
   */
  protected abstract getVisibilityForKind(kind?: string): string;

  /**
   * Gets whether validFrom should be auto-set for a given kind.
   */
  protected abstract getValidFromForKind(kind?: string): boolean;

  /**
   * Gets the response limit for this reaction type.
   */
  protected abstract getResponseLimit(): number;

  /**
   * Checks if a kind value is acceptable.
   */
  protected abstract isKindAcceptable(kind: string): boolean;

  /**
   * Gets all allowed kind values.
   */
  protected abstract getAllowedKinds(): string[];

  // ABSTRACT HOOK METHODS - Target Existence
  /**
   * Checks if the target entity/list exists.
   * Implementations should use their specific repository getter to verify existence.
   */
  protected abstract checkTargetExistence(
    data: DataObject<E>,
    options?: Options,
  ): Promise<void>;

  // ABSTRACT HOOK METHODS - MongoDB Pipeline
  /**
   * Gets the source collection name for MongoDB pipeline lookups.
   * (e.g., 'entities', 'lists')
   */
  protected abstract getSourceCollectionName(): string;

  /**
   * Gets the reactions collection name for this reaction type.
   */
  protected abstract getReactionsCollectionName(): string;

  constructor(
    entityClass: typeof Entity & {prototype: E},
    dataSource: juggler.DataSource,
  ) {
    super(entityClass, dataSource);
  }

  // ============================================================================
  // CRUD OPERATIONS - FIND
  // ============================================================================

  /**
   * Find reactions with optional MongoDB pipeline aggregation.
   * Uses pipeline when filtering by source entity/list properties.
   *
   * @param filter - Filter for reaction properties
   * @param sourceFilter - Filter for source entity/list properties (triggers pipeline mode)
   * @param options - Options including useMongoPipeline flag
   */
  async find(
    filter?: Filter<E>,
    sourceFilter?: Filter<E>,
    options?: Options & {useMongoPipeline?: boolean},
  ): Promise<(E & Relations)[]> {
    const limit = filter?.limit ?? this.getResponseLimit();

    filter = {
      ...filter,
      limit: Math.min(limit, this.getResponseLimit()),
    };

    // Ensure _kind is always included
    filter = this.forceKindInclusion(filter);

    this.loggingService.info(
      `${this.reactionTypeName}Repository.find - Modified filter:`,
      {
        filter,
        sourceFilter,
        useMongoPipeline: options?.useMongoPipeline,
      },
    );

    // If useMongoPipeline is not explicitly set to true, use standard repository approach
    if (options?.useMongoPipeline !== true) {
      const reactions = await super.find(filter, options);
      const reactionsWithLookup = await this.processLookups(
        reactions,
        filter,
        options,
      );

      return this.injectRecordTypeArray(reactionsWithLookup) as (E &
        Relations)[];
    }

    // MongoDB pipeline approach
    const sourceCollectionName = this.getSourceCollectionName();

    const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
      sourceCollectionName,
      filter?.limit ?? this.getResponseLimit(),
      filter,
      sourceFilter,
    );

    const collection = this.dataSource.connector?.collection(
      this.entityClass.modelName ?? this.reactionTypeName,
    );

    if (!collection) {
      throw new Error('Collection not found');
    }

    const cursor = collection.aggregate(pipeline, options);
    const result = await cursor.toArray();

    const reactionsWithLookup = await this.processLookups(
      result as E[],
      filter,
      options,
    );

    return this.injectRecordTypeArray(reactionsWithLookup) as (E & Relations)[];
  }

  /**
   * Find a reaction by ID with optional source filter.
   */
  async findById(
    id: IdType,
    filter?: FilterExcludingWhere<E>,
    options?: Options,
  ): Promise<E & Relations> {
    try {
      const sourceCollectionName = this.getSourceCollectionName();

      const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
        sourceCollectionName,
        1,
        {
          ...filter,
          where: {_id: id},
        } as Filter<E>,
      );

      const collection = this.dataSource.connector?.collection(
        this.entityClass.modelName ?? this.reactionTypeName,
      );

      if (!collection) {
        throw new Error('Collection not found');
      }

      const cursor = collection.aggregate(pipeline, options);
      const result = await cursor.toArray();

      if (result.length === 0) {
        this.loggingService.warn(
          `${this.reactionTypeName} with id '${id}' not found.`,
        );
        throw this.createNotFoundError(id as string);
      }

      const reactionWithLookup = await this.processLookup(
        result[0] as E,
        filter,
        options,
      );

      return this.injectRecordType(reactionWithLookup) as E & Relations;
    } catch (error) {
      if (error.code === `${this.errorCodePrefix}-NOT-FOUND`) {
        throw error;
      }

      this.loggingService.error(
        `${this.reactionTypeName}Repository.findById - Unexpected Error:`,
        {
          error,
          id,
        },
      );

      throw error;
    }
  }

  /**
   * Count reactions with optional source filter using MongoDB pipeline.
   */
  async count(where?: Where<E>, sourceWhere?: Where<E>, options?: Options): Promise<Count> {
    try {
      const filter = where ? {where} : undefined;
      const sourceFilter = sourceWhere ? {where: sourceWhere} : undefined;

      const sourceCollectionName = this.getSourceCollectionName();

      const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
        sourceCollectionName,
        0, // No limit for counting
        filter as Filter<E>,
        sourceFilter as Filter<E>,
      );

      pipeline.push({$count: 'count'});

      const collection = this.dataSource.connector?.collection(
        this.entityClass.modelName ?? this.reactionTypeName,
      );

      if (!collection) {
        throw new Error('Collection not found');
      }

      const cursor = collection.aggregate(pipeline, options);
      const result = await cursor.toArray();

      return {count: result.length > 0 ? result[0].count : 0};
    } catch (error) {
      this.loggingService.error(
        `${this.reactionTypeName}Repository.count - Error:`,
        {error},
      );
      throw error;
    }
  }

  // ============================================================================
  // CRUD OPERATIONS - CREATE
  // ============================================================================

  /**
   * Create a new reaction with idempotency support.
   */
  async create(data: DataObject<E>, options?: Options): Promise<E> {
    const idempotencyKey = this.calculateIdempotencyKey(data);
    const foundIdempotent = await this.findIdempotentReaction(idempotencyKey, options);

    if (foundIdempotent) {
      this.loggingService.info(
        `${this.reactionTypeName}Repository.create - Idempotent reaction found. Skipping creation.`,
        {idempotencyKey, existingReaction: foundIdempotent},
      );

      return this.injectRecordType(foundIdempotent);
    }

    if (idempotencyKey) {
      data._idempotencyKey = idempotencyKey;
    }

    return this.createRecordFacade(data, options);
  }

  /**
   * Lifecycle facade: Modify -> Validate -> Create
   */
  protected async createRecordFacade(
    data: DataObject<E>,
    options?: Options,
  ): Promise<E> {
    const modifiedData = await this.modifyDataForCreation(data);
    const validatedData = await this.validateDataForCreation(
      modifiedData,
      options,
    );
    const created = await super.create(validatedData, options);

    return this.injectRecordType(created);
  }

  /**
   * Modify data before creation: set defaults, timestamps, version, counts.
   */
  protected async modifyDataForCreation(
    data: DataObject<E>,
  ): Promise<DataObject<E>> {
    // Strip virtual fields before persisting
    data = this.sanitizeRecordType(data);

    // Set default kind if not provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any)._kind = (data as any)._kind ?? this.getDefaultKind();

    const now = new Date().toISOString();

    // Set timestamps
    data._createdDateTime = data._createdDateTime ?? now;
    data._lastUpdatedDateTime = data._lastUpdatedDateTime ?? now;

    // Set validFromDateTime based on kind configuration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shouldAutoApprove = this.getValidFromForKind((data as any)._kind);
    data._validFromDateTime =
      data._validFromDateTime ?? (shouldAutoApprove ? now : undefined);

    // Explicitly set validUntilDateTime to null for filter matcher
    data._validUntilDateTime = data._validUntilDateTime ?? null;

    // New record starts at version 1
    data._version = 1;

    // Set default visibility based on kind configuration

    data._visibility =
      data._visibility ?? this.getVisibilityForKind((data as any)._kind);

    // Generate slug and count fields
    this.generateSlug(data);
    this.setCountFields(data);

    return data;
  }

  /**
   * Validate data before creation: kind format, kind values, target existence, limits.
   */
  protected async validateDataForCreation(
    data: DataObject<E>,
    options?: Options,
  ): Promise<DataObject<E>> {
    this.checkDataKindFormat(data);
    this.checkDataKindValues(data);

    await Promise.all([
      this.checkTargetExistence(data, options),
      this.recordLimitChecker.checkUniqueness(
        this.entityClass as any,
        data,
        this as any,
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
        this.entityClass as any,
        options,
      ),
    ]);

    return data;
  }

  // ============================================================================
  // CRUD OPERATIONS - UPDATE
  // ============================================================================

  /**
   * Update a reaction by ID with validation.
   */
  async updateById(
    id: IdType,
    data: DataObject<E>,
    options?: Options,
  ): Promise<void> {
    const {data: modifiedData, existingData} = await this.modifyDataForUpdate(
      id as string,
      data,
      options,
    );

    // Merge incoming data with existing reaction data
    const mergedData = _.defaults({}, modifiedData, existingData);

    // Calculate and set idempotencyKey based on merged data
    const idempotencyKey = this.calculateIdempotencyKey(mergedData);
    if (idempotencyKey) {
      modifiedData._idempotencyKey = idempotencyKey;
    }

    const validatedData = await this.validateDataForUpdate(
      id as string,
      existingData,
      modifiedData,
      options,
    );

    return super.updateById(id as IdType, validatedData, options);
  }

  /**
   * Replace a reaction by ID with validation.
   */
  async replaceById(
    id: IdType,
    data: DataObject<E>,
    options?: Options,
  ): Promise<void> {
    const {data: modifiedData, existingData} = await this.modifyDataForUpdate(
      id as string,
      data,
    );

    // Calculate and set idempotencyKey
    const idempotencyKey = this.calculateIdempotencyKey(modifiedData);
    if (idempotencyKey) {
      modifiedData._idempotencyKey = idempotencyKey;
    }

    const validatedData = await this.validateDataForReplace(
      id as string,
      existingData,
      modifiedData,
      options,
    );

    return super.replaceById(id as IdType, validatedData, options);
  }

  /**
  * Update all matching reactions.
  * Handles polymorphic parameter shifting from LoopBack's internal updateById calls.
  */
  async updateAll(
    data: DataObject<E>,
    where?: Where<E>,
    sourceWhereOrOptions?: Where<E> | Options,
    options?: Options,
  ): Promise<Count> {
    let actualSourceWhere: Where<E> | undefined;
    let actualOptions: Options | undefined;

    /**
     * Determine if the 3rd parameter is 'sourceWhere' or 'options'.
     * LoopBack's internal updateById calls: updateAll(data, {id: id}, options)
     */
    if (
      sourceWhereOrOptions &&
      (typeof (sourceWhereOrOptions as any).session === 'object' ||
        (sourceWhereOrOptions as any).transaction)
    ) {
      // 3rd parameter is actually 'options' passed by internal LB4 calls
      actualOptions = sourceWhereOrOptions as Options;
      actualSourceWhere = undefined;
    } else {
      // Standard call with 4 parameters or no options in 3rd position
      actualSourceWhere = sourceWhereOrOptions as Where<E>;
      actualOptions = options;
    }

    // Clean virtual fields
    data = this.sanitizeRecordType(data);

    // Enforce immutability constraints
    if ((data as any)._kind !== undefined) {
      throw this.createImmutableKindError();
    }

    if ((data as any)[this.sourceIdFieldName] !== undefined) {
      throw this.createImmutableSourceIdError(this.sourceIdFieldName);
    }

    // Update timestamps and metadata
    const now = new Date().toISOString();
    data._lastUpdatedDateTime = now;
    this.generateSlug(data);
    this.setCountFields(data);

    this.loggingService.info(
      `${this.reactionTypeName}Repository.updateAll - Executing with aligned parameters:`,
      {
        where,
        sourceWhere: actualSourceWhere,
        hasSession: !!actualOptions?.session,
      },
    );

    // Build the pipeline using the correctly identified source filter
    const filter = where ? {where} : undefined;
    const sourceFilter = actualSourceWhere ? {where: actualSourceWhere} : undefined;
    const sourceCollectionName = this.getSourceCollectionName();

    const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
      sourceCollectionName,
      0,
      filter as Filter<E>,
      sourceFilter as Filter<E>,
    );

    pipeline.push({$project: {_id: 1}});

    const collection = this.dataSource.connector?.collection(
      this.entityClass.modelName ?? this.reactionTypeName,
    );

    if (!collection) {
      throw new Error('Collection not found');
    }

    /**
     * Execute aggregation within the transaction session.
     * Passing {session: actualOptions.session} explicitly for native driver compatibility.
     */
    const cursor = collection.aggregate(pipeline, {
      session: actualOptions?.session,
      ...actualOptions
    });

    const documentsToUpdate = await cursor.toArray();

    if (documentsToUpdate.length === 0) {
      return {count: 0};
    }

    /**
     * Perform bulk update using the correctly aligned options.
     * This ensures the write operation is part of the same transaction.
     */
    const updateResult = await collection.updateMany(
      {
        _id: {$in: documentsToUpdate.map((doc: {_id: string}) => doc._id)},
      },
      {$set: data},
      {
        session: actualOptions?.session,
        ...actualOptions
      },
    );

    return {count: updateResult.modifiedCount};
  }

  /**
   * Modify data before update: strip virtual fields, set version, timestamps.
   */
  protected async modifyDataForUpdate(
    id: string,
    data: DataObject<E>,
    options?: Options,
  ): Promise<{data: DataObject<E>; existingData: E}> {
    data = this.sanitizeRecordType(data);

    const existingData = await this.findByIdRaw(id, undefined, options);
    if (!existingData) {
      throw this.createNotFoundError(id);
    }

    const now = new Date().toISOString();

    // Increment version
    data._version = (existingData._version ?? 1) + 1;

    // Set lastUpdatedDateTime
    data._lastUpdatedDateTime = data._lastUpdatedDateTime ?? now;

    this.generateSlug(data);
    this.setCountFields(data);

    return {data, existingData};
  }

  /**
   * Validate data before update: check immutability, uniqueness, limits.
   */
  protected async validateDataForUpdate(
    id: string,
    existingData: E,
    data: DataObject<E>,
    options?: Options,
  ): Promise<DataObject<E>> {
    // Check if trying to change _kind (immutable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingKind = (existingData as any)._kind;

    if (
      (data as any)._kind !== undefined &&
      (data as any)._kind !== existingKind
    ) {
      throw this.createImmutableKindError(existingKind);
    }

    // Check if trying to change sourceId (immutable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingSourceId = (existingData as any)[this.sourceIdFieldName];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newSourceId = (data as any)[this.sourceIdFieldName];
    if (newSourceId !== undefined && newSourceId !== existingSourceId) {
      throw this.createImmutableSourceIdError(
        this.sourceIdFieldName,
        existingSourceId,
      );
    }

    // Merge for validation checks
    const mergedData = _.assign(
      {},
      existingData && _.pickBy(existingData, (value) => value !== null),
      data,
    );

    await Promise.all([
      this.recordLimitChecker.checkUniqueness(
        this.entityClass as any,
        mergedData,
        this as any,
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
        this.entityClass as any,
        options,
      ),
    ]);

    return data;
  }

  /**
   * Validate data before replace: same as update validation.
   */
  protected async validateDataForReplace(
    id: string,
    existingData: E,
    data: DataObject<E>,
    options?: Options,
  ): Promise<DataObject<E>> {
    return this.validateDataForUpdate(id, existingData, data, options);
  }

  // ============================================================================
  // CRUD OPERATIONS - DELETE
  // ============================================================================

  /**
   * Delete a reaction by ID.
   */
  async deleteById(id: IdType, options?: Options): Promise<void> {
    // Verify existence first
    await this.findById(id, undefined, options);

    return super.deleteById(id, options);
  }

  /**
   * Delete all matching reactions.
   */
  async deleteAll(where?: Where<E>, options?: Options): Promise<Count> {
    this.loggingService.info(
      `${this.reactionTypeName}Repository.deleteAll - Where condition:`,
      {
        where,
      },
    );

    return super.deleteAll(where, options);
  }

  // ============================================================================
  // HIERARCHICAL RELATIONSHIPS
  // ============================================================================

  /**
   * Find parent reactions of a given reaction.
   */
  async findParents(
    reactionId: string,
    filter?: Filter<E>,
    sourceFilter?: Filter<E>,
    options?: Options,
  ): Promise<(E & Relations)[]> {
    const reaction = await this.findById(
      reactionId as IdType,
      {
        fields: {_parents: true},
      } as FilterExcludingWhere<E>,
    );

    if (!reaction._parents || reaction._parents.length === 0) {
      return [];
    }

    // Extract parent IDs from URIs
    const parentIds = reaction._parents.map((uri: string) =>
      uri.split('/').pop(),
    );

    const parentFilter: Filter<E> = {
      ...filter,
      where: {
        and: [
          {_id: {inq: parentIds}},
          ...(filter?.where ? [filter.where] : []),
        ],
      } as Where<E>,
    };

    this.loggingService.info(
      `${this.reactionTypeName}Repository.findParents - Parent filter:`,
      {
        parentFilter,
      },
    );

    return this.find(parentFilter, sourceFilter, {
      useMongoPipeline: false,
      ...options,
    });
  }

  /**
   * Find child reactions of a given reaction.
   */
  async findChildren(
    reactionId: string,
    filter?: Filter<E>,
    sourceFilter?: Filter<E>,
    options?: Options,
  ): Promise<(E & Relations)[]> {
    // Verify reaction exists
    await this.findById(
      reactionId as IdType,
      {fields: {_id: true}} as FilterExcludingWhere<E>,
      options,
    );

    const uri = this.buildParentUri(reactionId);

    const childFilter: Filter<E> = {
      ...filter,
      where: {
        and: [{_parents: uri}, ...(filter?.where ? [filter.where] : [])],
      } as Where<E>,
    };

    this.loggingService.info(
      `${this.reactionTypeName}Repository.findChildren - Child filter:`,
      {
        childFilter,
      },
    );

    return this.find(childFilter, sourceFilter, {
      useMongoPipeline: false,
      ...options,
    });
  }

  /**
   * Create a child reaction under a parent.
   */
  async createChild(
    parentId: string,
    reaction: DataObject<E>,
    options?: Options,
  ): Promise<E> {
    try {
      // Verify parent exists and get source ID
      const parent = await this.findByIdRaw(
        parentId,
        {
          fields: {[this.sourceIdFieldName]: true},
        } as FilterExcludingWhere<E>,
        options,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parentSourceId = (parent as any)[this.sourceIdFieldName];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const childSourceId = (reaction as any)[this.sourceIdFieldName];

      if (parentSourceId !== childSourceId) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'SourceRecordNotMatchError',
          message: `Source record ${this.sourceIdFieldName} does not match parent. Parent ${this.sourceIdFieldName}: '${parentSourceId}', child ${this.sourceIdFieldName}: '${childSourceId}'.`,
          code: 'SOURCE-RECORD-NOT-MATCH',
        });
      }

      // Add parent reference
      const childReaction = {
        ...reaction,
        _parents: [this.buildParentUri(parentId)],
      } as DataObject<E>;

      return this.create(childReaction, options);
    } catch (error) {
      this.loggingService.error(
        `${this.reactionTypeName}Repository.createChild - Error:`,
        {
          error,
          parentId,
        },
      );
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Find by ID without record type injection (internal use).
   */
  protected async findByIdRaw(
    id: string,
    filter?: FilterExcludingWhere<E>,
    options?: Options,
  ): Promise<E> {
    try {
      return await super.findById(id as IdType, filter, options);
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

  /**
   * Generate slug from _name field.
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

  /**
   * Update count fields from arrays.
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

  /**
   * Ensure _kind is always included in filter fields.
   */
  protected forceKindInclusion(
    filter: Filter<E> | undefined,
  ): Filter<E> | undefined {
    if (!filter?.fields) {
      return filter;
    }

    if (Array.isArray(filter.fields)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!filter.fields.includes('_kind' as any)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {...filter, fields: [...filter.fields, '_kind' as any]};
      }

      return filter;
    }

    const fieldEntries = Object.entries(filter.fields);
    const hasInclusionMode = fieldEntries.some(([_, value]) => value === true);

    if (hasInclusionMode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {...filter, fields: {...filter.fields, _kind: true} as any};
    }

    const updatedFields = {...filter.fields} as Record<string, boolean>;
    if (updatedFields._kind === false) {
      delete updatedFields._kind;
    }

    return {...filter, fields: updatedFields as typeof filter.fields};
  }

  /**
   * Process lookups for an array of records.
   */
  protected async processLookups(
    records: E[],
    filter?: Filter<E>,
    options?: Options,
  ): Promise<E[]> {
    if (!filter?.lookup) {
      return records;
    }

    return this.lookupHelper.processLookupForArray(
      records as any,
      filter as any,
      options,
    ) as unknown as Promise<E[]>;
  }

  /**
   * Process lookup for a single record.
   */
  protected async processLookup(
    record: E,
    filter?: Filter<E> | FilterExcludingWhere<E>,
    options?: Options,
  ): Promise<E> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(filter as any)?.lookup) {
      return record;
    }

    return this.lookupHelper.processLookupForOne(
      record as any,
      filter as any,
      options,
    ) as unknown as Promise<E>;
  }

  // ============================================================================
  // IDEMPOTENCY MANAGEMENT
  // ============================================================================

  /**
   * Find an existing reaction with the same idempotency key.
   */
  protected async findIdempotentReaction(
    idempotencyKey: string | undefined,
    options?: Options,
  ): Promise<E | null> {
    if (_.isString(idempotencyKey) && !_.isEmpty(idempotencyKey)) {
      return this.findOne({
        where: {
          and: [{_idempotencyKey: idempotencyKey}],
        } as Where<E>,
      }, options);
    }

    return null;
  }

  /**
   * Calculate idempotency key from configured fields.
   */
  protected calculateIdempotencyKey(data: DataObject<E>): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idempotencyFields = this.getIdempotencyFields((data as any)._kind);

    if (idempotencyFields.length === 0) {
      return undefined;
    }

    const fieldValues = idempotencyFields.map((field) => {
      const value = _.get(data, field);
      if (Array.isArray(value)) {
        return JSON.stringify([...value].sort());
      }

      return typeof value === 'object' ? JSON.stringify(value) : value;
    });

    const keyString = fieldValues.join(',');

    return crypto.createHash('sha256').update(keyString).digest('hex');
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  /**
   * Check kind format (no special or uppercase characters).
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
   * Check kind value is in allowed values.
   */
  protected checkDataKindValues(data: DataObject<E>): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kind = (data as any)._kind;
    if (kind && !this.isKindAcceptable(kind)) {
      throw this.createInvalidKindValueError(kind, this.getAllowedKinds());
    }
  }

  // ============================================================================
  // ERROR HELPERS
  // ============================================================================

  protected createNotFoundError(id: string): HttpErrorResponse {
    return new HttpErrorResponse({
      statusCode: 404,
      name: 'NotFoundError',
      message: `${this.reactionTypeName} with id '${id}' could not be found.`,
      code: `${this.errorCodePrefix}-NOT-FOUND`,
    });
  }

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
      code: `IMMUTABLE-${fieldName.toUpperCase().replace('_', '').replace('ID', '-ID')}`,
    });
  }

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
   * Build URI for parent reference.
   */
  protected buildParentUri(parentId: string): string {
    return `tapp://localhost/${this.uriPathSegment}/${parentId}`;
  }
}
