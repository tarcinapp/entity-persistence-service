import { Getter, inject } from '@loopback/core';
import {
  Count,
  DataObject,
  DefaultCrudRepository,
  Filter,
  FilterBuilder,
  FilterExcludingWhere,
  HasManyRepositoryFactory,
  Options,
  Where,
  WhereBuilder,
  repository,
} from '@loopback/repository';
import * as crypto from 'crypto';
import _ from 'lodash';
import slugify from 'slugify';
import { EntityDbDataSource } from '../datasources';
import {
  IdempotencyConfigurationReader,
  KindConfigurationReader,
  RecordLimitsConfigurationReader,
  UniquenessConfigurationReader,
  ValidfromConfigurationReader,
  VisibilityConfigurationReader,
} from '../extensions';

import { CustomListThroughEntityRepository } from './custom-list-through-entity.repository';
import { EntityReactionsRepository } from './entity-reactions.repository';
import { FilterMatcher } from '../extensions/utils/filter-matcher';

import {
  GenericEntity,
  GenericEntityRelations,
  HttpErrorResponse,
  EntityReactions,
  SingleError,
} from '../models';
import { ListEntityRelationRepository } from './list-entity-relation.repository';
import { ListRepository } from './list.repository';

import { ResponseLimitConfigurationReader } from '../extensions/config-helpers/response-limit-config-helper';
import {
  LookupHelper,
  LookupBindings,
} from '../extensions/utils/lookup-helper';
import { SetFilterBuilder } from '../extensions/utils/set-helper';
import { UnmodifiableCommonFields } from '../models/base-types/unmodifiable-common-fields';

export class EntityRepository extends DefaultCrudRepository<
  GenericEntity,
  typeof GenericEntity.prototype._id,
  GenericEntityRelations
> {
  public readonly lists: (
    entityId: typeof GenericEntity.prototype._id,
  ) => CustomListThroughEntityRepository;

  public readonly reactions: HasManyRepositoryFactory<
    EntityReactions,
    typeof GenericEntity.prototype._id
  >;

  constructor(
    @inject('datasources.EntityDb')
    dataSource: EntityDbDataSource,

    @repository.getter('ListRepository')
    protected listRepositoryGetter: Getter<ListRepository>,

    @repository.getter('EntityReactionsRepository')
    protected reactionsRepositoryGetter: Getter<EntityReactionsRepository>,

    @repository.getter('ListEntityRelationRepository')
    protected listEntityRelationRepositoryGetter: Getter<ListEntityRelationRepository>,

    @inject('extensions.uniqueness.configurationreader')
    private uniquenessConfigReader: UniquenessConfigurationReader,

    @inject('extensions.record-limits.configurationreader')
    private recordLimitConfigReader: RecordLimitsConfigurationReader,

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
  ) {
    super(GenericEntity, dataSource);

    this.reactions = this.createHasManyRepositoryFactoryFor(
      '_reactions',
      reactionsRepositoryGetter,
    );
    this.registerInclusionResolver(
      '_reactions',
      this.reactions.inclusionResolver,
    );

    this.lists = (entityId: typeof GenericEntity.prototype._id) => {
      const repo = new CustomListThroughEntityRepository(
        this.dataSource,
        this.listRepositoryGetter,
        this.listEntityRelationRepositoryGetter,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (repo as any).sourceEntityId = entityId;

      return repo;
    };
  }

  private async processLookups(
    entities: (GenericEntity & GenericEntityRelations)[],
    filter?: Filter<GenericEntity>,
  ): Promise<(GenericEntity & GenericEntityRelations)[]> {
    if (!filter?.lookup) {
      return entities;
    }

    return this.lookupHelper.processLookupForArray(entities, filter);
  }

  private async processLookup(
    entity: GenericEntity & GenericEntityRelations,
    filter?: Filter<GenericEntity>,
  ): Promise<GenericEntity & GenericEntityRelations> {
    if (!filter?.lookup) {
      return entity;
    }

    return this.lookupHelper.processLookupForOne(entity, filter);
  }

  async find(
    filter?: Filter<GenericEntity>,
    options?: Options,
  ): Promise<(GenericEntity & GenericEntityRelations)[]> {
    const limit =
      filter?.limit ?? this.responseLimitConfigReader.getEntityResponseLimit();

    filter = {
      ...filter,
      limit: Math.min(
        limit,
        this.responseLimitConfigReader.getEntityResponseLimit(),
      ),
    };

    return super
      .find(filter, options)
      .then((entities) => this.processLookups(entities, filter));
  }

  async create(data: DataObject<GenericEntity>, options?: Options) {
    const idempotencyKey = this.calculateIdempotencyKey(data);

    return this.findIdempotentEntity(idempotencyKey).then((foundIdempotent) => {
      if (foundIdempotent) {
        return foundIdempotent;
      }

      if (idempotencyKey) {
        data._idempotencyKey = idempotencyKey;
      }

      // we do not have identical data in the db
      // go ahead, validate, enrich and create the data
      return this.createNewEntityFacade(data, options);
    });
  }

  async replaceById(id: string, data: DataObject<GenericEntity>) {
    return this.modifyIncomingEntityForUpdates(id, data)
      .then((collection) => {
        // calculate idempotencyKey
        const idempotencyKey = this.calculateIdempotencyKey(collection.data);

        // set idempotencyKey
        if (idempotencyKey) {
          collection.data._idempotencyKey = idempotencyKey;
        }

        return collection;
      })
      .then((collection) =>
        this.validateIncomingEntityForReplace(id, collection.data),
      )
      .then((validEnrichedData) => super.replaceById(id, validEnrichedData));
  }

  async updateById(
    id: string,
    data: DataObject<GenericEntity>,
    options?: Options,
  ) {
    return this.modifyIncomingEntityForUpdates(id, data)
      .then((collection) => {
        const mergedData = _.defaults(
          {},
          collection.data,
          collection.existingData,
        );

        // calculate idempotencyKey
        const idempotencyKey = this.calculateIdempotencyKey(mergedData);

        // set idempotencyKey
        if (idempotencyKey) {
          collection.data._idempotencyKey = idempotencyKey;
        }

        return collection;
      })
      .then((collection) =>
        this.validateIncomingDataForUpdate(
          id,
          collection.existingData,
          collection.data,
        ),
      )
      .then((validEnrichedData) =>
        super.updateById(id, validEnrichedData, options),
      );
  }

  async updateAll(
    data: DataObject<GenericEntity>,
    where?: Where<GenericEntity>,
    options?: Options,
  ) {
    // Check if user is trying to change the _kind field
    if (data._kind !== undefined) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableFieldError',
        message: 'Entity kind cannot be changed after creation.',
        code: 'IMMUTABLE-ENTITY-KIND',
        status: 422,
      });
    }

    const now = new Date().toISOString();
    data._lastUpdatedDateTime = now;

    this.generateSlug(data);

    this.setCountFields(data);

    return super.updateAll(data, where, options);
  }

  async deleteById(id: string, options?: Options): Promise<void> {
    const listEntityRelationRepo =
      await this.listEntityRelationRepositoryGetter();

    // delete all relations
    await listEntityRelationRepo.deleteAll({
      _entityId: id,
    });

    return super.deleteById(id, options);
  }

  async deleteAll(
    where?: Where<GenericEntity> | undefined,
    options?: Options,
  ): Promise<Count> {
    const listEntityRelationRepo =
      await this.listEntityRelationRepositoryGetter();

    // delete all relations
    await listEntityRelationRepo.deleteAll({
      _entityId: {
        inq: (
          await this.find({
            where: where,
            fields: ['_id'],
          })
        ).map((entity) => entity._id),
      },
    });

    return super.deleteAll(where, options);
  }

  private async findIdempotentEntity(
    idempotencyKey: string | undefined,
  ): Promise<GenericEntity | null> {
    // check if same record already exists
    if (_.isString(idempotencyKey) && !_.isEmpty(idempotencyKey)) {
      // try to find if a record with this idempotency key is already created
      const sameRecord = this.findOne({
        where: {
          and: [
            {
              _idempotencyKey: idempotencyKey,
            },
          ],
        },
      });

      // if record already created return the existing record as if it newly created
      return sameRecord;
    }

    return Promise.resolve(null);
  }

  calculateIdempotencyKey(data: DataObject<GenericEntity>) {
    const idempotencyFields =
      this.idempotencyConfigReader.getIdempotencyForEntities(data._kind);

    // idempotency is not configured
    if (idempotencyFields.length === 0) {
      return;
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

  /**
   * Validates the incoming data, enriches with managed fields then calls super.create
   *
   * @param data Input object to create entity from.
   * @returns Newly created entity.
   */
  private async createNewEntityFacade(
    data: DataObject<GenericEntity>,
    options?: Options,
  ): Promise<GenericEntity> {
    /**
     * TODO: MongoDB connector still does not support transactions.
     * Comment out here when we receive transaction support.
     * Then we need to pass the trx to the methods down here.
     */
    /*
    const trxRepo = new DefaultTransactionalRepository(GenericEntity, this.dataSource);
    const trx = await trxRepo.beginTransaction(IsolationLevel.READ_COMMITTED);
    */

    return this.modifyIncomingEntityForCreation(data)
      .then((enrichedData) =>
        this.validateIncomingEntityForCreation(enrichedData),
      )
      .then((validEnrichedData) => super.create(validEnrichedData, options));
  }

  private async validateIncomingEntityForCreation(
    data: DataObject<GenericEntity>,
  ): Promise<DataObject<GenericEntity>> {
    this.checkDataKindFormat(data);
    this.checkDataKindValues(data);

    return Promise.all([
      this.checkUniquenessForCreate(data),
      this.checkRecordLimits(data),
    ]).then(() => {
      return data;
    });
  }

  private async validateIncomingEntityForReplace(
    id: string,
    data: DataObject<GenericEntity>,
  ) {
    // Get the existing entity to check if _kind is being changed
    const existingEntity = await this.findById(id);

    // Check if user is trying to change the _kind field
    if (data._kind !== undefined && data._kind !== existingEntity._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableFieldError',
        message: `Entity kind cannot be changed after creation. Current kind is '${existingEntity._kind}'.`,
        code: 'IMMUTABLE-ENTITY-KIND',
        status: 422,
      });
    }

    const uniquenessCheck = this.checkUniquenessForUpdate(id, data);

    await uniquenessCheck;

    return data;
  }

  private async validateIncomingDataForUpdate(
    id: string,
    existingData: DataObject<GenericEntity>,
    data: DataObject<GenericEntity>,
  ) {
    // Check if user is trying to change the _kind field
    if (data._kind !== undefined && data._kind !== existingData._kind) {
      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'ImmutableFieldError',
        message: `Entity kind cannot be changed after creation. Current kind is '${existingData._kind}'.`,
        code: 'IMMUTABLE-ENTITY-KIND',
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

    this.generateSlug(data);
    this.setCountFields(data);

    await uniquenessCheck;

    return data;
  }

  /**
   * Modifies the incoming payload according to the managed fields policies and configuration.
   * ---
   * Sets these fields if absent:
   * - slug
   * - creationDateTime
   * - lastUpdatedDateTime
   * - validFromDateTime (according to the configuration)
   *
   * Always sets these fields ignoring their incoming values:
   * - version
   * - visibility (according to the configuration)
   * - ownerGroupsCount
   * - ownerUsersCount
   * - viewerUsersCount
   * - viewerGroupsCount
   *
   * Always clears these fields as they are readonly through relation.
   * - relationMetadata
   *
   * @param data Data that is intended to be created
   * @returns New version of the data which have managed fields are added
   */
  private async modifyIncomingEntityForCreation(
    data: DataObject<GenericEntity>,
  ): Promise<DataObject<GenericEntity>> {
    data._kind =
      data._kind ??
      process.env.default_entity_kind ??
      this.kindConfigReader.defaultEntityKind;

    // take the date of now to make sure we have exactly the same date in all date fields
    const now = new Date().toISOString();

    // use incoming creationDateTime and lastUpdateDateTime if given. Override with default if it does not exist.
    data._createdDateTime = data._createdDateTime ? data._createdDateTime : now;
    data._lastUpdatedDateTime = data._lastUpdatedDateTime
      ? data._lastUpdatedDateTime
      : now;

    // autoapprove the record if it is configured
    const shouldAutoApprove =
      this.validfromConfigReader.getValidFromForEntities(data._kind);
    data._validFromDateTime =
      data._validFromDateTime ?? (shouldAutoApprove ? now : undefined);

    // we need to explicitly set validUntilDateTime to null if it is not provided
    // to make filter matcher work correctly while checking record limits
    data._validUntilDateTime = data._validUntilDateTime ?? null;

    // new data is starting from version 1
    data._version = 1;

    // set visibility
    data._visibility = data._visibility
      ? data._visibility
      : this.visibilityConfigReader.getVisibilityForEntities(data._kind);

    // prepare slug from the name and set to the record
    this.generateSlug(data);

    // set owners count to make searching easier
    this.setCountFields(data);

    _.unset(data, '_relationMetadata');

    return data;
  }

  /**
   * Modifies the original record with managed fields where applicable.
   * This method can be used by replace and update operations as their requirements are same.
   * @param id Id of the targeted record
   * @param data Payload of the entity
   * @returns Enriched entity
   */
  private async modifyIncomingEntityForUpdates(
    id: string,
    data: DataObject<GenericEntity>,
  ) {
    return this.findById(id)
      .then((existingData) => {
        // check if we have this record in db
        if (!existingData) {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: 'NotFoundError',
            message: "Entity with id '" + id + "' could not be found.",
            code: 'ENTITY-NOT-FOUND',
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

        _.unset(data, '_relationMetadata');

        return {
          data: data,
          existingData: existingData,
        };
      });
  }

  private async checkRecordLimits(newData: DataObject<GenericEntity>) {
    if (
      !this.recordLimitConfigReader.isRecordLimitsConfiguredForEntities(
        newData._kind,
      )
    ) {
      return;
    }

    const limit = this.recordLimitConfigReader.getRecordLimitsCountForEntities(
      newData._kind,
    );
    const set = this.recordLimitConfigReader.getRecordLimitsSetForEntities(
      newData._ownerUsers,
      newData._ownerGroups,
      newData._kind,
    );
    let filterBuilder: FilterBuilder<GenericEntity>;

    if (
      this.recordLimitConfigReader.isLimitConfiguredForKindForEntities(
        newData._kind,
      )
    ) {
      filterBuilder = new FilterBuilder<GenericEntity>({
        where: {
          _kind: newData._kind,
        },
      });
    } else {
      filterBuilder = new FilterBuilder<GenericEntity>();
    }

    let filter = filterBuilder.build();

    // add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();

      // Check if the new record would match the set filter
      if (!this.wouldRecordMatchFilter(newData, filter.where)) {
        // Record wouldn't be part of the set, no need to check limits
        return;
      }
    }

    const currentCount = await this.count(filter.where);

    if (currentCount.count >= limit!) {
      throw new HttpErrorResponse({
        statusCode: 429,
        name: 'LimitExceededError',
        message: `Entity limit is exceeded.`,
        code: 'ENTITY-LIMIT-EXCEEDED',
        status: 429,
        details: [
          new SingleError({
            code: 'ENTITY-LIMIT-EXCEEDED',
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
    record: DataObject<GenericEntity>,
    whereClause: Where<GenericEntity> | undefined,
  ): boolean {
    return FilterMatcher.matches(record, whereClause);
  }

  private generateSlug(data: DataObject<GenericEntity>) {
    if (data._name && !data._slug) {
      data._slug = slugify(data._name ?? '', { lower: true, strict: true });
    }
  }

  private setCountFields(data: DataObject<GenericEntity>) {
    // Always set count fields based on their corresponding arrays
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

  private checkDataKindFormat(data: DataObject<GenericEntity>) {
    // make sure data kind is slug format
    if (data._kind) {
      const slugKind: string = slugify(data._kind, {
        lower: true,
        strict: true,
      });

      if (slugKind !== data._kind) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: 'InvalidKindError',
          message: `Entity kind cannot contain special or uppercase characters. Use '${slugKind}' instead.`,
          code: 'INVALID-ENTITY-KIND',
          status: 422,
        });
      }
    }
  }

  private checkDataKindValues(data: DataObject<GenericEntity>) {
    if (
      data._kind &&
      !this.kindConfigReader.isKindAcceptableForEntity(data._kind)
    ) {
      const validValues = this.kindConfigReader.allowedKindsForEntities;

      throw new HttpErrorResponse({
        statusCode: 422,
        name: 'InvalidKindError',
        message: `Entity kind '${data._kind}' is not valid. Use any of these values instead: ${validValues.join(', ')}`,
        code: 'INVALID-ENTITY-KIND',
        status: 422,
      });
    }
  }

  private async checkUniquenessForCreate(newData: DataObject<GenericEntity>) {
    // return if no uniqueness is configured
    if (
      !this.uniquenessConfigReader.isUniquenessConfiguredForEntities(
        newData._kind,
      )
    ) {
      return;
    }

    const whereBuilder: WhereBuilder<GenericEntity> =
      new WhereBuilder<GenericEntity>();

    // read the fields (name, slug) array for this kind
    const fields: string[] = this.uniquenessConfigReader.getFieldsForEntities(
      newData._kind,
    );
    const set = this.uniquenessConfigReader.getSetForEntities(
      newData._ownerUsers,
      newData._ownerGroups,
      newData._kind,
    );

    // add uniqueness fields to where builder
    _.forEach(fields, (field) => {
      whereBuilder.and({
        [field]: _.get(newData, field),
      });
    });

    let filter = new FilterBuilder<GenericEntity>()
      .where(whereBuilder.build())
      .build();

    // add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
    }

    const existingEntity = await super.findOne(filter);

    if (existingEntity) {
      throw new HttpErrorResponse({
        statusCode: 409,
        name: 'DataUniquenessViolationError',
        message: 'Entity already exists.',
        code: 'ENTITY-ALREADY-EXISTS',
        status: 409,
      });
    }
  }

  private async checkUniquenessForUpdate(
    id: string,
    newData: DataObject<GenericEntity>,
  ) {
    if (
      !this.uniquenessConfigReader.isUniquenessConfiguredForEntities(
        newData._kind,
      )
    ) {
      return;
    }

    const whereBuilder: WhereBuilder<GenericEntity> =
      new WhereBuilder<GenericEntity>();

    // read the fields (name, slug) array for this kind
    const fields: string[] = this.uniquenessConfigReader.getFieldsForEntities(
      newData._kind,
    );
    const set = this.uniquenessConfigReader.getSetForEntities(
      newData._ownerUsers,
      newData._ownerGroups,
      newData._kind,
    );

    _.forEach(fields, (field) => {
      whereBuilder.and({
        [field]: _.get(newData, field),
      });
    });

    // this is for preventing the same data to be returned
    whereBuilder.and({
      _id: {
        neq: id,
      },
    });

    let filter = new FilterBuilder<GenericEntity>()
      .where(whereBuilder.build())
      .fields('_id')
      .build();

    // add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
    }

    // final uniqueness controlling filter
    //console.log('Uniqueness Filter: ', JSON.stringify(filter));

    const violatingEntity = await super.findOne(filter);

    if (violatingEntity) {
      throw new HttpErrorResponse({
        statusCode: 409,
        name: 'DataUniquenessViolationError',
        message: 'Entity already exists.',
        code: 'ENTITY-ALREADY-EXISTS',
        status: 409,
      });
    }
  }

  async findById(
    id: string,
    filter?: FilterExcludingWhere<GenericEntity>,
    options?: Options,
  ): Promise<GenericEntity & GenericEntityRelations> {
    return super
      .findById(id, filter, options)
      .catch(() => null)
      .then((entity) => {
        if (!entity) {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: 'NotFoundError',
            message: "Entity with id '" + id + "' could not be found.",
            code: 'ENTITY-NOT-FOUND',
            status: 404,
          });
        }

        return entity;
      })
      .then((entity) => this.processLookup(entity, filter));
  }

  async findParents(
    entityId: string,
    filter?: Filter<GenericEntity>,
    options?: Options,
  ): Promise<(GenericEntity & GenericEntityRelations)[]> {
    // First, get the entity's parent references
    const entity = await this.findById(entityId, {
      fields: { _parents: true },
    });

    if (!entity) {
      throw new HttpErrorResponse({
        statusCode: 404,
        name: 'NotFoundError',
        message: "Entity with id '" + entityId + "' could not be found.",
        code: 'ENTITY-NOT-FOUND',
        status: 404,
      });
    }

    if (!entity._parents || entity._parents.length === 0) {
      return [];
    }

    // Extract parent IDs from the URIs
    const parentIds = entity._parents.map((uri: string) =>
      uri.split('/').pop(),
    );

    // Create a new filter that includes the parent IDs
    const parentFilter: Filter<GenericEntity> = {
      ...filter,
      where: {
        and: [
          { _id: { inq: parentIds } },
          ...(filter?.where ? [filter.where] : []),
        ],
      },
    };

    return this.find(parentFilter, options);
  }

  async findChildren(
    entityId: string,
    filter?: Filter<GenericEntity>,
    options?: Options,
  ): Promise<(GenericEntity & GenericEntityRelations)[]> {
    // First verify that the entity exists
    const entity = await this.findById(entityId, {
      fields: { _id: true },
    });

    if (!entity) {
      throw new HttpErrorResponse({
        statusCode: 404,
        name: 'NotFoundError',
        message: "Entity with id '" + entityId + "' could not be found.",
        code: 'ENTITY-NOT-FOUND',
        status: 404,
      });
    }

    const uri = `tapp://localhost/entities/${entityId}`;

    // Create a filter to find entities where _parents contains the given entityId
    const childFilter: Filter<GenericEntity> = {
      ...filter,
      where: {
        and: [{ _parents: uri }, ...(filter?.where ? [filter.where] : [])],
      },
    };

    return this.find(childFilter, options);
  }

  async createChild(
    parentId: string,
    entity: Omit<GenericEntity, UnmodifiableCommonFields | '_parents'>,
  ): Promise<GenericEntity> {
    // First verify that the parent exists
    await this.findById(parentId);

    // Add the parent reference to the entity
    const childEntity = {
      ...entity,
      _parents: [`tapp://localhost/entities/${parentId}`],
    };

    // Create the child entity
    return this.create(childEntity);
  }
}
