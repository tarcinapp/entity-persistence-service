import { inject, Getter } from '@loopback/core';
import {
  DefaultCrudRepository,
  Filter,
  Options,
  FilterExcludingWhere,
  Where,
  Count,
  DataObject,
  repository,
} from '@loopback/repository';
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

export class EntityReactionsRepository extends DefaultCrudRepository<
  EntityReaction,
  typeof EntityReaction.prototype.id
> {
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

  private async processLookups(
    reactions: EntityReaction[],
    filter?: Filter<EntityReaction>,
  ): Promise<EntityReaction[]> {
    if (!filter?.lookup) {
      return reactions;
    }

    return this.lookupHelper.processLookupForArray(reactions, filter);
  }

  private async processLookup(
    reaction: EntityReaction,
    filter?: Filter<EntityReaction>,
  ): Promise<EntityReaction> {
    if (!filter?.lookup) {
      return reaction;
    }

    return this.lookupHelper.processLookupForOne(reaction, filter);
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
      const reactions = await super.find(filter);

      return this.processLookups(reactions, filter);
    }

    // MongoDB pipeline approach
    // Get entity repository to get collection name
    const entityRepo = await this.entityRepositoryGetter();
    const entityCollectionName =
      entityRepo.modelClass.definition.settings?.mongodb?.collection;

    if (!entityCollectionName) {
      throw new Error('Entity collection name not configured');
    }

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
      this.modelClass.definition.settings?.mongodb?.collection,
    );

    if (!collection) {
      throw new Error('Collection not found');
    }

    const cursor = collection.aggregate(pipeline);
    const result = await cursor.toArray();

    // Process lookups if needed
    return this.processLookups(result as EntityReaction[], filter);
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

      return foundIdempotent;
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
        this.validateIncomingReactionForCreation(enrichedData),
      )
      .then((validEnrichedData) => super.create(validEnrichedData, options));
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
            status: 404,
          });
        }

        throw error;
      }
    }
  }

  private async validateIncomingReactionForCreation(
    data: DataObject<EntityReaction>,
  ): Promise<DataObject<EntityReaction>> {
    this.checkDataKindFormat(data);
    this.checkDataKindValues(data);

    return Promise.all([
      this.checkEntityExistence(data),
      this.checkUniquenessForCreate(data),
      this.recordLimitChecker.checkLimits(EntityReaction, data, this),
      this.lookupConstraintService.validateLookupConstraints(
        data as EntityReaction,
        EntityReaction,
      ),
    ]).then(() => {
      return data;
    });
  }

  private async modifyIncomingReactionForCreation(
    data: DataObject<EntityReaction>,
  ): Promise<DataObject<EntityReaction>> {
    data._kind =
      data._kind ??
      process.env.default_entity_reaction_kind ??
      this.kindConfigReader.defaultEntityReactionKind;

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

  private async checkUniquenessForCreate(newData: DataObject<EntityReaction>) {
    await this.recordLimitChecker.checkUniqueness(
      EntityReaction,
      newData,
      this,
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
          status: 422,
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
        status: 422,
      });
    }
  }

  private generateSlug(data: DataObject<EntityReaction>) {
    if (data._name && !data._slug) {
      data._slug = slugify(data._name ?? '', { lower: true, strict: true });
    }
  }

  private setCountFields(data: DataObject<EntityReaction>) {
    data._ownerUsersCount = _.isArray(data._ownerUsers)
      ? data._ownerUsers.length
      : 0;
    data._ownerGroupsCount = _.isArray(data._ownerGroups)
      ? data._ownerGroups.length
      : 0;
    data._viewerUsersCount = _.isArray(data._viewerUsers)
      ? data._viewerUsers.length
      : 0;
    data._viewerGroupsCount = _.isArray(data._viewerGroups)
      ? data._viewerGroups.length
      : 0;
    data._parentsCount = _.isArray(data._parents) ? data._parents.length : 0;
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
          status: 404,
        });
      }

      throw error;
    }
  }

  private async modifyIncomingReactionForUpdates(
    id: string,
    data: DataObject<EntityReaction>,
  ) {
    return this.findByIdRaw(id)
      .then((existingData) => {
        // check if we have this record in db
        if (!existingData) {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: 'NotFoundError',
            message: "Entity reaction with id '" + id + "' could not be found.",
            code: 'ENTITY-REACTION-NOT-FOUND',
            status: 404,
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
        status: 422,
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
        status: 422,
      });
    }

    const uniquenessCheck = this.checkUniquenessForUpdate(id, data);
    const limitCheck = this.recordLimitChecker.checkLimits(
      EntityReaction,
      data,
      this,
    );
    const lookupConstraintCheck =
      this.lookupConstraintService.validateLookupConstraints(
        data as EntityReaction,
        EntityReaction,
      );

    await Promise.all([uniquenessCheck, limitCheck, lookupConstraintCheck]);

    return data;
  }

  private async checkUniquenessForUpdate(
    id: string,
    newData: DataObject<EntityReaction>,
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
    );
  }

  async updateAll(
    data: DataObject<EntityReaction>,
    where?: Where<EntityReaction>,
    entityWhere?: Where<EntityReaction>,
  ): Promise<Count> {
    // Check if user is trying to change the _kind field, which is immutable
    if (data._kind !== undefined) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'Entity reaction kind cannot be changed after creation.',
        code: 'IMMUTABLE-ENTITY-REACTION-KIND',
        status: 422,
      });
    }

    // Check if user is trying to change the _entityId field, which is immutable
    if (data._entityId !== undefined) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableEntityIdError',
        message: 'Entity reaction entity ID cannot be changed after creation.',
        code: 'IMMUTABLE-ENTITY-ID',
        status: 422,
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

    // Get entity repository to get collection name
    const entityRepo = await this.entityRepositoryGetter();
    const entityCollectionName =
      entityRepo.modelClass.definition.settings?.mongodb?.collection;

    if (!entityCollectionName) {
      throw new Error('Entity collection name not configured');
    }

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
      this.modelClass.definition.settings?.mongodb?.collection,
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

  async updateById(id: string, data: DataObject<EntityReaction>) {
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
    );

    return super.updateById(id, validEnrichedData);
  }

  private async validateIncomingDataForUpdate(
    id: string,
    existingData: EntityReaction,
    data: DataObject<EntityReaction>,
  ) {
    // Check if user is trying to change the _kind field
    if (data._kind !== undefined && data._kind !== existingData._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: `Entity reaction kind cannot be changed after creation. Current kind is '${existingData._kind}'.`,
        code: 'IMMUTABLE-ENTITY-REACTION-KIND',
        status: 422,
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
        status: 422,
      });
    }

    // we need to merge existing data with incoming data in order to check limits and uniquenesses
    const mergedData = _.assign(
      {},
      existingData && _.pickBy(existingData, (value) => value !== null),
      data,
    );
    const uniquenessCheck = this.checkUniquenessForUpdate(id, mergedData);
    const limitCheck = this.recordLimitChecker.checkLimits(
      EntityReaction,
      mergedData,
      this,
    );
    const lookupConstraintCheck =
      this.lookupConstraintService.validateLookupConstraints(
        mergedData as EntityReaction,
        EntityReaction,
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

      // Get entity repository to get collection name
      const entityRepo = await this.entityRepositoryGetter();
      const entityCollectionName =
        entityRepo.modelClass.definition.settings?.mongodb?.collection;

      if (!entityCollectionName) {
        throw new Error('Entity collection name not configured');
      }

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
        this.modelClass.definition.settings?.mongodb?.collection,
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
      // Get entity repository to get collection name
      const entityRepo = await this.entityRepositoryGetter();
      const entityCollectionName =
        entityRepo.modelClass.definition.settings?.mongodb?.collection;

      if (!entityCollectionName) {
        throw new Error('Entity collection name not configured');
      }

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
        this.modelClass.definition.settings?.mongodb?.collection,
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
          status: 404,
        });
      }

      // Process lookups if needed
      return await this.processLookup(result[0] as EntityReaction, filter);
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
      // Add the parent reference to the reaction
      const childReaction: EntityReaction = {
        ...reaction,
        _parents: [`tapp://localhost/entity-reactions/${parentId}`],
      } as EntityReaction;

      // Create the child reaction
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

  async replaceById(id: string, data: DataObject<EntityReaction>) {
    const collection = await this.modifyIncomingReactionForUpdates(id, data);

    // Calculate idempotencyKey and assign it if present
    const idempotencyKey = this.calculateIdempotencyKey(collection.data);
    if (idempotencyKey) {
      collection.data._idempotencyKey = idempotencyKey;
    }

    const validEnrichedData = await this.validateIncomingReactionForReplace(
      id,
      collection.data,
    );

    return super.replaceById(id, validEnrichedData);
  }
}
