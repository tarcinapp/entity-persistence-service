import {Getter, inject} from '@loopback/core';
import {DataObject, DefaultCrudRepository, Filter, FilterBuilder, Options, repository, WhereBuilder} from '@loopback/repository';
import * as crypto from 'crypto';
import _ from 'lodash';
import {EntityDbDataSource} from '../datasources';
import {IdempotencyConfigurationReader, KindLimitsConfigurationReader, RecordLimitsConfigurationReader, SetFilterBuilder, UniquenessConfigurationReader} from '../extensions';
import {ValidfromConfigurationReader} from '../extensions/validfrom-config-reader';
import {GenericListEntityRelation, GenericListEntityRelationRelations, HttpErrorResponse, SingleError} from '../models';
import {GenericEntityRepository} from './generic-entity.repository';
import {GenericListRepository} from './generic-list.repository';

export class GenericListEntityRelationRepository extends DefaultCrudRepository<
  GenericListEntityRelation,
  typeof GenericListEntityRelation.prototype.id,
  GenericListEntityRelationRelations
> {

  private static responseLimit = _.parseInt(process.env.response_limit_list_entity_rel ?? "50");

  constructor(
    @inject('datasources.EntityDb')
    dataSource: EntityDbDataSource,

    @repository.getter('GenericEntityRepository')
    protected genericEntityRepositoryGetter: Getter<GenericEntityRepository>,

    @repository.getter('GenericListRepository')
    protected genericListRepositoryGetter: Getter<GenericListRepository>,

    @inject('extensions.idempotency.configurationreader')
    private idempotencyConfigReader: IdempotencyConfigurationReader,

    @inject('extensions.kind-limits.configurationreader')
    private kindLimitConfigReader: KindLimitsConfigurationReader,

    @inject('extensions.validfrom.configurationreader')
    private validfromConfigReader: ValidfromConfigurationReader,

    @inject('extensions.record-limits.configurationreader')
    private recordLimitConfigReader: RecordLimitsConfigurationReader,

    @inject('extensions.uniqueness.configurationreader')
    private uniquenessConfigReader: UniquenessConfigurationReader
  ) {
    super(GenericListEntityRelation, dataSource);
  }

  async find(filter?: Filter<GenericListEntityRelation>, options?: Options) {

    // Calculate the limit value using optional chaining and nullish coalescing
    // If filter.limit is defined, use its value; otherwise, use GenericListEntityRelationRepository.response_limit
    const limit = filter?.limit ?? GenericListEntityRelationRepository.responseLimit;

    // Update the filter object by spreading the existing filter and overwriting the limit property
    // Ensure that the new limit value does not exceed ListRepository.response_limit
    filter = {...filter, limit: Math.min(limit, GenericListEntityRelationRepository.responseLimit)};

    return super.find(filter, options);
  }

  /**
   * Create a new relation ensuring idempotency and validation.
   */
  async create(data: DataObject<GenericListEntityRelation>) {
    const idempotencyKey = this.calculateIdempotencyKey(data);

    return this.findIdempotentRelation(idempotencyKey).then(foundIdempotent => {
      if (foundIdempotent) {
        return foundIdempotent;
      }

      data.idempotencyKey = idempotencyKey;
      return this.createNewRelationFacade(data);
    });
  }

  /**
   * Handle creation flow: Enrich, validate, and store relation.
   */
  async createNewRelationFacade(
    data: DataObject<GenericListEntityRelation>
  ): Promise<GenericListEntityRelation> {
    return this.enrichIncomingRelationForCreation(data)
      .then(enrichedData => this.validateIncomingRelationForCreation(enrichedData))
      .then(validEnrichedData => super.create(validEnrichedData));
  }

  /**
   * Ensure data validity by verifying referenced IDs, uniqueness, and formatting.
   */
  async validateIncomingRelationForCreation(
    data: DataObject<GenericListEntityRelation>
  ): Promise<DataObject<GenericListEntityRelation>> {
    this.checkDataKindValues(data);
    this.checkDataKindFormat(data);

    return Promise
      .all([
        this.checkUniquenessForRelation(data),
        this.checkDependantsExistence(data),
        this.checkRecordLimits(data)
      ])
      .then(() => data);
  }

  private async checkRecordLimits(
    newData: DataObject<GenericListEntityRelation>
  ) {
    // Check if record limits are configured for the given kind
    if (!this.recordLimitConfigReader.isRecordLimitsConfiguredForListEntityRelations(newData.kind)) {
      return;
    }

    // Retrieve the limit and set based on the environment configurations
    const limit = this.recordLimitConfigReader.getRecordLimitsCountForListEntityRelations(newData.kind);
    const set = this.recordLimitConfigReader.getRecordLimitsSetForListEntityRelations(
      newData.ownerUsers,
      newData.ownerGroups,
      newData.kind
    );

    // Build the initial filter
    let filterBuilder: FilterBuilder<GenericListEntityRelation>;
    if (this.recordLimitConfigReader.isLimitConfiguredForKindForListEntityRelations(newData.kind)) {
      filterBuilder = new FilterBuilder<GenericListEntityRelation>({
        where: {
          kind: newData.kind,
        },
      });
    } else {
      filterBuilder = new FilterBuilder<GenericListEntityRelation>();
    }

    let filter = filterBuilder.build();

    // Apply set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericListEntityRelation>(set, {
        filter: filter,
      }).build();
    }

    // Get the current count of records
    const currentCount = await this.count(filter.where);

    // Throw an error if the limit is exceeded
    if (currentCount.count >= limit!) {
      throw new HttpErrorResponse({
        statusCode: 429,
        name: "LimitExceededError",
        message: `Relation limit is exceeded.`,
        code: "RELATION-LIMIT-EXCEEDED",
        status: 429,
        details: [new SingleError({
          code: "RELATION-LIMIT-EXCEEDED",
          info: {
            limit: limit
          }
        })]
      });
    }
  }


  async checkDependantsExistence(
    data: DataObject<GenericListEntityRelation>
  ) {
    const [genericEntityRepo, genericListRepo] = await Promise.all([
      this.genericEntityRepositoryGetter(),
      this.genericListRepositoryGetter(),
    ]);

    // Check if related entity and list exist
    await Promise.all([
      genericEntityRepo.findById(data.entityId).catch(() => {

        throw new HttpErrorResponse({
          statusCode: 404,
          name: "NotFoundError",
          message: "Entity with id '" + data.entityId + "' could not be found.",
          code: "ENTITY-NOT-FOUND",
          status: 404
        });
      }),
      genericListRepo.findById(data.listId).catch(() => {

        throw new HttpErrorResponse({
          statusCode: 404,
          name: "NotFoundError",
          message: "List with id '" + data.listId + "' could not be found.",
          code: "LIST-NOT-FOUND",
          status: 404
        });
      }),
    ]);
  }

  /**
   * Add system fields and prepare data for storage.
   */
  enrichIncomingRelationForCreation(
    data: DataObject<GenericListEntityRelation>
  ): Promise<DataObject<GenericListEntityRelation>> {
    const now = new Date().toISOString();

    data.kind = data.kind ?? 'relation';
    data.creationDateTime = data.creationDateTime ?? now;
    data.lastUpdatedDateTime = data.lastUpdatedDateTime ?? now;
    data.version = 1;

    // auto approve
    data.validFromDateTime = this.validfromConfigReader.getValidFromForListEntityRelations(data.kind) ? now : undefined;

    return Promise.resolve(data);
  }

  /**
   * Calculate idempotency key for deduplication.
   */
  calculateIdempotencyKey(data: DataObject<GenericListEntityRelation>) {
    const idempotencyFields = this.idempotencyConfigReader.getIdempotencyForListEntityRels(data.kind);

    if (idempotencyFields.length === 0) return undefined;

    const keyString = idempotencyFields
      .map(field => {
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
    idempotencyKey: string | undefined
  ): Promise<GenericListEntityRelation | null> {
    if (_.isString(idempotencyKey) && !_.isEmpty(idempotencyKey)) {
      return this.findOne({
        where: {idempotencyKey},
      });
    }
    return null;
  }

  /**
   * Ensure data kind is properly formatted.
   */
  private checkDataKindFormat(data: DataObject<GenericListEntityRelation>) {

    if (data.kind) {
      const formattedKind = _.kebabCase(data.kind);
      if (formattedKind !== data.kind) {
        throw new Error(`Invalid kind format: Use '${formattedKind}' instead.`);
      }
    }
  }

  /**
   * Ensure data kind values are valid.
   */
  private checkDataKindValues(data: DataObject<GenericListEntityRelation>) {

    /**
     * This function checks if the 'kind' field in the 'data' object is valid
     * for the list. Although 'kind' is required, we ensure it has a value by
     * this point. If it's not valid, we raise an error with the allowed valid
     * values for 'kind'.
    */
    const kind = data.kind ?? '';

    if (!this.kindLimitConfigReader.isKindAcceptableForListEntityRelations(kind)) {
      const validValues = this.kindLimitConfigReader.allowedKindsForEntityListRelations;

      throw new HttpErrorResponse({
        statusCode: 422,
        name: "InvalidKindError",
        message: `Relation kind '${data.kind}' is not valid. Use any of these values instead: ${validValues.join(', ')}`,
        code: "INVALID-RELATION-KIND",
        status: 422,
      });
    }
  }

  /**
   * Ensure the uniqueness of the relation.
   */
  private async checkUniquenessForRelation(data: DataObject<GenericListEntityRelation>) {
    // Return if no uniqueness is configured
    if (!this.uniquenessConfigReader.isUniquenessConfiguredForListEntityRelations(data.kind)) {
      return;
    }

    const whereBuilder: WhereBuilder<GenericListEntityRelation> = new WhereBuilder<GenericListEntityRelation>();

    // Read the uniqueness fields for this kind
    const fields: string[] = this.uniquenessConfigReader.getFieldsForListEntityRelations(data.kind);
    const set = this.uniquenessConfigReader.getSetForListEntityRelations(data.ownerUsers, data.ownerGroups, data.kind);

    // Add uniqueness fields to the where builder
    _.forEach(fields, (field) => {
      whereBuilder.and({
        [field]: _.get(data, field),
      });
    });

    let filter = new FilterBuilder<GenericListEntityRelation>()
      .where(whereBuilder.build())
      .build();

    // Add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericListEntityRelation>(set, {
        filter: filter,
      }).build();
    }

    const existingRelation = await this.findOne(filter);

    if (existingRelation) {
      throw new HttpErrorResponse({
        statusCode: 409,
        name: "DataUniquenessViolationError",
        message: "Relation already exists.",
        code: "RELATION-ALREADY-EXISTS",
        status: 409,
      });
    }
  }
}
