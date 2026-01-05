import { inject, Getter } from '@loopback/core';
import {
  Filter,
  Options,
  FilterExcludingWhere,
  Where,
  Count,
  DataObject,
  repository,
} from '@loopback/repository';
import { EntityPersistenceBaseRepository } from './entity-persistence-base.repository';
import * as crypto from 'crypto';
import _ from 'lodash';
import slugify from 'slugify';
import { EntityDbDataSource } from '../datasources';
import {
  KindConfigurationReader,
  ValidfromConfigurationReader,
  VisibilityConfigurationReader,
  IdempotencyConfigurationReader,
  ResponseLimitConfigurationReader,
} from '../extensions';
import { EntityRepository } from './entity.repository';
import { CollectionConfigHelper } from '../extensions/config-helpers/collection-config-helper';
import {
  LookupHelper,
  LookupBindings,
} from '../extensions/utils/lookup-helper';
import {
  MongoPipelineHelper,
  MongoPipelineHelperBindings,
} from '../extensions/utils/mongo-pipeline-helper';
import { EntityReaction, HttpErrorResponse } from '../models';
import { LoggingService } from '../services/logging.service';
import { LookupConstraintBindings } from '../services/lookup-constraint.bindings';
import { LookupConstraintService } from '../services/lookup-constraint.service';
import { RecordLimitCheckerService } from '../services/record-limit-checker.service';

export class EntityReactionsRepository extends EntityPersistenceBaseRepository<
  EntityReaction,
  typeof EntityReaction.prototype.id
> {
  protected readonly recordTypeName = 'entityReaction';
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @inject('extensions.kind.configurationreader')
    private kindConfigReader: KindConfigurationReader,
    @inject('extensions.visibility.configurationreader')
    private visibilityConfigReader: VisibilityConfigurationReader,
    @inject('extensions.validfrom.configurationreader')
    private validfromConfigReader: ValidfromConfigurationReader,
    @inject('extensions.idempotency.configurationreader')
    private idempotencyConfigReader: IdempotencyConfigurationReader,
    @inject('extensions.response-limit.configurationreader')
    private responseLimitConfigReader: ResponseLimitConfigurationReader,
    @inject(LookupBindings.HELPER)
    private lookupHelper: LookupHelper,
    @inject('services.LoggingService')
    private loggingService: LoggingService,
    @inject('services.record-limit-checker')
    private recordLimitChecker: RecordLimitCheckerService,
    @inject(LookupConstraintBindings.SERVICE)
    private lookupConstraintService: LookupConstraintService,
    @repository.getter('EntityRepository')
    protected entityRepositoryGetter: Getter<EntityRepository>,
    @inject(MongoPipelineHelperBindings.HELPER)
    private mongoPipelineHelper: MongoPipelineHelper,
  ) {
    super(EntityReaction, dataSource);
  }

  private forceKindInclusion(
    filter: Filter<EntityReaction> | undefined,
  ): Filter<EntityReaction> | undefined {
    if (!filter) {
      return filter;
    }

    if (!filter.fields) {
      return filter;
    }

    // If fields is an array, ensure _kind is included
    if (Array.isArray(filter.fields)) {
      if (!filter.fields.includes('_kind' as any)) {
        return {
          ...filter,
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
        } as any,
      };
    }

    // Exclusion mode: remove _kind if it's set to false
    const updatedFields = { ...filter.fields };
    if ((updatedFields as any)._kind === false) {
      delete (updatedFields as any)._kind;
    }

    return {
      ...filter,
      fields: updatedFields,
    };
  }

  private async processLookups(
    reactions: EntityReaction[],
    filter?: Filter<EntityReaction>,
    options?: Options,
  ): Promise<EntityReaction[]> {
    if (!filter?.lookup) {
      return reactions;
    }

    return this.lookupHelper.processLookupForArray(reactions, filter, options);
  }

  private async processLookup(
    reaction: EntityReaction,
    filter?: Filter<EntityReaction>,
    options?: Options,
  ): Promise<EntityReaction> {
    if (!filter?.lookup) {
      return reaction;
    }

    return this.lookupHelper.processLookupForOne(reaction, filter, options);
  }

  async find(
    filter?: Filter<EntityReaction>,
    entityFilter?: Filter<EntityReaction>,
    options?: Options & { useMongoPipeline?: boolean },
  ): Promise<EntityReaction[]> {
    const limit =
      filter?.limit ??
      this.responseLimitConfigReader.getEntityReactionResponseLimit();

    filter = {
      ...filter,
      limit: Math.min(
        limit,
        this.responseLimitConfigReader.getEntityReactionResponseLimit(),
      ),
    };

    // Ensure _kind is always included
    filter = this.forceKindInclusion(filter);

    this.loggingService.info(
      'EntityReactionsRepository.find - Modified filter:',
      {
        filter,
        entityFilter,
        useMongoPipeline: options?.useMongoPipeline,
      },
    );

    // If useMongoPipeline is not explicitly set to true, use repository approach
    if (options?.useMongoPipeline !== true) {
      const reactions = await super.find(filter, options);
      const reactionsWithLookup = await this.processLookups(reactions, filter, options);

      return this.injectRecordTypeArray(reactionsWithLookup);
    }

    // MongoDB pipeline approach
    // Get collection names from configuration
    const entityCollectionName =
      CollectionConfigHelper.getInstance().getEntityCollectionName();
    const reactionCollectionName =
      CollectionConfigHelper.getInstance().getEntityReactionsCollectionName();

    // Build pipeline using helper
    const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
      entityCollectionName,
      filter?.limit ??
        this.responseLimitConfigReader.getEntityReactionResponseLimit(),
      filter,
      entityFilter,
    );

    // Execute pipeline
    const collection = this.dataSource.connector?.collection(
      EntityReaction.modelName || 'EntityReaction',
    );

    if (!collection) {
      throw new Error('Collection not found');
    }

    const cursor = collection.aggregate(pipeline);
    const result = await cursor.toArray();

    // Process lookups if needed
    const reactionsWithLookup = await this.processLookups(
      result as EntityReaction[],
      filter,
      options,
    );

    return this.injectRecordTypeArray(reactionsWithLookup);
  }

  async create(data: DataObject<EntityReaction>, options?: Options) {
    const idempotencyKey = this.calculateIdempotencyKey(data);
    const foundIdempotent = await this.findIdempotentReaction(idempotencyKey);

    if (foundIdempotent) {
      this.loggingService.info(
        'EntityReactionsRepository.create - Idempotent reaction found. Skipping creation.',
        {
          idempotencyKey,
          existingReaction: foundIdempotent,
        },
      );

      return this.injectRecordType(foundIdempotent);
    }

    if (idempotencyKey) {
      data._idempotencyKey = idempotencyKey;
    }

    return this.createNewReactionFacade(data, options);
  }

  private async findIdempotentReaction(
    idempotencyKey: string | undefined,
  ): Promise<EntityReaction | null> {
    if (_.isString(idempotencyKey) && !_.isEmpty(idempotencyKey)) {
      const sameRecord = this.findOne({
        where: {
          and: [
            {
              _idempotencyKey: idempotencyKey,
            },
          ],
        },
      });

      return sameRecord;
    }

    return Promise.resolve(null);
  }

  calculateIdempotencyKey(data: DataObject<EntityReaction>) {
    const idempotencyFields =
      this.idempotencyConfigReader.getIdempotencyForEntityReactions(data._kind);

    if (idempotencyFields.length === 0) {
      return;
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

  private async createNewReactionFacade(
    data: DataObject<EntityReaction>,
    options?: Options,
  ): Promise<EntityReaction> {
    return this.modifyIncomingReactionForCreation(data)
      .then((enrichedData) =>
        this.validateIncomingReactionForCreation(enrichedData, options),
      )
      .then((validEnrichedData) =>
        super
          .create(validEnrichedData, options)
          .then((created) => this.injectRecordType(created)),
      );
  }

  private async checkEntityExistence(
    data: DataObject<EntityReaction>,
  ): Promise<void> {
    if (data._entityId) {
      try {
        const entityRepository = await this.entityRepositoryGetter();
        await entityRepository.findById(data._entityId);
      } catch (error) {
        if (error.code === 'ENTITY_NOT_FOUND') {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: 'NotFoundError',
            message: `Entity with id '${data._entityId}' could not be found.`,
            code: 'ENTITY-NOT-FOUND',
          });
        }

        throw error;
      }
    }
  }

  private async validateIncomingReactionForCreation(
    data: DataObject<EntityReaction>,
    options?: Options,
  ): Promise<DataObject<EntityReaction>> {
    this.checkDataKindFormat(data);
    this.checkDataKindValues(data);

    return Promise.all([
      this.checkEntityExistence(data),
      this.checkUniquenessForCreate(data, options),
      this.recordLimitChecker.checkLimits(EntityReaction, data, this, options),
      this.lookupConstraintService.validateLookupConstraints(
        data as EntityReaction,
        EntityReaction,
        options,
      ),
    ]).then(() => {
      return data;
    });
  }

  private async modifyIncomingReactionForCreation(
    data: DataObject<EntityReaction>,
  ): Promise<DataObject<EntityReaction>> {
    // Strip virtual fields before persisting
    data = this.sanitizeRecordType(data);

    data._kind = data._kind ?? this.kindConfigReader.defaultEntityReactionKind;

    const now = new Date().toISOString();

    data._createdDateTime = data._createdDateTime ? data._createdDateTime : now;
    data._lastUpdatedDateTime = data._lastUpdatedDateTime
      ? data._lastUpdatedDateTime
      : now;

    const shouldAutoApprove =
      this.validfromConfigReader.getValidFromForEntityReactions(data._kind);
    data._validFromDateTime =
      data._validFromDateTime ?? (shouldAutoApprove ? now : undefined);

    data._validUntilDateTime = data._validUntilDateTime ?? null;

    data._version = 1;

    data._visibility = data._visibility
      ? data._visibility
      : this.visibilityConfigReader.getVisibilityForEntityReactions(data._kind);

    this.generateSlug(data);
    this.setCountFields(data);

    _.unset(data, '_fromMeta');

    return data;
  }

  private async checkUniquenessForCreate(
    newData: DataObject<EntityReaction>,
    options?: Options,
  ) {
    await this.recordLimitChecker.checkUniqueness(
      EntityReaction,
      newData,
      this,
      options,
    );
  }

  private checkDataKindFormat(data: DataObject<EntityReaction>) {
    if (data._kind) {
      const slugKind = this.kindConfigReader.validateKindFormat(data._kind);
      if (slugKind) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'InvalidKindError',
          message: `Entity reaction kind cannot contain special or uppercase characters. Use '${slugKind}' instead.`,
          code: 'INVALID-ENTITY-REACTION-KIND',
        });
      }
    }
  }

  private checkDataKindValues(data: DataObject<EntityReaction>) {
    if (
      data._kind &&
      !this.kindConfigReader.isKindAcceptableForEntityReactions(data._kind)
    ) {
      const validValues = this.kindConfigReader.allowedKindsForEntityReactions;
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'InvalidKindError',
        message: `Entity reaction kind '${data._kind}' is not valid. Use any of these values instead: ${validValues.join(', ')}`,
        code: 'INVALID-ENTITY-REACTION-KIND',
      });
    }
  }

  private generateSlug(data: DataObject<EntityReaction>) {
    if (data._name && !data._slug) {
      data._slug = slugify(data._name ?? '', { lower: true, strict: true });
    }
  }

  private setCountFields(data: DataObject<EntityReaction>) {
    // Only update count fields if the related array is present in the data object
    if (_.isArray(data._ownerUsers)) {
      data._ownerUsersCount = data._ownerUsers.length;
    }

    if (_.isArray(data._ownerGroups)) {
      data._ownerGroupsCount = data._ownerGroups.length;
    }

    if (_.isArray(data._viewerUsers)) {
      data._viewerUsersCount = data._viewerUsers.length;
    }

    if (_.isArray(data._viewerGroups)) {
      data._viewerGroupsCount = data._viewerGroups.length;
    }

    if (_.isArray(data._parents)) {
      data._parentsCount = data._parents.length;
    }
  }

  private async findByIdRaw(
    id: string,
    filter?: FilterExcludingWhere<EntityReaction>,
  ): Promise<EntityReaction> {
    try {
      const reaction = await super.findById(id, filter);

      return reaction;
    } catch (error) {
      if (error.code === 'ENTITY_NOT_FOUND') {
        this.loggingService.warn(`Entity reaction with id '${id}' not found.`);
        throw new HttpErrorResponse({
          statusCode: 404,
          name: 'NotFoundError',
          message: `Entity reaction with id '${id}' could not be found.`,
          code: 'ENTITY-REACTION-NOT-FOUND',
        });
      }

      throw error;
    }
  }

  private async modifyIncomingReactionForUpdates(
    id: string,
    data: DataObject<EntityReaction>,
  ) {
    // Strip virtual fields before persisting
    data = this.sanitizeRecordType(data);

    return this.findByIdRaw(id)
      .then((existingData) => {
        // check if we have this record in db
        if (!existingData) {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: 'NotFoundError',
            message: "Entity reaction with id '" + id + "' could not be found.",
            code: 'ENTITY-REACTION-NOT-FOUND',
          });
        }

        return existingData;
      })
      .then((existingData) => {
        const now = new Date().toISOString();

        // set new version
        data._version = (existingData._version ?? 1) + 1;

        // we may use current date, if it does not exist in the given data
        data._lastUpdatedDateTime = data._lastUpdatedDateTime
          ? data._lastUpdatedDateTime
          : now;

        this.generateSlug(data);
        this.setCountFields(data);

        _.unset(data, '_fromMeta');

        return {
          data: data,
          existingData: existingData,
        };
      });
  }

  private async validateIncomingReactionForReplace(
    id: string,
    data: DataObject<EntityReaction>,
    options?: Options,
  ) {
    // Get the existing reaction to check if _kind is being changed
    const existingReaction = await this.findById(id);

    // Check if user is trying to change the _kind field
    if (data._kind !== undefined && data._kind !== existingReaction._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: `Entity reaction kind cannot be changed after creation. Current kind is '${existingReaction._kind}'.`,
        code: 'IMMUTABLE-ENTITY-REACTION-KIND',
      });
    }

    // Check if user is trying to change the _entityId field
    if (
      data._entityId !== undefined &&
      data._entityId !== existingReaction._entityId
    ) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableEntityIdError',
        message: `Entity reaction entity ID cannot be changed after creation. Current entity ID is '${existingReaction._entityId}'.`,
        code: 'IMMUTABLE-ENTITY-ID',
      });
    }

    const uniquenessCheck = this.checkUniquenessForUpdate(id, data, options);
    const limitCheck = this.recordLimitChecker.checkLimits(
      EntityReaction,
      data,
      this,
      options,
    );
    const lookupConstraintCheck =
      this.lookupConstraintService.validateLookupConstraints(
        data as EntityReaction,
        EntityReaction,
        options,
      );

    await Promise.all([uniquenessCheck, limitCheck, lookupConstraintCheck]);

    return data;
  }

  private async checkUniquenessForUpdate(
    id: string,
    newData: DataObject<EntityReaction>,
    options?: Options,
  ) {
    // we need to merge existing data with incoming data in order to check uniqueness
    const existingData = await this.findById(id);
    const mergedData = _.assign(
      {},
      existingData && _.pickBy(existingData, (value) => value !== null),
      newData,
    );
    await this.recordLimitChecker.checkUniqueness(
      EntityReaction,
      mergedData,
      this,
      options,
    );
  }

  async updateAll(
    data: DataObject<EntityReaction>,
    where?: Where<EntityReaction>,
    entityWhere?: Where<EntityReaction>,
  ): Promise<Count> {
    data = this.sanitizeRecordType(data);

    // Check if user is trying to change the _kind field, which is immutable
    if (data._kind !== undefined) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'Entity reaction kind cannot be changed after creation.',
        code: 'IMMUTABLE-ENTITY-REACTION-KIND',
      });
    }

    // Check if user is trying to change the _entityId field, which is immutable
    if (data._entityId !== undefined) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableEntityIdError',
        message: 'Entity reaction entity ID cannot be changed after creation.',
        code: 'IMMUTABLE-ENTITY-ID',
      });
    }

    const now = new Date().toISOString();
    data._lastUpdatedDateTime = now;

    // Generate slug and set count fields
    this.generateSlug(data);
    this.setCountFields(data);

    this.loggingService.info(
      'EntityReactionsRepository.updateAll - Modified data:',
      {
        data,
        where,
        entityWhere,
      },
    );

    // Convert where to filter for pipeline generation
    const filter = where ? { where } : undefined;
    const entityFilter = entityWhere ? { where: entityWhere } : undefined;

    // Get collection names from configuration
    const entityCollectionName =
      CollectionConfigHelper.getInstance().getEntityCollectionName();
    const reactionCollectionName =
      CollectionConfigHelper.getInstance().getEntityReactionsCollectionName();

    // Build pipeline to get the IDs of documents to update
    const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
      entityCollectionName,
      0, // No limit needed
      filter,
      entityFilter,
    );

    // Add projection to get only _id
    pipeline.push({
      $project: {
        _id: 1,
      },
    });

    // Execute pipeline to get IDs
    const collection = this.dataSource.connector?.collection(
      EntityReaction.modelName || 'EntityReaction',
    );

    if (!collection) {
      throw new Error('Collection not found');
    }

    const cursor = collection.aggregate(pipeline);
    const documentsToUpdate = await cursor.toArray();

    if (documentsToUpdate.length === 0) {
      return { count: 0 };
    }

    // Update the documents using updateMany
    const updateResult = await collection.updateMany(
      {
        _id: { $in: documentsToUpdate.map((doc: { _id: string }) => doc._id) },
      },
      { $set: data },
    );

    return { count: updateResult.modifiedCount };
  }

  async updateById(
    id: string,
    data: DataObject<EntityReaction>,
    options?: Options,
  ) {
    const collection = await this.modifyIncomingReactionForUpdates(id, data);

    // Merge incoming data with existing reaction data to ensure completeness
    const mergedData = _.defaults({}, collection.data, collection.existingData);

    // Calculate idempotencyKey based on the fully merged reaction
    const idempotencyKey = this.calculateIdempotencyKey(mergedData);

    // Store the idempotencyKey in the data being updated
    if (idempotencyKey) {
      collection.data._idempotencyKey = idempotencyKey;
    }

    const validEnrichedData = await this.validateIncomingDataForUpdate(
      id,
      collection.existingData,
      collection.data,
      options,
    );

    return super.updateById(id, validEnrichedData, options);
  }

  private async validateIncomingDataForUpdate(
    id: string,
    existingData: EntityReaction,
    data: DataObject<EntityReaction>,
    options?: Options,
  ) {
    // Check if user is trying to change the _kind field
    if (data._kind !== undefined && data._kind !== existingData._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: `Entity reaction kind cannot be changed after creation. Current kind is '${existingData._kind}'.`,
        code: 'IMMUTABLE-ENTITY-REACTION-KIND',
      });
    }

    // Check if user is trying to change the _entityId field
    if (
      data._entityId !== undefined &&
      data._entityId !== existingData._entityId
    ) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableEntityIdError',
        message: `Entity reaction entity ID cannot be changed after creation. Current entity ID is '${existingData._entityId}'.`,
        code: 'IMMUTABLE-ENTITY-ID',
      });
    }

    // we need to merge existing data with incoming data in order to check limits and uniquenesses
    const mergedData = _.assign(
      {},
      existingData && _.pickBy(existingData, (value) => value !== null),
      data,
    );
    const uniquenessCheck = this.checkUniquenessForUpdate(id, mergedData, options);
    const limitCheck = this.recordLimitChecker.checkLimits(
      EntityReaction,
      mergedData,
      this,
      options,
    );
    const lookupConstraintCheck =
      this.lookupConstraintService.validateLookupConstraints(
        mergedData as EntityReaction,
        EntityReaction,
        options,
      );

    this.generateSlug(data);
    this.setCountFields(data);

    await Promise.all([uniquenessCheck, limitCheck, lookupConstraintCheck]);

    return data;
  }

  async deleteById(id: string, options?: Options): Promise<void> {
    // First verify that the reaction exists
    await this.findById(id);

    // Delete the reaction
    return super.deleteById(id, options);
  }

  async deleteAll(
    where?: Where<EntityReaction>,
    options?: Options,
  ): Promise<Count> {
    this.loggingService.info(
      'EntityReactionsRepository.deleteAll - Where condition:',
      {
        where,
      },
    );

    return super.deleteAll(where, options);
  }

  async count(
    where?: Where<EntityReaction>,
    entityWhere?: Where<EntityReaction>,
  ): Promise<Count> {
    try {
      // Convert where to filter for pipeline generation
      const filter = where ? { where } : undefined;
      const entityFilter = entityWhere ? { where: entityWhere } : undefined;

      // Get collection names from configuration
      const entityCollectionName =
        CollectionConfigHelper.getInstance().getEntityCollectionName();
      const reactionCollectionName =
        CollectionConfigHelper.getInstance().getEntityReactionsCollectionName();

      // Build pipeline using helper
      const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
        entityCollectionName,
        0, // No limit needed for counting
        filter,
        entityFilter,
      );

      // Add count stage
      pipeline.push({ $count: 'count' });

      // Execute pipeline
      const collection = this.dataSource.connector?.collection(
        EntityReaction.modelName || 'EntityReaction',
      );

      if (!collection) {
        throw new Error('Collection not found');
      }

      const cursor = collection.aggregate(pipeline);
      const result = await cursor.toArray();

      return { count: result.length > 0 ? result[0].count : 0 };
    } catch (error) {
      this.loggingService.error('EntityReactionsRepository.count - Error:', {
        error,
      });
      throw error;
    }
  }

  async findById(
    id: string,
    filter?: FilterExcludingWhere<EntityReaction>,
  ): Promise<EntityReaction> {
    try {
      // Get collection names from configuration
      const entityCollectionName =
        CollectionConfigHelper.getInstance().getEntityCollectionName();

      // Build pipeline using helper
      const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
        entityCollectionName,
        1, // Limit to 1 since we're looking for a specific ID
        {
          ...filter,
          where: { _id: id },
        },
      );

      // Execute pipeline
      const collection = this.dataSource.connector?.collection(
        EntityReaction.modelName || 'EntityReaction',
      );

      if (!collection) {
        throw new Error('Collection not found');
      }

      const cursor = collection.aggregate(pipeline);
      const result = await cursor.toArray();

      if (result.length === 0) {
        this.loggingService.warn(`Entity reaction with id '${id}' not found.`);
        throw new HttpErrorResponse({
          statusCode: 404,
          name: 'NotFoundError',
          message: `Entity reaction with id '${id}' could not be found.`,
          code: 'ENTITY-REACTION-NOT-FOUND',
        });
      }

      // Process lookups if needed
      const reactionWithLookup = await this.processLookup(
        result[0] as EntityReaction,
        filter,
      );

      return this.injectRecordType(reactionWithLookup);
    } catch (error) {
      if (error.code === 'ENTITY-REACTION-NOT-FOUND') {
        throw error;
      }

      this.loggingService.error(
        'EntityReactionsRepository.findById - Unexpected Error:',
        {
          error,
          id,
        },
      );

      throw error;
    }
  }

  async findParents(
    reactionId: string,
    filter?: Filter<EntityReaction>,
    entityFilter?: Filter<EntityReaction>,
    options?: Options,
  ): Promise<EntityReaction[]> {
    // First, get the reaction's parent references
    const reaction = await this.findById(reactionId, {
      fields: { _parents: true },
    });

    if (!reaction._parents || reaction._parents.length === 0) {
      return [];
    }

    // Extract parent IDs from the URIs
    const parentIds = reaction._parents.map((uri: string) =>
      uri.split('/').pop(),
    );

    // Create a new filter that includes the parent IDs
    const parentFilter: Filter<EntityReaction> = {
      ...filter,
      where: {
        and: [
          { _id: { inq: parentIds } },
          ...(filter?.where ? [filter.where] : []),
        ],
      },
    };

    this.loggingService.info(
      'EntityReactionsRepository.findParents - Parent filter:',
      {
        parentFilter,
      },
    );

    // find already injects _recordType
    return this.find(parentFilter, entityFilter, {
      useMongoPipeline: false,
      ...options,
    });
  }

  async findChildren(
    reactionId: string,
    filter?: Filter<EntityReaction>,
    entityFilter?: Filter<EntityReaction>,
    options?: Options,
  ): Promise<EntityReaction[]> {
    // First verify that the reaction exists, throw error if not
    await this.findById(reactionId, {
      fields: { _id: true },
    });

    const uri = `tapp://localhost/entity-reactions/${reactionId}`;

    // Create a filter to find reactions where _parents contains the given reactionId
    const childFilter: Filter<EntityReaction> = {
      ...filter,
      where: {
        and: [{ _parents: uri }, ...(filter?.where ? [filter.where] : [])],
      },
    };

    this.loggingService.info(
      'EntityReactionsRepository.findChildren - Child filter:',
      {
        childFilter,
      },
    );

    // find already injects _recordType
    return this.find(childFilter, entityFilter, {
      useMongoPipeline: false,
      ...options,
    });
  }

  async createChild(
    parentId: string,
    reaction: DataObject<EntityReaction>,
  ): Promise<EntityReaction> {
    try {
      // Retrieve parent with _entityId
      const parent = await this.findByIdRaw(parentId, {
        fields: { _entityId: true },
      });

      // If parent not found, findByIdRaw will throw ENTITY-REACTION-NOT-FOUND

      // Check if _entityId matches
      if (parent._entityId !== reaction._entityId) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'SourceRecordNotMatchError',
          message: `Source record _entityId does not match parent. Parent _entityId: '${parent._entityId}', child _entityId: '${reaction._entityId}'.`,
          code: 'SOURCE-RECORD-NOT-MATCH',
        });
      }

      // Add the parent reference to the reaction
      const childReaction: EntityReaction = {
        ...reaction,
        _parents: [`tapp://localhost/entity-reactions/${parentId}`],
      } as EntityReaction;

      // Create the child reaction (create already injects _recordType)
      return await this.create(childReaction);
    } catch (error) {
      this.loggingService.error(
        'EntityReactionsRepository.createChild - Error:',
        {
          error,
          parentId,
        },
      );
      throw error;
    }
  }

  async replaceById(
    id: string,
    data: DataObject<EntityReaction>,
    options?: Options,
  ) {
    const collection = await this.modifyIncomingReactionForUpdates(id, data);

    // Calculate idempotencyKey and assign it if present
    const idempotencyKey = this.calculateIdempotencyKey(collection.data);
    if (idempotencyKey) {
      collection.data._idempotencyKey = idempotencyKey;
    }

    const validEnrichedData = await this.validateIncomingReactionForReplace(
      id,
      collection.data,
      options,
    );

    return super.replaceById(id, validEnrichedData, options);
  }

}
