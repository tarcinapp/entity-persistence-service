import { Getter, inject } from '@loopback/core';
import {
  DataObject,
  Filter,
  FilterExcludingWhere,
  Options,
  repository,
  Where,
  Count,
  Entity,
} from '@loopback/repository';
import * as crypto from 'crypto';
import _ from 'lodash';
import { EntityRepository } from './entity.repository';
import { ListRepository } from './list.repository';
import { EntityDbDataSource } from '../../datasources';
import {
  IdempotencyConfigurationReader,
  KindConfigurationReader,
  ValidfromConfigurationReader,
} from '../../extensions';
import { CollectionConfigHelper } from '../../extensions/config-helpers/collection-config-helper';
import { ResponseLimitConfigurationReader } from '../../extensions/config-helpers/response-limit-config-helper';
import { MongoPipelineHelper } from '../../extensions/utils/mongo-pipeline-helper';
import {
  ListEntityRelationRelations,
  ListToEntityRelation,
  HttpErrorResponse,
  List,
} from '../../models';
import { LoggingService } from '../../services/logging.service';
import { RecordLimitCheckerBindings } from '../../services/record-limit-checker.bindings';
import { RecordLimitCheckerService } from '../../services/record-limit-checker.service';
import { EntityPersistenceBaseRepository } from '../base/entity-persistence-base.repository';

export class ListEntityRelationRepository extends EntityPersistenceBaseRepository<
  ListToEntityRelation,
  typeof ListToEntityRelation.prototype._id,
  ListEntityRelationRelations
> {
  protected readonly recordTypeName = 'relation';

  // Override virtualFields to include relation-specific fields
  protected readonly virtualFields: string[] = [
    '_recordType',
    '_fromMetadata',
    '_toMetadata',
  ];
  constructor(
    @inject('datasources.EntityDb')
    dataSource: EntityDbDataSource,

    @repository.getter('EntityRepository')
    protected entityRepositoryGetter: Getter<EntityRepository>,

    @repository.getter('ListRepository')
    protected listRepositoryGetter: Getter<ListRepository>,

    @inject('extensions.idempotency.configurationreader')
    private idempotencyConfigReader: IdempotencyConfigurationReader,

    @inject('extensions.kind.configurationreader')
    private kindConfigReader: KindConfigurationReader,

    @inject('extensions.validfrom.configurationreader')
    private validfromConfigReader: ValidfromConfigurationReader,

    @inject('extensions.response-limit.configurationreader')
    private responseLimitConfigReader: ResponseLimitConfigurationReader,

    @inject('services.LoggingService')
    private loggingService: LoggingService,

    @inject('services.MongoPipelineHelper')
    private mongoPipelineHelper: MongoPipelineHelper,

    @inject(RecordLimitCheckerBindings.SERVICE)
    private recordLimitChecker: RecordLimitCheckerService,
  ) {
    super(ListToEntityRelation, dataSource);
  }

  private forceKindInclusion(
    filter: Filter<ListToEntityRelation> | undefined,
  ): Filter<ListToEntityRelation> | undefined {
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

  async find(
    filter?: Filter<ListToEntityRelation>,
    entityFilter?: Filter<ListToEntityRelation>,
    listFilter?: Filter<ListToEntityRelation>,
    options?: Options,
  ): Promise<(ListToEntityRelation & ListEntityRelationRelations)[]> {
    // Ensure _kind is always included
    filter = this.forceKindInclusion(filter);

    // Get collection names from configuration
    const listCollectionName =
      CollectionConfigHelper.getInstance().getListCollectionName();
    const entityCollectionName =
      CollectionConfigHelper.getInstance().getEntityCollectionName();

    // Get the MongoDB collection for executing the aggregation
    // Pass the model name (not collection name) so the connector can look it up
    const relationCollection = (this.dataSource.connector as any)?.collection(
      'ListToEntityRelation',
    );

    if (!relationCollection) {
      throw new Error('Required MongoDB collection not found');
    }

    // Calculate the limit value using optional chaining and nullish coalescing
    const limit =
      filter?.limit ??
      this.responseLimitConfigReader.getListEntityRelResponseLimit();

    // Ensure the limit doesn't exceed configured response limit
    const finalLimit = Math.min(
      limit,
      this.responseLimitConfigReader.getListEntityRelResponseLimit(),
    );

    try {
      // Build the pipeline using the helper
      const pipeline = this.mongoPipelineHelper.buildListEntityRelationPipeline(
        listCollectionName,
        entityCollectionName,
        finalLimit,
        filter,
        entityFilter,
        listFilter,
      );

      // Use the native MongoDB driver's aggregate method
      this.loggingService.debug(
        `Filters: ${JSON.stringify({ filter, entityFilter, listFilter }, null, 2)}\nPipeline: ${JSON.stringify(pipeline, null, 2)}`,
      );
      const cursor = relationCollection.aggregate(pipeline, {
        session: options?.session,
        ...options,
      });
      const result = await cursor.toArray();

      return this.injectRecordTypeArray(
        result as (ListToEntityRelation & ListEntityRelationRelations)[],
      );
    } catch (error) {
      throw new Error(`Failed to execute aggregation: ${error}`);
    }
  }

  async count(
    where?: Where<ListToEntityRelation>,
    listWhereOrOptions?: Where<List> | Options,
    entityWhereOrOptions?: Where<Entity> | Options,
    options?: Options,
  ): Promise<Count> {
    let actualListWhere: Where<List> | undefined;
    let actualEntityWhere: Where<Entity> | undefined;
    let actualOptions: Options | undefined;

    /**
     * POLYMORPHIC PARAMETER SHIFTING
     * Detect if parameters are shifted when options is passed in unexpected position.
     * Possible call patterns:
     * 1. count(where, options) - 2nd param is options
     * 2. count(where, listWhere, options) - 3rd param is options
     * 3. count(where, listWhere, entityWhere, options) - standard 4 params
     */
    if (
      listWhereOrOptions &&
      (typeof (listWhereOrOptions as any).session === 'object' ||
        (listWhereOrOptions as any).transaction)
    ) {
      // 2nd parameter is 'options' - no filters provided
      actualOptions = listWhereOrOptions as Options;
      actualListWhere = undefined;
      actualEntityWhere = undefined;
    } else if (
      entityWhereOrOptions &&
      (typeof (entityWhereOrOptions as any).session === 'object' ||
        (entityWhereOrOptions as any).transaction)
    ) {
      // 3rd parameter is 'options' - only listWhere provided
      actualListWhere = listWhereOrOptions as Where<List>;
      actualOptions = entityWhereOrOptions as Options;
      actualEntityWhere = undefined;
    } else {
      // Standard 4-parameter call
      actualListWhere = listWhereOrOptions as Where<List>;
      actualEntityWhere = entityWhereOrOptions as Where<Entity>;
      actualOptions = options;
    }

    // Convert where to filter for pipeline generation
    const filter = where ? { where } : undefined;
    const listFilter = actualListWhere ? { where: actualListWhere } : undefined;
    const entityFilter = actualEntityWhere
      ? { where: actualEntityWhere }
      : undefined;

    // Get collection names from configuration
    const listCollectionName =
      CollectionConfigHelper.getInstance().getListCollectionName();
    const entityCollectionName =
      CollectionConfigHelper.getInstance().getEntityCollectionName();

    // Get the MongoDB collection for executing the aggregation
    // Pass the model name (not collection name) so the connector can look it up
    const relationCollection = (this.dataSource.connector as any)?.collection(
      'ListToEntityRelation',
    );

    if (!relationCollection) {
      throw new Error('Required MongoDB collection not found');
    }

    try {
      // Build the pipeline using the helper
      const pipeline = this.mongoPipelineHelper.buildListEntityRelationPipeline(
        listCollectionName,
        entityCollectionName,
        0, // No limit needed for counting
        filter,
        entityFilter,
        listFilter,
      );

      // Add a $count stage at the end of the pipeline
      pipeline.push({ $count: 'count' });

      // Use the native MongoDB driver's aggregate method with transaction session
      this.loggingService.debug(
        `Count Filters: ${JSON.stringify({ filter, entityFilter, listFilter }, null, 2)}\nPipeline: ${JSON.stringify(pipeline, null, 2)}`,
      );
      const cursor = relationCollection.aggregate(pipeline, {
        session: actualOptions?.session,
        ...actualOptions,
      });
      const result = await cursor.toArray();

      // Return count object
      return { count: result.length > 0 ? result[0].count : 0 };
    } catch (error) {
      throw new Error(`Failed to execute count aggregation: ${error}`);
    }
  }

  async findById(
    id: string,
    filter?: FilterExcludingWhere<ListToEntityRelation>,
    options?: Options,
  ): Promise<ListToEntityRelation> {
    // Ensure _kind is always included (cast to Filter for the helper)
    const forcedFilter = this.forceKindInclusion(
      filter as Filter<ListToEntityRelation>,
    );
    const typedFilter =
      forcedFilter as FilterExcludingWhere<ListToEntityRelation>;

    // Fetch a single raw relation from the database
    const rawRelation = await super.findById(id, typedFilter, options);

    if (!rawRelation) {
      throw new HttpErrorResponse({
        statusCode: 404,
        name: 'NotFoundError',
        message: "Relation with id '" + id + "' could not be found.",
        code: 'RELATION-NOT-FOUND',
      });
    }

    // Fetch required metadata for the list and entity
    const listRepo = await this.listRepositoryGetter();
    const entityRepo = await this.entityRepositoryGetter();

    const [listMetadata, entityMetadata] = await Promise.all([
      listRepo.findById(rawRelation._listId).catch(() => null),
      entityRepo.findById(rawRelation._entityId).catch(() => null),
    ]);

    // Enrich the raw relation with metadata
    if (listMetadata) {
      rawRelation._fromMetadata = {
        _kind: listMetadata._kind,
        _name: listMetadata._name,
        _slug: listMetadata._slug,
        _validFromDateTime: listMetadata._validFromDateTime,
        _validUntilDateTime: listMetadata._validUntilDateTime,
        _visibility: listMetadata._visibility,
        _ownerUsers: listMetadata._ownerUsers,
        _ownerGroups: listMetadata._ownerGroups,
        _viewerUsers: listMetadata._viewerUsers,
        _viewerGroups: listMetadata._viewerGroups,
      };
    }

    if (entityMetadata) {
      rawRelation._toMetadata = {
        _kind: entityMetadata._kind,
        _name: entityMetadata._name,
        _slug: entityMetadata._slug,
        _validFromDateTime: entityMetadata._validFromDateTime,
        _validUntilDateTime: entityMetadata._validUntilDateTime,
        _visibility: entityMetadata._visibility,
        _ownerUsers: entityMetadata._ownerUsers,
        _ownerGroups: entityMetadata._ownerGroups,
        _viewerUsers: entityMetadata._viewerUsers,
        _viewerGroups: entityMetadata._viewerGroups,
      };
    }

    return this.injectRecordType(rawRelation);
  }

  /**
   * Create a new relation ensuring idempotency and validation.
   */
  async create(data: DataObject<ListToEntityRelation>, options?: Options) {
    const idempotencyKey = this.calculateIdempotencyKey(data);

    const foundIdempotent = await this.findIdempotentRelation(idempotencyKey);
    if (foundIdempotent) {
      return this.injectRecordType(foundIdempotent);
    }

    data._idempotencyKey = idempotencyKey;

    return this.createNewRelationFacade(data, options);
  }

  async replaceById(
    id: string,
    data: DataObject<ListToEntityRelation>,
    options?: Options,
  ) {
    const collection = await this.enrichIncomingRelForUpdates(id, data);

    // calculate idempotencyKey
    const idempotencyKey = this.calculateIdempotencyKey(collection.data);

    // set idempotencyKey
    collection.data._idempotencyKey = idempotencyKey;

    const validEnrichedData = await this.validateIncomingRelForReplace(
      id,
      collection.data,
      options,
    );

    return super.replaceById(id, validEnrichedData, options);
  }

  async updateById(
    id: string,
    data: DataObject<ListToEntityRelation>,
    options?: Options,
  ) {
    const collection = await this.enrichIncomingRelForUpdates(id, data);

    const mergedData = {
      ...data,
      ...(collection.existingData &&
        _.pickBy(collection.existingData, (value) => value !== null)),
    };

    // calculate idempotencyKey
    const idempotencyKey = this.calculateIdempotencyKey(mergedData);

    // set idempotencyKey
    collection.data._idempotencyKey = idempotencyKey;

    const validEnrichedData = await this.validateIncomingRelForUpdate(
      id,
      collection.existingData,
      collection.data,
      options,
    );

    return super.updateById(id, validEnrichedData, options);
  }

  async updateAll(
    data: DataObject<ListToEntityRelation>,
    where?: Where<ListToEntityRelation>,
    options?: Options,
  ) {
    data = this.sanitizeRecordType(data);

    if (data._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'Relation kind cannot be changed after creation.',
        code: 'IMMUTABLE-RELATION-KIND',
      });
    }

    const now = new Date().toISOString();
    data._lastUpdatedDateTime = now;

    return super.updateAll(data, where, options);
  }

  /**
   * Handle creation flow: Enrich, validate, and store relation.
   */
  async createNewRelationFacade(
    data: DataObject<ListToEntityRelation>,
    options?: Options,
  ): Promise<ListToEntityRelation> {
    const enrichedData = await this.enrichIncomingRelationForCreation(data);

    const validEnrichedData = await this.validateIncomingRelationForCreation(
      enrichedData,
      options,
    );

    const created = await super.create(validEnrichedData, options);

    return this.injectRecordType(created);
  }

  /**
   * Ensure data validity by verifying referenced IDs, uniqueness, and formatting.
   */
  async validateIncomingRelationForCreation(
    data: DataObject<ListToEntityRelation>,
    options?: Options,
  ): Promise<DataObject<ListToEntityRelation>> {
    this.checkDataKindValues(data);
    this.checkDataKindFormat(data);

    return Promise.all([
      this.checkUniquenessForRelation(data, options),
      this.checkDependantsExistence(
        data as DataObject<ListToEntityRelation> & {
          _entityId: string;
          _listId: string;
        },
        options,
      ),
      this.checkRecordLimits(data, options),
    ]).then(() => data);
  }

  async enrichIncomingRelForUpdates(
    id: string,
    data: DataObject<ListToEntityRelation>,
  ) {
    // Strip virtual fields before persisting
    data = this.sanitizeRecordType(data);

    const existingData = await this.findById(id);

    // check if we have this record in db
    if (!existingData) {
      throw new HttpErrorResponse({
        statusCode: 404,
        name: 'NotFoundError',
        message: "Relation with id '" + id + "' could not be found.",
        code: 'RELATION-NOT-FOUND',
      });
    }

    const now = new Date().toISOString();

    // set new version
    data._version = (existingData._version ?? 1) + 1;

    // we may use current date, if it does not exist in the given data
    data._lastUpdatedDateTime = data._lastUpdatedDateTime
      ? data._lastUpdatedDateTime
      : now;

    return {
      data: data,
      existingData: existingData,
    };
  }

  async validateIncomingRelForUpdate(
    id: string,
    existingData: DataObject<ListToEntityRelation>,
    data: DataObject<ListToEntityRelation>,
    options?: Options,
  ) {
    // Check if kind is being changed
    if (data._kind && data._kind !== existingData._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'Relation kind cannot be changed after creation.',
        code: 'IMMUTABLE-RELATION-KIND',
      });
    }

    // we need to merge existing data with incoming data in order to check limits and uniquenesses
    const mergedData = {
      ...data,
      ...(existingData && _.pickBy(existingData, (value) => value !== null)),
    } as DataObject<ListToEntityRelation>;

    return Promise.all([
      this.checkUniquenessForUpdate(id, mergedData, options),
      this.checkDependantsExistence(
        mergedData as DataObject<ListToEntityRelation> & {
          _entityId: string;
          _listId: string;
        },
      ),
    ]).then(() => data);
  }

  async validateIncomingRelForReplace(
    id: string,
    data: DataObject<ListToEntityRelation>,
    options?: Options,
  ) {
    const existingData = await this.findById(id);

    // Check if kind is being changed
    if (data._kind && data._kind !== existingData._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'Relation kind cannot be changed after creation.',
        code: 'IMMUTABLE-RELATION-KIND',
      });
    }

    return Promise.all([
      this.checkDependantsExistence(
        data as DataObject<ListToEntityRelation> & {
          _entityId: string;
          _listId: string;
        },
      ),
      this.checkUniquenessForUpdate(id, data, options),
    ]).then(() => data);
  }

  private async checkUniquenessForUpdate(
    id: string,
    newData: DataObject<ListToEntityRelation>,
    options?: Options,
  ) {
    await this.recordLimitChecker.checkUniqueness(
      ListToEntityRelation,
      newData,
      this,
      options,
    );
  }

  private async checkRecordLimits(
    newData: DataObject<ListToEntityRelation>,
    options?: Options,
  ) {
    await this.recordLimitChecker.checkLimits(
      ListToEntityRelation,
      newData,
      this,
      options,
    );
  }

  async checkDependantsExistence(
    data: DataObject<ListToEntityRelation> & {
      _entityId: string;
      _listId: string;
    },
    options?: Options,
  ) {
    const [entityRepo, listRepo] = await Promise.all([
      this.entityRepositoryGetter(),
      this.listRepositoryGetter(),
    ]);

    if (!data._entityId || !data._listId) {
      throw new HttpErrorResponse({
        statusCode: 400,
        name: 'BadRequestError',
        message: 'Entity id and list id are required.',
        code: 'RELATION-MISSING-IDS',
      });
    }

    // Check if related entity and list exist
    await Promise.all([
      entityRepo.findById(data._entityId, undefined, options).catch(() => {
        throw new HttpErrorResponse({
          statusCode: 404,
          name: 'NotFoundError',
          message:
            "Entity with id '" + data._entityId + "' could not be found.",
          code: 'ENTITY-NOT-FOUND',
        });
      }),
      listRepo.findById(data._listId, undefined, options).catch(() => {
        throw new HttpErrorResponse({
          statusCode: 404,
          name: 'NotFoundError',
          message: "List with id '" + data._listId + "' could not be found.",
          code: 'LIST-NOT-FOUND',
        });
      }),
    ]);
  }

  /**
   * Add system fields and prepare data for storage.
   */
  enrichIncomingRelationForCreation(
    data: DataObject<ListToEntityRelation>,
  ): Promise<DataObject<ListToEntityRelation>> {
    // Strip virtual fields before persisting
    data = this.sanitizeRecordType(data);

    const now = new Date().toISOString();

    data._kind = data._kind ?? this.kindConfigReader.defaultRelationKind;
    data._createdDateTime = data._createdDateTime ?? now;
    data._lastUpdatedDateTime = data._lastUpdatedDateTime ?? now;
    data._version = 1;

    // auto approve
    const shouldAutoApprove =
      this.validfromConfigReader.getValidFromForListEntityRelations(data._kind);
    data._validFromDateTime =
      data._validFromDateTime ?? (shouldAutoApprove ? now : undefined);

    // we need to explicitly set validUntilDateTime to null
    // to make filter matcher work correctly while checking record limits
    data._validUntilDateTime = data._validUntilDateTime ?? null;

    return Promise.resolve(data);
  }

  /**
   * Calculate idempotency key for deduplication.
   */
  calculateIdempotencyKey(data: DataObject<ListToEntityRelation>) {
    const idempotencyFields =
      this.idempotencyConfigReader.getIdempotencyForListEntityRels(data._kind);

    if (idempotencyFields.length === 0) {
      return undefined;
    }

    const keyString = idempotencyFields
      .map((field) => {
        const value = _.get(data, field);

        return typeof value === 'object' ? JSON.stringify(value) : value;
      })
      .join(',');

    return crypto.createHash('sha256').update(keyString).digest('hex');
  }

  /**
   * Check if an idempotent relation already exists.
   */
  private async findIdempotentRelation(
    idempotencyKey: string | undefined,
    options?: Options,
  ): Promise<ListToEntityRelation | null> {
    if (_.isString(idempotencyKey) && !_.isEmpty(idempotencyKey)) {
      return this.findOne(
        {
          where: { _idempotencyKey: idempotencyKey },
        },
        options,
      );
    }

    return null;
  }

  /**
   * Ensure data kind is properly formatted.
   */
  private checkDataKindFormat(data: DataObject<ListToEntityRelation>) {
    if (data._kind) {
      const slugKind = this.kindConfigReader.validateKindFormat(data._kind);
      if (slugKind) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'InvalidKindError',
          message: `Relation kind cannot contain special or uppercase characters. Use '${slugKind}' instead.`,
          code: 'INVALID-RELATION-KIND',
        });
      }
    }
  }

  /**
   * Ensure data kind values are valid.
   */
  private checkDataKindValues(data: DataObject<ListToEntityRelation>) {
    if (
      data._kind &&
      !this.kindConfigReader.isKindAcceptableForListEntityRelations(data._kind)
    ) {
      const validValues =
        this.kindConfigReader.allowedKindsForEntityListRelations;
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'InvalidKindError',
        message: `Relation kind '${data._kind}' is not valid. Use any of these values instead: ${validValues.join(', ')}`,
        code: 'INVALID-RELATION-KIND',
      });
    }
  }

  /**
   * Ensure the uniqueness of the relation.
   */
  private async checkUniquenessForRelation(
    data: DataObject<ListToEntityRelation>,
    options?: Options,
  ) {
    await this.recordLimitChecker.checkUniqueness(
      ListToEntityRelation,
      data,
      this,
      options,
    );
  }
}
