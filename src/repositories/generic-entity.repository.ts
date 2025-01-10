import { Getter, inject } from '@loopback/core';
import {
  Count,
  DataObject,
  DefaultCrudRepository,
  Filter,
  FilterBuilder,
  HasManyRepositoryFactory,
  HasManyThroughRepositoryFactory,
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
  RecordLimitsConfigurationReader,
  UniquenessConfigurationReader,
} from '../extensions';
import { KindLimitsConfigurationReader } from '../extensions/kind-limits';
import { SetFilterBuilder } from '../extensions/set';
import { ValidfromConfigurationReader } from '../extensions/validfrom-config-reader';
import { VisibilityConfigurationReader } from '../extensions/visibility';
import {
  EntityRelation,
  GenericEntity,
  GenericEntityRelations,
  HttpErrorResponse,
  Reactions,
  SingleError,
  Tag,
  TagEntityRelation,
} from '../models';
import { GenericListEntityRelationRepository } from './generic-list-entity-relation.repository';
import { ReactionsRepository } from './reactions.repository';
import { RelationRepository } from './relation.repository';
import { TagEntityRelationRepository } from './tag-entity-relation.repository';
import { TagRepository } from './tag.repository';

export class GenericEntityRepository extends DefaultCrudRepository<
  GenericEntity,
  typeof GenericEntity.prototype._id,
  GenericEntityRelations
> {
  public readonly children: HasManyRepositoryFactory<
    EntityRelation,
    typeof GenericEntity.prototype._id
  >;

  public readonly reactions: HasManyRepositoryFactory<
    Reactions,
    typeof GenericEntity.prototype._id
  >;

  public readonly tags: HasManyThroughRepositoryFactory<
    Tag,
    typeof Tag.prototype.id,
    TagEntityRelation,
    typeof GenericEntity.prototype._id
  >;

  private static responseLimit = _.parseInt(
    process.env.response_limit_entity ?? '50',
  );

  constructor(
    @inject('datasources.EntityDb')
    dataSource: EntityDbDataSource,

    @repository.getter('RelationRepository')
    protected relationRepositoryGetter: Getter<RelationRepository>,

    @repository.getter('ReactionsRepository')
    protected reactionsRepositoryGetter: Getter<ReactionsRepository>,

    @repository.getter('TagEntityRelationRepository')
    protected tagEntityRelationRepositoryGetter: Getter<TagEntityRelationRepository>,

    @repository.getter('TagRepository')
    protected tagRepositoryGetter: Getter<TagRepository>,

    @repository.getter('GenericListEntityRelationRepository')
    protected listEntityRelationRepositoryGetter: Getter<GenericListEntityRelationRepository>,

    @inject('extensions.uniqueness.configurationreader')
    private uniquenessConfigReader: UniquenessConfigurationReader,

    @inject('extensions.record-limits.configurationreader')
    private recordLimitConfigReader: RecordLimitsConfigurationReader,

    @inject('extensions.kind-limits.configurationreader')
    private kindLimitConfigReader: KindLimitsConfigurationReader,

    @inject('extensions.visibility.configurationreader')
    private visibilityConfigReader: VisibilityConfigurationReader,

    @inject('extensions.validfrom.configurationreader')
    private validfromConfigReader: ValidfromConfigurationReader,

    @inject('extensions.idempotency.configurationreader')
    private idempotencyConfigReader: IdempotencyConfigurationReader,
  ) {
    super(GenericEntity, dataSource);
    this.tags = this.createHasManyThroughRepositoryFactoryFor(
      'tags',
      tagRepositoryGetter,
      tagEntityRelationRepositoryGetter,
    );
    this.reactions = this.createHasManyRepositoryFactoryFor(
      '_reactions',
      reactionsRepositoryGetter,
    );
    this.registerInclusionResolver(
      '_reactions',
      this.reactions.inclusionResolver,
    );
    this.children = this.createHasManyRepositoryFactoryFor(
      '_children',
      relationRepositoryGetter,
    );
    this.registerInclusionResolver(
      '_children',
      this.children.inclusionResolver,
    );
  }

  async find(filter?: Filter<GenericEntity>, options?: Options) {
    // Calculate the limit value using optional chaining and nullish coalescing
    // If filter.limit is defined, use its value; otherwise, use GenericEntityRepository.response_limit
    const limit = filter?.limit ?? GenericEntityRepository.responseLimit;

    // Update the filter object by spreading the existing filter and overwriting the limit property
    // Ensure that the new limit value does not exceed GenericEntityRepository.response_limit
    filter = {
      ...filter,
      limit: Math.min(limit, GenericEntityRepository.responseLimit),
    };

    return super.find(filter, options);
  }

  async create(data: DataObject<GenericEntity>, options?: Options) {
    const idempotencyKey = this.calculateIdempotencyKey(data);

    return this.findIdempotentEntity(idempotencyKey).then((foundIdempotent) => {
      if (foundIdempotent) {
        return foundIdempotent;
      }

      data._idempotencyKey = idempotencyKey;

      // we do not have identical data in the db
      // go ahead, validate, enrich and create the data
      return this.createNewEntityFacade(data);
    });
  }

  async replaceById(
    id: string,
    data: DataObject<GenericEntity>,
    options?: Options,
  ) {
    return this.modifyIncomingEntityForUpdates(id, data)
      .then((collection) => {
        // calculate idempotencyKey
        const idempotencyKey = this.calculateIdempotencyKey(collection.data);

        // set idempotencyKey
        collection.data._idempotencyKey = idempotencyKey;

        return collection;
      })
      .then((collection) =>
        this.validateIncomingEntityForReplace(id, collection.data, options),
      )
      .then((validEnrichedData) =>
        super.replaceById(id, validEnrichedData, options),
      );
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
        collection.data._idempotencyKey = idempotencyKey;

        return collection;
      })
      .then((collection) =>
        this.validateIncomingDataForUpdate(
          id,
          collection.existingData,
          collection.data,
          options,
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
    const now = new Date().toISOString();
    data._lastUpdatedDateTime = now;

    this.checkDataKindFormat(data);

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
    if (idempotencyFields.length === 0) return;

    const fieldValues = idempotencyFields.map((idempotencyField) => {
      const value = _.get(data, idempotencyField);
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
      .then((validEnrichedData) => super.create(validEnrichedData));
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
    options?: Options,
  ) {
    const uniquenessCheck = this.checkUniquenessForUpdate(id, data);

    this.checkDataKindValues(data);
    this.checkDataKindFormat(data);

    await uniquenessCheck;

    return data;
  }

  private async validateIncomingDataForUpdate(
    id: string,
    existingData: DataObject<GenericEntity>,
    data: DataObject<GenericEntity>,
    options?: Options,
  ) {
    // we need to merge existing data with incoming data in order to check limits and uniquenesses
    const mergedData = _.assign(
      {},
      existingData && _.pickBy(existingData, (value) => value != null),
      data,
    );
    const uniquenessCheck = this.checkUniquenessForUpdate(id, mergedData);

    if (data._kind) {
      this.checkDataKindFormat(data);
      this.checkDataKindValues(data);
    }

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
      this.kindLimitConfigReader.defaultEntityKind;

    // take the date of now to make sure we have exactly the same date in all date fields
    const now = new Date().toISOString();

    // use incoming creationDateTime and lastUpdateDateTime if given. Override with default if it does not exist.
    data._createdDateTime = data._createdDateTime ? data._createdDateTime : now;
    data._lastUpdatedDateTime = data._lastUpdatedDateTime
      ? data._lastUpdatedDateTime
      : now;

    // autoapprove the record if it is configured
    data._validFromDateTime =
      this.validfromConfigReader.getValidFromForEntities(data._kind)
        ? now
        : undefined;

    // new data is starting from version 1
    data._version = 1;

    // set visibility
    data._visibility = this.visibilityConfigReader.getVisibilityForEntities(
      data._kind,
    );

    // prepare slug from the name and set to the record
    this.generateSlug(data);

    // set owners count to make searching easier
    this.setCountFields(data);

    _.unset(data, 'relationMetadata');

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
    )
      return;

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
    )
      filterBuilder = new FilterBuilder<GenericEntity>({
        where: {
          _kind: newData._kind,
        },
      });
    else {
      filterBuilder = new FilterBuilder<GenericEntity>();
    }

    let filter = filterBuilder.build();

    // add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
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

  private generateSlug(data: DataObject<GenericEntity>) {
    if (data._name && !data._slug)
      data._slug = slugify(data._name ?? '', { lower: true, strict: true });
  }

  private setCountFields(data: DataObject<GenericEntity>) {
    if (_.isArray(data._ownerUsers))
      data._ownerUsersCount = data._ownerUsers?.length;

    if (_.isArray(data._ownerGroups))
      data._ownerGroupsCount = data._ownerGroups?.length;

    if (_.isArray(data._viewerUsers))
      data._viewerUsersCount = data._viewerUsers?.length;

    if (_.isArray(data._viewerGroups))
      data._viewerGroupsCount = data._viewerGroups?.length;
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
    /**
     * This function checks if the 'kind' field in the 'data' object is valid
     * for the entity. Although 'kind' is required, we ensure it has a value by
     * this point. If it's not valid, we raise an error with the allowed valid
     * values for 'kind'.
     */
    const kind = data._kind ?? '';

    if (!this.kindLimitConfigReader.isKindAcceptableForEntity(kind)) {
      const validValues = this.kindLimitConfigReader.allowedKindsForEntities;

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
    )
      return;

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
    )
      return;

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
}
