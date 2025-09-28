import { Getter, inject } from '@loopback/core';
import {
  DataObject,
  DefaultCrudRepository,
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
import { EntityDbDataSource } from '../datasources';
import {
  IdempotencyConfigurationReader,
  KindConfigurationReader,
  UniquenessConfigurationReader,
  ValidfromConfigurationReader,
} from '../extensions';
import { MongoPipelineHelper } from '../extensions/utils/mongo-pipeline-helper';
import {
  ListEntityRelationRelations,
  ListToEntityRelation,
  HttpErrorResponse,
  List,
} from '../models';
import { EntityRepository } from './entity.repository';
import { ListRepository } from './list.repository';
import { CollectionConfigHelper } from '../extensions/config-helpers/collection-config-helper';
import { ResponseLimitConfigurationReader } from '../extensions/config-helpers/response-limit-config-helper';
import { LoggingService } from '../services/logging.service';
import { RecordLimitCheckerBindings } from '../services/record-limit-checker.bindings';
import { RecordLimitCheckerService } from '../services/record-limit-checker.service';

export class ListEntityRelationRepository extends DefaultCrudRepository<
  ListToEntityRelation,
  typeof ListToEntityRelation.prototype._id,
  ListEntityRelationRelations
> {
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

    @inject('extensions.uniqueness.configurationreader')
    private uniquenessConfigReader: UniquenessConfigurationReader,

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

  async find(
    filter?: Filter<ListToEntityRelation>,
    entityFilter?: Filter<ListToEntityRelation>,
    listFilter?: Filter<ListToEntityRelation>,
  ): Promise<(ListToEntityRelation & ListEntityRelationRelations)[]> {
    // Get collection names from configuration
    const listCollectionName =
      CollectionConfigHelper.getInstance().getListCollectionName();
    const entityCollectionName =
      CollectionConfigHelper.getInstance().getEntityCollectionName();
    const relationCollectionName =
      CollectionConfigHelper.getInstance().getListEntityRelationCollectionName();

    // Get the MongoDB collection for executing the aggregation
    const relationCollection = this.dataSource.connector?.collection(
      relationCollectionName,
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
      const cursor = relationCollection.aggregate(pipeline);
      const result = await cursor.toArray();

      return result as (ListToEntityRelation & ListEntityRelationRelations)[];
    } catch (error) {
      throw new Error(`Failed to execute aggregation: ${error}`);
    }
  }

  async count(
    where?: Where<ListToEntityRelation>,
    listWhere?: Where<List>,
    entityWhere?: Where<Entity>,
    _options?: Options,
  ): Promise<Count> {
    // Convert where to filter for pipeline generation
    const filter = where ? { where } : undefined;
    const listFilter = listWhere ? { where: listWhere } : undefined;
    const entityFilter = entityWhere ? { where: entityWhere } : undefined;

    // Get collection names from configuration
    const listCollectionName =
      CollectionConfigHelper.getInstance().getListCollectionName();
    const entityCollectionName =
      CollectionConfigHelper.getInstance().getEntityCollectionName();
    const relationCollectionName =
      CollectionConfigHelper.getInstance().getListEntityRelationCollectionName();

    // Get the MongoDB collection for executing the aggregation
    const relationCollection = this.dataSource.connector?.collection(
      relationCollectionName,
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

      // Use the native MongoDB driver's aggregate method
      this.loggingService.debug(
        `Count Filters: ${JSON.stringify({ filter, entityFilter, listFilter }, null, 2)}\nPipeline: ${JSON.stringify(pipeline, null, 2)}`,
      );
      const cursor = relationCollection.aggregate(pipeline);
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
    // Fetch a single raw relation from the database
    return super.findById(id, filter, options).then(async (rawRelation) => {
      if (!rawRelation) {
        throw new HttpErrorResponse({
          statusCode: 404,
          name: 'NotFoundError',
          message: "Relation with id '" + id + "' could not be found.",
          code: 'RELATION-NOT-FOUND',
          status: 404,
        });
      }

      // Fetch required metadata for the list and entity
      const [listMetadata, entityMetadata] = await Promise.all([
        this.listRepositoryGetter().then((listRepo) =>
          listRepo.findById(rawRelation._listId).catch(() => null),
        ),
        this.entityRepositoryGetter().then((entityRepo) =>
          entityRepo.findById(rawRelation._entityId).catch(() => null),
        ),
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

      return rawRelation;
    });
  }

  /**
   * Create a new relation ensuring idempotency and validation.
   */
  async create(data: DataObject<ListToEntityRelation>, options?: Options) {
    const idempotencyKey = this.calculateIdempotencyKey(data);

    return this.findIdempotentRelation(idempotencyKey).then(
      (foundIdempotent) => {
        if (foundIdempotent) {
          return foundIdempotent;
        }

        data._idempotencyKey = idempotencyKey;

        return this.createNewRelationFacade(data, options);
      },
    );
  }

  async replaceById(id: string, data: DataObject<ListToEntityRelation>) {
    return this.enrichIncomingRelForUpdates(id, data)
      .then((collection) => {
        // calculate idempotencyKey
        const idempotencyKey = this.calculateIdempotencyKey(collection.data);

        // set idempotencyKey
        collection.data._idempotencyKey = idempotencyKey;

        return collection;
      })
      .then((collection) =>
        this.validateIncomingRelForReplace(id, collection.data),
      )
      .then((validEnrichedData) => super.replaceById(id, validEnrichedData));
  }

  async updateById(id: string, data: DataObject<ListToEntityRelation>) {
    return this.enrichIncomingRelForUpdates(id, data)
      .then((collection) => {
        const mergedData = {
          ...data,
          ...(collection.existingData &&
            _.pickBy(collection.existingData, (value) => value !== null)),
        };

        // calculate idempotencyKey
        const idempotencyKey = this.calculateIdempotencyKey(mergedData);

        // set idempotencyKey
        collection.data._idempotencyKey = idempotencyKey;

        return collection;
      })
      .then((collection) =>
        this.validateIncomingRelForUpdate(
          id,
          collection.existingData,
          collection.data,
        ),
      )
      .then((validEnrichedData) => super.updateById(id, validEnrichedData));
  }

  async updateAll(
    data: DataObject<ListToEntityRelation>,
    where?: Where<ListToEntityRelation>,
    options?: Options,
  ) {
    if (data._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'Relation kind cannot be changed after creation.',
        code: 'IMMUTABLE-RELATION-KIND',
        status: 422,
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
    return this.enrichIncomingRelationForCreation(data)
      .then((enrichedData) =>
        this.validateIncomingRelationForCreation(enrichedData),
      )
      .then((validEnrichedData) => super.create(validEnrichedData, options));
  }

  /**
   * Ensure data validity by verifying referenced IDs, uniqueness, and formatting.
   */
  async validateIncomingRelationForCreation(
    data: DataObject<ListToEntityRelation>,
  ): Promise<DataObject<ListToEntityRelation>> {
    this.checkDataKindValues(data);
    this.checkDataKindFormat(data);

    return Promise.all([
      this.checkUniquenessForRelation(data),
      this.checkDependantsExistence(
        data as DataObject<ListToEntityRelation> & {
          _entityId: string;
          _listId: string;
        },
      ),
      this.checkRecordLimits(data),
    ]).then(() => data);
  }

  async enrichIncomingRelForUpdates(
    id: string,
    data: DataObject<ListToEntityRelation>,
  ) {
    const existingData = await this.findById(id);

    // check if we have this record in db
    if (!existingData) {
      throw new HttpErrorResponse({
        statusCode: 404,
        name: 'NotFoundError',
        message: "Relation with id '" + id + "' could not be found.",
        code: 'RELATION-NOT-FOUND',
        status: 404,
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
  ) {
    // Check if kind is being changed
    if (data._kind && data._kind !== existingData._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'Relation kind cannot be changed after creation.',
        code: 'IMMUTABLE-RELATION-KIND',
        status: 422,
      });
    }

    // we need to merge existing data with incoming data in order to check limits and uniquenesses
    const mergedData = {
      ...data,
      ...(existingData && _.pickBy(existingData, (value) => value !== null)),
    } as DataObject<ListToEntityRelation>;

    return Promise.all([
      this.checkUniquenessForUpdate(id, mergedData),
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
  ) {
    const existingData = await this.findById(id);

    // Check if kind is being changed
    if (data._kind && data._kind !== existingData._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableKindError',
        message: 'Relation kind cannot be changed after creation.',
        code: 'IMMUTABLE-RELATION-KIND',
        status: 422,
      });
    }

    return Promise.all([
      this.checkDependantsExistence(
        data as DataObject<ListToEntityRelation> & {
          _entityId: string;
          _listId: string;
        },
      ),
      this.checkUniquenessForUpdate(id, data),
    ]).then(() => data);
  }

  private async checkUniquenessForUpdate(
    id: string,
    newData: DataObject<ListToEntityRelation>,
  ) {
    await this.recordLimitChecker.checkUniqueness(
      ListToEntityRelation,
      newData,
      this,
    );
  }

  private async checkRecordLimits(newData: DataObject<ListToEntityRelation>) {
    await this.recordLimitChecker.checkLimits(
      ListToEntityRelation,
      newData,
      this,
    );
  }

  async checkDependantsExistence(
    data: DataObject<ListToEntityRelation> & {
      _entityId: string;
      _listId: string;
    },
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
        status: 400,
      });
    }

    // Check if related entity and list exist
    await Promise.all([
      entityRepo.findById(data._entityId).catch(() => {
        throw new HttpErrorResponse({
          statusCode: 404,
          name: 'NotFoundError',
          message:
            "Entity with id '" + data._entityId + "' could not be found.",
          code: 'ENTITY-NOT-FOUND',
          status: 404,
        });
      }),
      listRepo.findById(data._listId).catch(() => {
        throw new HttpErrorResponse({
          statusCode: 404,
          name: 'NotFoundError',
          message: "List with id '" + data._listId + "' could not be found.",
          code: 'LIST-NOT-FOUND',
          status: 404,
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
    const now = new Date().toISOString();

    data._kind =
      data._kind ??
      this.kindConfigReader.defaultRelationKind;
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
  ): Promise<ListToEntityRelation | null> {
    if (_.isString(idempotencyKey) && !_.isEmpty(idempotencyKey)) {
      return this.findOne({
        where: { _idempotencyKey: idempotencyKey },
      });
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
          status: 422,
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
        status: 422,
      });
    }
  }

  /**
   * Ensure the uniqueness of the relation.
   */
  private async checkUniquenessForRelation(
    data: DataObject<ListToEntityRelation>,
  ) {
    await this.recordLimitChecker.checkUniqueness(
      ListToEntityRelation,
      data,
      this,
    );
  }
}
