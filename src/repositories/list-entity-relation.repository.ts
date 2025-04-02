import { Getter, inject } from '@loopback/core';
import {
  DataObject,
  DefaultCrudRepository,
  Filter,
  FilterBuilder,
  FilterExcludingWhere,
  Options,
  repository,
  Where,
  WhereBuilder,
} from '@loopback/repository';
import { Request, RestBindings } from '@loopback/rest';
import * as crypto from 'crypto';
import _ from 'lodash';
import { parse } from 'qs';
import { EntityDbDataSource } from '../datasources';
import {
  IdempotencyConfigurationReader,
  KindConfigurationReader,
  RecordLimitsConfigurationReader,
  SetFilterBuilder,
  UniquenessConfigurationReader,
  ValidfromConfigurationReader,
} from '../extensions';
import { FilterMatcher } from '../extensions/utils/filter-matcher';
import { MongoPipelineHelper } from '../extensions/utils/mongo-pipeline-helper';
import { Set } from '../extensions/utils/set-helper';
import {
  ListEntityRelationRelations,
  ListToEntityRelation,
  HttpErrorResponse,
  SingleError,
} from '../models';
import { EntityRepository } from './entity.repository';
import { ListRepository } from './list.repository';
import { ResponseLimitConfigurationReader } from '../extensions/config-helpers/response-limit-config-helper';
import { LoggingService } from '../services/logging.service';

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

    @inject('extensions.record-limits.configurationreader')
    private recordLimitConfigReader: RecordLimitsConfigurationReader,

    @inject('extensions.uniqueness.configurationreader')
    private uniquenessConfigReader: UniquenessConfigurationReader,

    @inject('extensions.response-limit.configurationreader')
    private responseLimitConfigReader: ResponseLimitConfigurationReader,

    @inject('services.LoggingService')
    private loggingService: LoggingService,

    @inject(RestBindings.Http.REQUEST)
    private request: Request,

    @inject('services.MongoPipelineHelper')
    private mongoPipelineHelper: MongoPipelineHelper,
  ) {
    super(ListToEntityRelation, dataSource);
  }

  async find(
    filter?: Filter<ListToEntityRelation>,
    entityFilter?: Filter<any>,
    listFilter?: Filter<any>,
  ): Promise<(ListToEntityRelation & ListEntityRelationRelations)[]> {
    // Get collection names from repositories
    const [listRepo, entityRepo] = await Promise.all([
      this.listRepositoryGetter(),
      this.entityRepositoryGetter(),
    ]);

    // Get collection names from mongodb settings
    const listCollectionName =
      listRepo.modelClass.definition.settings?.mongodb?.collection;
    const entityCollectionName =
      entityRepo.modelClass.definition.settings?.mongodb?.collection;
    const relationCollectionName =
      this.modelClass.definition.settings?.mongodb?.collection;

    if (
      !listCollectionName ||
      !entityCollectionName ||
      !relationCollectionName
    ) {
      throw new Error(
        'Required MongoDB collection names not configured in model settings',
      );
    }

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
        name: 'ValidationError',
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
        name: 'ValidationError',
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
        name: 'ValidationError',
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
    // return if no uniqueness is configured
    if (
      !process.env.uniqueness_list_entity_rel_fields &&
      !process.env.uniqueness_list_entity_rel_set
    ) {
      return;
    }

    const whereBuilder: WhereBuilder<ListToEntityRelation> =
      new WhereBuilder<ListToEntityRelation>();

    // add uniqueness fields if configured
    if (process.env.uniqueness_list_entity_rel_fields) {
      const fields: string[] = process.env.uniqueness_list_entity_rel_fields
        .replace(/\s/g, '')
        .split(',');

      // if there is at least single field in the fields array that does not present on new data, then we should find it from the db.
      if (_.some(fields, _.negate(_.partial(_.has, newData)))) {
        const existingRel = await super.findById(id);

        _.forEach(fields, (field) => {
          whereBuilder.and({
            [field]: _.has(newData, field)
              ? _.get(newData, field)
              : _.get(existingRel, field),
          });
        });
      } else {
        _.forEach(fields, (field) => {
          whereBuilder.and({
            [field]: _.get(newData, field),
          });
        });
      }
    }

    //
    whereBuilder.and({
      _id: {
        neq: id,
      },
    });

    let filter = new FilterBuilder<ListToEntityRelation>()
      .where(whereBuilder.build())
      .fields('_id')
      .build();

    // add set filter if configured
    if (process.env.uniqueness_list_entity_set) {
      const uniquenessStr = process.env.uniqueness_list_entity_set;
      const uniquenessSet = parse(uniquenessStr).set as Set;

      filter = new SetFilterBuilder<ListToEntityRelation>(uniquenessSet, {
        filter: filter,
      }).build();
    }

    // final uniqueness controlling filter
    // console.log('Uniqueness Filter: ', JSON.stringify(filter));

    const existingList = await super.findOne(filter);

    if (existingList) {
      throw new HttpErrorResponse({
        statusCode: 409,
        name: 'DataUniquenessViolationError',
        message: 'List already exists.',
        code: 'LIST-ALREADY-EXISTS',
        status: 409,
      });
    }
  }

  private async checkRecordLimits(newData: DataObject<ListToEntityRelation>) {
    await Promise.all([
      this.checkListEntityRelationLimits(newData),
      this.checkListEntityCountLimits(newData),
    ]);
  }

  private async checkListEntityRelationLimits(
    newData: DataObject<ListToEntityRelation>,
  ) {
    // Check if record limits are configured for the given kind
    if (
      !this.recordLimitConfigReader.isRecordLimitsConfiguredForListEntityRelations(
        newData._kind,
      )
    ) {
      return;
    }

    // Retrieve the limit and set based on the environment configurations
    const limit =
      this.recordLimitConfigReader.getRecordLimitsCountForListEntityRelations(
        newData._kind,
      );
    const set =
      this.recordLimitConfigReader.getRecordLimitsSetForListEntityRelations(
        newData._kind,
      );

    // Build the initial filter
    let filterBuilder: FilterBuilder<ListToEntityRelation>;
    if (
      this.recordLimitConfigReader.isLimitConfiguredForKindForListEntityRelations(
        newData._kind,
      )
    ) {
      filterBuilder = new FilterBuilder<ListToEntityRelation>({
        where: {
          _kind: newData._kind,
        },
      });
    } else {
      filterBuilder = new FilterBuilder<ListToEntityRelation>();
    }

    let filter = filterBuilder.build();

    // Apply set filter if configured
    if (set) {
      filter = new SetFilterBuilder<ListToEntityRelation>(set, {
        filter: filter,
      }).build();

      // Check if the new record would match the set filter
      if (!this.wouldRecordMatchFilter(newData, filter.where)) {
        // Record wouldn't be part of the set, no need to check limits
        return;
      }
    }

    // Get the current count of records
    const currentCount = await this.count(filter.where);

    // Throw an error if the limit is exceeded
    if (currentCount.count >= limit!) {
      throw new HttpErrorResponse({
        statusCode: 429,
        name: 'LimitExceededError',
        message: `Relation limit is exceeded.`,
        code: 'RELATION-LIMIT-EXCEEDED',
        status: 429,
        details: [
          new SingleError({
            code: 'RELATION-LIMIT-EXCEEDED',
            info: {
              limit: limit,
            },
          }),
        ],
      });
    }
  }

  /**
   * Evaluates if a record would match a given filter
   * @param record The record to evaluate
   * @param whereClause The filter conditions to check
   * @returns boolean indicating if the record would match the filter
   */
  private wouldRecordMatchFilter(
    record: DataObject<ListToEntityRelation>,
    whereClause: Where<ListToEntityRelation> | undefined,
  ): boolean {
    return FilterMatcher.matches(record, whereClause);
  }

  private async checkListEntityCountLimits(
    newData: DataObject<ListToEntityRelation>,
  ) {
    // Ensure listId exists
    if (!newData._listId) {
      throw new HttpErrorResponse({
        statusCode: 400,
        name: 'BadRequestError',
        message: 'List id is required.',
        code: 'MISSING-LIST-ID',
        status: 400,
      });
    }

    const listId = newData._listId; // TypeScript now knows this is string

    // Get the list to check its kind
    const list = await this.listRepositoryGetter().then((repo) =>
      repo.findById(listId),
    );

    // Check if entity count limits are configured for the list's kind
    if (
      !this.recordLimitConfigReader.isRecordLimitsConfiguredForListEntityCount(
        list._kind,
      )
    ) {
      return;
    }

    // Get the configured limit for this kind of list
    const limit =
      this.recordLimitConfigReader.getRecordLimitsCountForListEntityCount(
        list._kind,
      );

    // Count existing relations for this list
    const currentCount = await this.count({
      _listId: listId,
    });

    // Throw an error if the limit would be exceeded
    if (currentCount.count >= limit!) {
      throw new HttpErrorResponse({
        statusCode: 429,
        name: 'LimitExceededError',
        message: `List entity limit is exceeded. This list cannot contain more than ${limit} entities.`,
        code: 'LIST-ENTITY-LIMIT-EXCEEDED',
        status: 429,
        details: [
          new SingleError({
            code: 'LIST-ENTITY-LIMIT-EXCEEDED',
            info: {
              limit: limit,
              listId: listId,
              listKind: list._kind,
            },
          }),
        ],
      });
    }
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
      process.env.default_relation_kind ??
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
      const formattedKind = _.kebabCase(data._kind);
      if (formattedKind !== data._kind) {
        throw new Error(`Invalid kind format: Use '${formattedKind}' instead.`);
      }
    }
  }

  /**
   * Ensure data kind values are valid.
   */
  private checkDataKindValues(data: DataObject<ListToEntityRelation>) {
    /**
     * This function checks if the 'kind' field in the 'data' object is valid
     * for the list. Although 'kind' is required, we ensure it has a value by
     * this point. If it's not valid, we raise an error with the allowed valid
     * values for 'kind'.
     */
    const kind = data._kind ?? '';

    if (!this.kindConfigReader.isKindAcceptableForListEntityRelations(kind)) {
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
    // Return if no uniqueness is configured
    if (
      !this.uniquenessConfigReader.isUniquenessConfiguredForListEntityRelations(
        data._kind,
      )
    ) {
      return;
    }

    const whereBuilder: WhereBuilder<ListToEntityRelation> =
      new WhereBuilder<ListToEntityRelation>();

    // Read the uniqueness fields for this kind
    const fields: string[] =
      this.uniquenessConfigReader.getFieldsForListEntityRelations(data._kind);
    const set = this.uniquenessConfigReader.getSetForListEntityRelations(
      data._kind,
    );

    // Add uniqueness fields to the where builder
    _.forEach(fields, (field) => {
      whereBuilder.and({
        [field]: _.get(data, field),
      });
    });

    let filter = new FilterBuilder<ListToEntityRelation>()
      .where(whereBuilder.build())
      .build();

    // Add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<ListToEntityRelation>(set, {
        filter: filter,
      }).build();
    }

    const existingRelation = await this.findOne(filter);

    if (existingRelation) {
      throw new HttpErrorResponse({
        statusCode: 409,
        name: 'DataUniquenessViolationError',
        message: 'Relation already exists.',
        code: 'RELATION-ALREADY-EXISTS',
        status: 409,
      });
    }
  }
}
