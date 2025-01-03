import {Getter, inject} from '@loopback/core';
import {DataObject, DefaultCrudRepository, Filter, FilterBuilder, FilterExcludingWhere, Options, repository, Where, WhereBuilder} from '@loopback/repository';
import * as crypto from 'crypto';
import _ from 'lodash';
import qs from 'qs';
import {EntityDbDataSource} from '../datasources';
import {IdempotencyConfigurationReader, KindLimitsConfigurationReader, RecordLimitsConfigurationReader, SetFilterBuilder, UniquenessConfigurationReader} from '../extensions';
import {Set} from '../extensions/set';
import {ValidfromConfigurationReader} from '../extensions/validfrom-config-reader';
import {GenericListEntityRelationRelations, GenericListToEntityRelation, HttpErrorResponse, SingleError} from '../models';
import {GenericEntityRepository} from './generic-entity.repository';
import {GenericListRepository} from './generic-list.repository';

export class GenericListEntityRelationRepository extends DefaultCrudRepository<
  GenericListToEntityRelation,
  typeof GenericListToEntityRelation.prototype._id,
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
    super(GenericListToEntityRelation, dataSource);
  }

  async find(
    filter?: Filter<GenericListToEntityRelation>,
    options?: Options
  ): Promise<(GenericListToEntityRelation & GenericListEntityRelationRelations)[]> {
    const limit = filter?.limit ?? GenericListEntityRelationRepository.responseLimit;

    // Ensure the filter respects the response limit
    filter = {...filter, limit: Math.min(limit, GenericListEntityRelationRepository.responseLimit)};

    // Fetch raw relations from the database
    return super.find(filter, options).then((rawRelations) => {
      if (!rawRelations.length) {
        return [];
      }

      // Collect all listIds and entityIds from the raw relations
      const listIds = rawRelations.map((relation) => relation._listId);
      const entityIds = rawRelations.map((relation) => relation._entityId);

      // Fetch required metadata for all lists and entities in a single query
      return Promise.all([
        this.genericListRepositoryGetter().then((repo) =>
          repo.find({where: {_id: {inq: listIds}}})
        ),
        this.genericEntityRepositoryGetter().then((repo) =>
          repo.find({where: {_id: {inq: entityIds}}})
        ),
      ]).then(([listMetadata, entityMetadata]) => {
        // Create maps for quick lookup by id
        const listMetadataMap = new Map(listMetadata.map((list) => [list._id, list]));
        const entityMetadataMap = new Map(entityMetadata.map((entity) => [entity._id, entity]));

        // Enrich raw relations with metadata
        return rawRelations.map((relation) => {
          const list = listMetadataMap.get(relation._listId);
          const entity = entityMetadataMap.get(relation._entityId);

          if (list !== undefined)

            // Mutate the existing relation object
            relation._fromMetadata = {
              _kind: list._kind,
              _name: list._name,
              _slug: list._slug,
              _validFromDateTime: list._validFromDateTime,
              _validUntilDateTime: list._validUntilDateTime,
              _ownerUsers: list._ownerUsers,
              _ownerGroups: list._ownerGroups,
              _viewerUsers: list._viewerUsers,
              _viewerGroups: list._viewerGroups,
              _visibility: list._visibility,
            };

          if (entity !== undefined)
            relation._toMetadata = {
              _kind: entity._kind,
              _name: entity._name,
              _slug: entity._slug,
              _validFromDateTime: entity._validFromDateTime,
              _validUntilDateTime: entity._validUntilDateTime,
              _visibility: entity._visibility,
              _ownerUsers: entity._ownerUsers,
              _ownerGroups: entity._ownerGroups,
              _viewerUsers: entity._viewerUsers,
              _viewerGroups: entity._viewerGroups,
            };

          return relation; // Return the mutated object
        });
      });
    });
  }

  async findById(
    id: string, filter?: FilterExcludingWhere<GenericListToEntityRelation>, options?: Options
  ): Promise<GenericListToEntityRelation> {

    // Fetch a single raw relation from the database
    return super.findById(id, filter, options).then(async (rawRelation) => {

      if (!rawRelation) {
        throw new HttpErrorResponse({
          statusCode: 404,
          name: "NotFoundError",
          message: "Relation with id '" + id + "' could not be found.",
          code: "RELATION-NOT-FOUND",
          status: 404
        });
      }

      // Fetch required metadata for the list and entity
      const [listMetadata, entityMetadata] = await Promise.all([
        this.genericListRepositoryGetter().then((listRepo) => listRepo.findById(rawRelation._listId).catch(() => null)
        ),
        this.genericEntityRepositoryGetter().then((entityRepo) => entityRepo.findById(rawRelation._entityId).catch(() => null)
        ),
      ]);

      // Enrich the raw relation with metadata
      if (listMetadata)
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

      if (entityMetadata)
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
      return rawRelation;
    });
  }

  /**
   * Create a new relation ensuring idempotency and validation.
   */
  async create(data: DataObject<GenericListToEntityRelation>) {
    const idempotencyKey = this.calculateIdempotencyKey(data);

    return this.findIdempotentRelation(idempotencyKey).then(foundIdempotent => {
      if (foundIdempotent) {
        return foundIdempotent;
      }

      data._idempotencyKey = idempotencyKey;
      return this.createNewRelationFacade(data);
    });
  }

  async replaceById(id: string, data: DataObject<GenericListToEntityRelation>, options?: Options) {

    return this.enrichIncomingRelForUpdates(id, data)
      .then(collection => {

        // calculate idempotencyKey
        const idempotencyKey = this.calculateIdempotencyKey(collection.data);

        // set idempotencyKey
        collection.data._idempotencyKey = idempotencyKey;

        return collection;
      })
      .then(collection => this.validateIncomingRelForReplace(id, collection.data, options))
      .then(validEnrichedData => super.replaceById(id, validEnrichedData, options));
  }

  async updateById(id: string, data: DataObject<GenericListToEntityRelation>, options?: Options) {

    return this.enrichIncomingRelForUpdates(id, data)
      .then(collection => {
        const mergedData = _.assign(
          {},
          collection.existingData && _.pickBy(collection.existingData, (value) => value != null),
          collection.data
        );

        // calculate idempotencyKey
        const idempotencyKey = this.calculateIdempotencyKey(mergedData);

        // set idempotencyKey
        collection.data._idempotencyKey = idempotencyKey;

        return collection;
      })
      .then(collection => this.validateIncomingRelForUpdate(id, collection.existingData, collection.data, options))
      .then(validEnrichedData => super.updateById(id, validEnrichedData, options));
  }

  async updateAll(data: DataObject<GenericListToEntityRelation>, where?: Where<GenericListToEntityRelation>, options?: Options) {
    const now = new Date().toISOString();
    data._lastUpdatedDateTime = now;

    this.checkDataKindFormat(data);

    return super.updateAll(data, where, options);
  }

  /**
   * Handle creation flow: Enrich, validate, and store relation.
   */
  async createNewRelationFacade(
    data: DataObject<GenericListToEntityRelation>
  ): Promise<GenericListToEntityRelation> {
    return this.enrichIncomingRelationForCreation(data)
      .then(enrichedData => this.validateIncomingRelationForCreation(enrichedData))
      .then(validEnrichedData => super.create(validEnrichedData));
  }

  /**
   * Ensure data validity by verifying referenced IDs, uniqueness, and formatting.
   */
  async validateIncomingRelationForCreation(
    data: DataObject<GenericListToEntityRelation>
  ): Promise<DataObject<GenericListToEntityRelation>> {
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

  async enrichIncomingRelForUpdates(id: string, data: DataObject<GenericListToEntityRelation>) {
    const existingData = await this.findById(id);

    // check if we have this record in db
    if (!existingData) {
      throw new HttpErrorResponse({
        statusCode: 404,
        name: "NotFoundError",
        message: "Relation with id '" + id + "' could not be found.",
        code: "RELATION-NOT-FOUND",
        status: 404
      });
    }

    const now = new Date().toISOString();

    // set new version
    data._version = (existingData._version ?? 1) + 1;

    // we may use current date, if it does not exist in the given data
    data._lastUpdatedDateTime = data._lastUpdatedDateTime ? data._lastUpdatedDateTime : now;

    return {
      data: data,
      existingData: existingData
    };
  }

  async validateIncomingRelForUpdate(id: string, existingData: DataObject<GenericListToEntityRelation>, data: DataObject<GenericListToEntityRelation>, options?: Options) {
    // we need to merge existing data with incoming data in order to check limits and uniquenesses
    const mergedData = _.assign(
      {},
      existingData && _.pickBy(existingData, (value) => value != null),
      data
    );

    if (mergedData._kind) {
      this.checkDataKindFormat(mergedData);
      this.checkDataKindValues(mergedData);
    }

    return Promise.all([
      this.checkUniquenessForUpdate(id, mergedData),
      this.checkDependantsExistence(mergedData)
    ])
      .then(() => data);
  }

  async validateIncomingRelForReplace(id: string, data: DataObject<GenericListToEntityRelation>, options?: Options) {

    this.checkDataKindValues(data);
    this.checkDataKindFormat(data);

    return Promise.all([
      this.checkDependantsExistence(data),
      this.checkUniquenessForUpdate(id, data)
    ])
      .then(() => data);
  }

  private async checkUniquenessForUpdate(id: string, newData: DataObject<GenericListToEntityRelation>) {

    // return if no uniqueness is configured
    if (!process.env.uniqueness_list_entity_rel_fields && !process.env.uniqueness_list_entity_rel_set) return;

    const whereBuilder: WhereBuilder<GenericListToEntityRelation> = new WhereBuilder<GenericListToEntityRelation>();

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
            [field]: _.has(newData, field) ? _.get(newData, field) : _.get(existingRel, field)
          });
        });

      } else {
        _.forEach(fields, (field) => {

          whereBuilder.and({
            [field]: _.get(newData, field)
          });
        });
      }
    }

    //
    whereBuilder.and({
      _id: {
        neq: id
      }
    });

    let filter = new FilterBuilder<GenericListToEntityRelation>()
      .where(whereBuilder.build())
      .fields('_id')
      .build();

    // add set filter if configured
    if (process.env.uniqueness_list_entity_set) {

      const uniquenessStr = process.env.uniqueness_list_entity_set;
      const uniquenessSet = (qs.parse(uniquenessStr)).set as Set;

      filter = new SetFilterBuilder<GenericListToEntityRelation>(uniquenessSet, {
        filter: filter
      })
        .build();
    }

    // final uniqueness controlling filter
    // console.log('Uniqueness Filter: ', JSON.stringify(filter));

    const existingList = await super.findOne(filter);

    if (existingList) {

      throw new HttpErrorResponse({
        statusCode: 409,
        name: "DataUniquenessViolationError",
        message: "List already exists.",
        code: "LIST-ALREADY-EXISTS",
        status: 409,
      });
    }
  }

  private async checkRecordLimits(
    newData: DataObject<GenericListToEntityRelation>
  ) {
    // Check if record limits are configured for the given kind
    if (!this.recordLimitConfigReader.isRecordLimitsConfiguredForListEntityRelations(newData._kind)) {
      return;
    }

    // Retrieve the limit and set based on the environment configurations
    const limit = this.recordLimitConfigReader.getRecordLimitsCountForListEntityRelations(newData._kind);
    const set = this.recordLimitConfigReader.getRecordLimitsSetForListEntityRelations(
      newData._kind
    );

    // Build the initial filter
    let filterBuilder: FilterBuilder<GenericListToEntityRelation>;
    if (this.recordLimitConfigReader.isLimitConfiguredForKindForListEntityRelations(newData._kind)) {
      filterBuilder = new FilterBuilder<GenericListToEntityRelation>({
        where: {
          _kind: newData._kind,
        },
      });
    } else {
      filterBuilder = new FilterBuilder<GenericListToEntityRelation>();
    }

    let filter = filterBuilder.build();

    // Apply set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericListToEntityRelation>(set, {
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
    data: DataObject<GenericListToEntityRelation>
  ) {
    const [genericEntityRepo, genericListRepo] = await Promise.all([
      this.genericEntityRepositoryGetter(),
      this.genericListRepositoryGetter(),
    ]);

    // Check if related entity and list exist
    await Promise.all([
      genericEntityRepo.findById(data._entityId).catch(() => {

        throw new HttpErrorResponse({
          statusCode: 404,
          name: "NotFoundError",
          message: "Entity with id '" + data._entityId + "' could not be found.",
          code: "ENTITY-NOT-FOUND",
          status: 404
        });
      }),
      genericListRepo.findById(data._listId).catch(() => {

        throw new HttpErrorResponse({
          statusCode: 404,
          name: "NotFoundError",
          message: "List with id '" + data._listId + "' could not be found.",
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
    data: DataObject<GenericListToEntityRelation>
  ): Promise<DataObject<GenericListToEntityRelation>> {
    const now = new Date().toISOString();

    data._kind = data._kind ?? 'relation';
    data._createdDateTime = data._createdDateTime ?? now;
    data._lastUpdatedDateTime = data._lastUpdatedDateTime ?? now;
    data._version = 1;

    // auto approve
    data._validFromDateTime = this.validfromConfigReader.getValidFromForListEntityRelations(data._kind) ? now : undefined;

    return Promise.resolve(data);
  }

  /**
   * Calculate idempotency key for deduplication.
   */
  calculateIdempotencyKey(data: DataObject<GenericListToEntityRelation>) {
    const idempotencyFields = this.idempotencyConfigReader.getIdempotencyForListEntityRels(data._kind);

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
  ): Promise<GenericListToEntityRelation | null> {
    if (_.isString(idempotencyKey) && !_.isEmpty(idempotencyKey)) {
      return this.findOne({
        where: {_idempotencyKey: idempotencyKey},
      });
    }
    return null;
  }

  /**
   * Ensure data kind is properly formatted.
   */
  private checkDataKindFormat(data: DataObject<GenericListToEntityRelation>) {

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
  private checkDataKindValues(data: DataObject<GenericListToEntityRelation>) {

    /**
     * This function checks if the 'kind' field in the 'data' object is valid
     * for the list. Although 'kind' is required, we ensure it has a value by
     * this point. If it's not valid, we raise an error with the allowed valid
     * values for 'kind'.
    */
    const kind = data._kind ?? '';

    if (!this.kindLimitConfigReader.isKindAcceptableForListEntityRelations(kind)) {
      const validValues = this.kindLimitConfigReader.allowedKindsForEntityListRelations;

      throw new HttpErrorResponse({
        statusCode: 422,
        name: "InvalidKindError",
        message: `Relation kind '${data._kind}' is not valid. Use any of these values instead: ${validValues.join(', ')}`,
        code: "INVALID-RELATION-KIND",
        status: 422,
      });
    }
  }

  /**
   * Ensure the uniqueness of the relation.
   */
  private async checkUniquenessForRelation(data: DataObject<GenericListToEntityRelation>) {
    // Return if no uniqueness is configured
    if (!this.uniquenessConfigReader.isUniquenessConfiguredForListEntityRelations(data._kind)) {
      return;
    }

    const whereBuilder: WhereBuilder<GenericListToEntityRelation> = new WhereBuilder<GenericListToEntityRelation>();

    // Read the uniqueness fields for this kind
    const fields: string[] = this.uniquenessConfigReader.getFieldsForListEntityRelations(data._kind);
    const set = this.uniquenessConfigReader.getSetForListEntityRelations(data._kind);

    // Add uniqueness fields to the where builder
    _.forEach(fields, (field) => {
      whereBuilder.and({
        [field]: _.get(data, field),
      });
    });

    let filter = new FilterBuilder<GenericListToEntityRelation>()
      .where(whereBuilder.build())
      .build();

    // Add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericListToEntityRelation>(set, {
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
