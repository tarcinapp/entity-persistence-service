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
import { ListRepository } from './list.repository';
import { CollectionConfigHelper } from '../extensions/config-helpers/collection-config-helper';
import {
  LookupHelper,
  LookupBindings,
} from '../extensions/utils/lookup-helper';
import {
  MongoPipelineHelper,
  MongoPipelineHelperBindings,
} from '../extensions/utils/mongo-pipeline-helper';
import { ListReaction, HttpErrorResponse } from '../models';
import { LoggingService } from '../services/logging.service';
import { LookupConstraintBindings } from '../services/lookup-constraint.bindings';
import { LookupConstraintService } from '../services/lookup-constraint.service';
import { RecordLimitCheckerService } from '../services/record-limit-checker.service';

export class ListReactionsRepository extends DefaultCrudRepository<
  ListReaction,
  typeof ListReaction.prototype.id
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
    @repository.getter('ListRepository')
    protected listRepositoryGetter: Getter<ListRepository>,
    @inject(MongoPipelineHelperBindings.HELPER)
    private mongoPipelineHelper: MongoPipelineHelper,
  ) {
    super(ListReaction, dataSource);
  }

  private async processLookups(
    reactions: ListReaction[],
    filter?: Filter<ListReaction>,
  ): Promise<ListReaction[]> {
    if (!filter?.lookup) {
      return reactions;
    }

    return this.lookupHelper.processLookupForArray(reactions, filter);
  }

  private async processLookup(
    reaction: ListReaction,
    filter?: Filter<ListReaction>,
  ): Promise<ListReaction> {
    if (!filter?.lookup) {
      return reaction;
    }

    return this.lookupHelper.processLookupForOne(reaction, filter);
  }

  async find(
    filter?: Filter<ListReaction>,
    listFilter?: Filter<ListReaction>,
    options?: Options & { useMongoPipeline?: boolean },
  ): Promise<ListReaction[]> {
    const limit =
      filter?.limit ??
      this.responseLimitConfigReader.getListReactionResponseLimit();

    filter = {
      ...filter,
      limit: Math.min(
        limit,
        this.responseLimitConfigReader.getListReactionResponseLimit(),
      ),
    };

    this.loggingService.info(
      'ListReactionsRepository.find - Modified filter:',
      {
        filter,
        listFilter,
        useMongoPipeline: options?.useMongoPipeline,
      },
    );

    // If useMongoPipeline is not explicitly set to true, use repository approach
    if (options?.useMongoPipeline !== true) {
      const reactions = await super.find(filter);

      return this.processLookups(reactions, filter);
    }

    // MongoDB pipeline approach
    // Get collection names from configuration
    const listCollectionName =
      CollectionConfigHelper.getInstance().getListCollectionName();
    const reactionCollectionName =
      CollectionConfigHelper.getInstance().getListReactionsCollectionName();

    // Build pipeline using helper
    const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
      listCollectionName,
      filter?.limit ??
        this.responseLimitConfigReader.getListReactionResponseLimit(),
      filter,
      listFilter,
    );

    // Execute pipeline
    const collection = this.dataSource.connector?.collection(
      ListReaction.modelName || 'ListReaction',
    );

    if (!collection) {
      throw new Error('Collection not found');
    }

    const cursor = collection.aggregate(pipeline);
    const result = await cursor.toArray();

    // Process lookups if needed
    return this.processLookups(result as ListReaction[], filter);
  }

  async create(data: DataObject<ListReaction>, options?: Options) {
    const idempotencyKey = this.calculateIdempotencyKey(data);
    const foundIdempotent = await this.findIdempotentReaction(idempotencyKey);

    if (foundIdempotent) {
      this.loggingService.info(
        'ListReactionsRepository.create - Idempotent reaction found. Skipping creation.',
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
  ): Promise<ListReaction | null> {
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

  calculateIdempotencyKey(data: DataObject<ListReaction>) {
    const idempotencyFields =
      this.idempotencyConfigReader.getIdempotencyForListReactions(data._kind);

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
    data: DataObject<ListReaction>,
    options?: Options,
  ): Promise<ListReaction> {
    return this.modifyIncomingReactionForCreation(data)
      .then((enrichedData) =>
        this.validateIncomingReactionForCreation(enrichedData),
      )
      .then((validEnrichedData) => super.create(validEnrichedData, options));
  }

  private async checkListExistence(
    data: DataObject<ListReaction>,
  ): Promise<void> {
    if (data._listId) {
      try {
        const listRepository = await this.listRepositoryGetter();
        await listRepository.findById(data._listId);
      } catch (error) {
        if (error.code === 'ENTITY_NOT_FOUND') {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: 'NotFoundError',
            message: `List with id '${data._listId}' could not be found.`,
            code: 'LIST-NOT-FOUND',
            status: 404,
          });
        }

        throw error;
      }
    }
  }

  private async validateIncomingReactionForCreation(
    data: DataObject<ListReaction>,
  ): Promise<DataObject<ListReaction>> {
    this.checkDataKindFormat(data);
    this.checkDataKindValues(data);

    return Promise.all([
      this.checkListExistence(data),
      this.checkUniquenessForCreate(data),
      this.recordLimitChecker.checkLimits(ListReaction, data, this),
      this.lookupConstraintService.validateLookupConstraints(
        data as ListReaction,
        ListReaction,
      ),
    ]).then(() => {
      return data;
    });
  }

  private async modifyIncomingReactionForCreation(
    data: DataObject<ListReaction>,
  ): Promise<DataObject<ListReaction>> {
    data._kind =
      data._kind ??
      this.kindConfigReader.defaultListReactionKind;

    const now = new Date().toISOString();

    data._createdDateTime = data._createdDateTime ? data._createdDateTime : now;
    data._lastUpdatedDateTime = data._lastUpdatedDateTime
      ? data._lastUpdatedDateTime
      : now;

    const shouldAutoApprove =
      this.validfromConfigReader.getValidFromForListReactions(data._kind);
    data._validFromDateTime =
      data._validFromDateTime ?? (shouldAutoApprove ? now : undefined);

    data._validUntilDateTime = data._validUntilDateTime ?? null;

    data._version = 1;

    data._visibility = data._visibility
      ? data._visibility
      : this.visibilityConfigReader.getVisibilityForListReactions(
          data._kind,
        );

    this.generateSlug(data);
    this.setCountFields(data);

    _.unset(data, '_fromMeta');

    return data;
  }

  private async checkUniquenessForCreate(newData: DataObject<ListReaction>) {
    await this.recordLimitChecker.checkUniqueness(
      ListReaction,
      newData,
      this,
    );
  }

  private checkDataKindFormat(data: DataObject<ListReaction>) {
    if (data._kind) {
      const slugKind = this.kindConfigReader.validateKindFormat(data._kind);
      if (slugKind) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'InvalidKindError',
          message: `List reaction kind cannot contain special or uppercase characters. Use '${slugKind}' instead.`,
          code: 'INVALID-LIST-REACTION-KIND',
          status: 422,
        });
      }
    }
  }

  private checkDataKindValues(data: DataObject<ListReaction>) {
    if (
      data._kind &&
      !this.kindConfigReader.isKindAcceptableForListReactions(data._kind)
    ) {
      const validValues = this.kindConfigReader.allowedKindsForListReactions;
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'InvalidKindError',
        message: `List reaction kind '${data._kind}' is not valid. Use any of these values instead: ${validValues.join(', ')}`,
        code: 'INVALID-LIST-REACTION-KIND',
        status: 422,
      });
    }
  }

  private generateSlug(data: DataObject<ListReaction>) {
    if (data._name && !data._slug) {
      data._slug = slugify(data._name ?? '', { lower: true, strict: true });
    }
  }

  private setCountFields(data: DataObject<ListReaction>) {
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
    filter?: FilterExcludingWhere<ListReaction>,
  ): Promise<ListReaction> {
    try {
      const reaction = await super.findById(id, filter);

      return reaction;
    } catch (error) {
      if (error.code === 'ENTITY_NOT_FOUND') {
        this.loggingService.warn(`List reaction with id '${id}' not found.`);
        throw new HttpErrorResponse({
          statusCode: 404,
          name: 'NotFoundError',
          message: `List reaction with id '${id}' could not be found.`,
          code: 'LIST-REACTION-NOT-FOUND',
          status: 404,
        });
      }

      throw error;
    }
  }

  private async modifyIncomingReactionForUpdates(
    id: string,
    data: DataObject<ListReaction>,
  ) {
    return this.findByIdRaw(id)
      .then((existingData) => {
        // check if we have this record in db
        if (!existingData) {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: 'NotFoundError',
            message: "List reaction with id '" + id + "' could not be found.",
            code: 'LIST-REACTION-NOT-FOUND',
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
    data: DataObject<ListReaction>,
  ) {
    // Get the existing reaction to check if _kind is being changed
    const existingReaction = await this.findById(id);

    // Check if user is trying to change the _kind field
    if (data._kind !== undefined && data._kind !== existingReaction._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: `List reaction kind cannot be changed after creation. Current kind is '${existingReaction._kind}'.`,
        code: 'IMMUTABLE-LIST-REACTION-KIND',
        status: 422,
      });
    }

    // Check if user is trying to change the _listId field
    if (
      data._listId !== undefined &&
      data._listId !== existingReaction._listId
    ) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableListIdError',
        message: `List reaction list ID cannot be changed after creation. Current list ID is '${existingReaction._listId}'.`,
        code: 'IMMUTABLE-LIST-ID',
        status: 422,
      });
    }

    const uniquenessCheck = this.checkUniquenessForUpdate(id, data);
    const limitCheck = this.recordLimitChecker.checkLimits(
      ListReaction,
      data,
      this,
    );
    const lookupConstraintCheck =
      this.lookupConstraintService.validateLookupConstraints(
        data as ListReaction,
        ListReaction,
      );

    await Promise.all([uniquenessCheck, limitCheck, lookupConstraintCheck]);

    return data;
  }

  private async checkUniquenessForUpdate(
    id: string,
    newData: DataObject<ListReaction>,
  ) {
    // we need to merge existing data with incoming data in order to check uniqueness
    const existingData = await this.findById(id);
    const mergedData = _.assign(
      {},
      existingData && _.pickBy(existingData, (value) => value !== null),
      newData,
    );
    await this.recordLimitChecker.checkUniqueness(
      ListReaction,
      mergedData,
      this,
    );
  }

  async updateAll(
    data: DataObject<ListReaction>,
    where?: Where<ListReaction>,
    listWhere?: Where<ListReaction>,
  ): Promise<Count> {
    // Check if user is trying to change the _kind field, which is immutable
    if (data._kind !== undefined) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'List reaction kind cannot be changed after creation.',
        code: 'IMMUTABLE-LIST-REACTION-KIND',
        status: 422,
      });
    }

    // Check if user is trying to change the _listId field, which is immutable
    if (data._listId !== undefined) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableListIdError',
        message: 'List reaction list ID cannot be changed after creation.',
        code: 'IMMUTABLE-LIST-ID',
        status: 422,
      });
    }

    const now = new Date().toISOString();
    data._lastUpdatedDateTime = now;

    // Generate slug and set count fields
    this.generateSlug(data);
    this.setCountFields(data);

    this.loggingService.info(
      'ListReactionsRepository.updateAll - Modified data:',
      {
        data,
        where,
        listWhere,
      },
    );

    // Convert where to filter for pipeline generation
    const filter = where ? { where } : undefined;
    const listFilter = listWhere ? { where: listWhere } : undefined;

    // Get collection names from configuration
    const listCollectionName =
      CollectionConfigHelper.getInstance().getListCollectionName();
    const reactionCollectionName =
      CollectionConfigHelper.getInstance().getListReactionsCollectionName();

    // Build pipeline to get the IDs of documents to update
    const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
      listCollectionName,
      0, // No limit needed
      filter,
      listFilter,
    );

    // Add projection to get only _id
    pipeline.push({
      $project: {
        _id: 1,
      },
    });

    // Execute pipeline to get IDs
    const collection = this.dataSource.connector?.collection(
      ListReaction.modelName || 'ListReaction',
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

  async updateById(id: string, data: DataObject<ListReaction>) {
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
    existingData: ListReaction,
    data: DataObject<ListReaction>,
  ) {
    // Check if user is trying to change the _kind field
    if (data._kind !== undefined && data._kind !== existingData._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: `List reaction kind cannot be changed after creation. Current kind is '${existingData._kind}'.`,
        code: 'IMMUTABLE-LIST-REACTION-KIND',
        status: 422,
      });
    }

    // Check if user is trying to change the _listId field
    if (
      data._listId !== undefined &&
      data._listId !== existingData._listId
    ) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableListIdError',
        message: `List reaction list ID cannot be changed after creation. Current list ID is '${existingData._listId}'.`,
        code: 'IMMUTABLE-LIST-ID',
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
      ListReaction,
      mergedData,
      this,
    );
    const lookupConstraintCheck =
      this.lookupConstraintService.validateLookupConstraints(
        mergedData as ListReaction,
        ListReaction,
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
    where?: Where<ListReaction>,
    options?: Options,
  ): Promise<Count> {
    this.loggingService.info(
      'ListReactionsRepository.deleteAll - Where condition:',
      {
        where,
      },
    );

    return super.deleteAll(where, options);
  }

  async count(
    where?: Where<ListReaction>,
    listWhere?: Where<ListReaction>,
  ): Promise<Count> {
    try {
      // Convert where to filter for pipeline generation
      const filter = where ? { where } : undefined;
      const listFilter = listWhere ? { where: listWhere } : undefined;

      // Get collection names from configuration
      const listCollectionName =
        CollectionConfigHelper.getInstance().getListCollectionName();

      // Build pipeline using helper
      const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
        listCollectionName,
        0, // No limit needed for counting
        filter,
        listFilter,
      );

      // Add count stage
      pipeline.push({ $count: 'count' });

      // Execute pipeline
      const collection = this.dataSource.connector?.collection(
        ListReaction.modelName || 'ListReaction',
      );

      if (!collection) {
        throw new Error('Collection not found');
      }

      const cursor = collection.aggregate(pipeline);
      const result = await cursor.toArray();

      return { count: result.length > 0 ? result[0].count : 0 };
    } catch (error) {
      this.loggingService.error('ListReactionsRepository.count - Error:', {
        error,
      });
      throw error;
    }
  }

  async findById(
    id: string,
    filter?: FilterExcludingWhere<ListReaction>,
  ): Promise<ListReaction> {
    try {
      // Get collection names from configuration
      const listCollectionName =
        CollectionConfigHelper.getInstance().getListCollectionName();

      // Build pipeline using helper
      const pipeline = this.mongoPipelineHelper.buildEntityReactionPipeline(
        listCollectionName,
        1, // Limit to 1 since we're looking for a specific ID
        {
          ...filter,
          where: { _id: id },
        },
      );

      // Execute pipeline
      const collection = this.dataSource.connector?.collection(
        ListReaction.modelName || 'ListReaction',
      );

      if (!collection) {
        throw new Error('Collection not found');
      }

      const cursor = collection.aggregate(pipeline);
      const result = await cursor.toArray();

      if (result.length === 0) {
        this.loggingService.warn(`List reaction with id '${id}' not found.`);
        throw new HttpErrorResponse({
          statusCode: 404,
          name: 'NotFoundError',
          message: `List reaction with id '${id}' could not be found.`,
          code: 'LIST-REACTION-NOT-FOUND',
          status: 404,
        });
      }

      // Process lookups if needed
      return await this.processLookup(result[0] as ListReaction, filter);
    } catch (error) {
      if (error.code === 'LIST-REACTION-NOT-FOUND') {
        throw error;
      }

      this.loggingService.error(
        'ListReactionsRepository.findById - Unexpected Error:',
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
    filter?: Filter<ListReaction>,
    listFilter?: Filter<ListReaction>,
    options?: Options,
  ): Promise<ListReaction[]> {
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
    const parentFilter: Filter<ListReaction> = {
      ...filter,
      where: {
        and: [
          { _id: { inq: parentIds } },
          ...(filter?.where ? [filter.where] : []),
        ],
      },
    };

    this.loggingService.info(
      'ListReactionsRepository.findParents - Parent filter:',
      {
        parentFilter,
      },
    );

    return this.find(parentFilter, listFilter, {
      useMongoPipeline: false,
      ...options,
    });
  }

  async findChildren(
    reactionId: string,
    filter?: Filter<ListReaction>,
    listFilter?: Filter<ListReaction>,
    options?: Options,
  ): Promise<ListReaction[]> {
    // First verify that the reaction exists, throw error if not
    await this.findById(reactionId, {
      fields: { _id: true },
    });

    const uri = `tapp://localhost/list-reactions/${reactionId}`;

    // Create a filter to find reactions where _parents contains the given reactionId
    const childFilter: Filter<ListReaction> = {
      ...filter,
      where: {
        and: [{ _parents: uri }, ...(filter?.where ? [filter.where] : [])],
      },
    };

    this.loggingService.info(
      'ListReactionsRepository.findChildren - Child filter:',
      {
        childFilter,
      },
    );

    return this.find(childFilter, listFilter, {
      useMongoPipeline: false,
      ...options,
    });
  }

  async createChild(
    parentId: string,
    reaction: DataObject<ListReaction>,
  ): Promise<ListReaction> {
    try {
      // Retrieve parent with _listId
      const parent = await this.findByIdRaw(parentId, { fields: { _listId: true } });

      // If parent not found, findByIdRaw will throw LIST-REACTION-NOT-FOUND

      // Check if _listId matches
      if (parent._listId !== reaction._listId) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'SourceRecordNotMatchError',
          message: `Source record _listId does not match parent. Parent _listId: '${parent._listId}', child _listId: '${reaction._listId}'.`,
          code: 'SOURCE-RECORD-NOT-MATCH',
          status: 422,
        });
      }

      // Add the parent reference to the reaction
      const childReaction: ListReaction = {
        ...reaction,
        _parents: [`tapp://localhost/list-reactions/${parentId}`],
      } as ListReaction;

      // Create the child reaction
      return await this.create(childReaction);
    } catch (error) {
      this.loggingService.error(
        'ListReactionsRepository.createChild - Error:',
        {
          error,
          parentId,
        },
      );
      throw error;
    }
  }

  async replaceById(id: string, data: DataObject<ListReaction>) {
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
