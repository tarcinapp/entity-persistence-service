import {Getter, inject} from '@loopback/core';
import {DataObject, DefaultCrudRepository, Filter, FilterBuilder, HasManyRepositoryFactory, HasManyThroughRepositoryFactory, Options, Where, WhereBuilder, repository} from '@loopback/repository';
import {Request, RestBindings} from '@loopback/rest';
import _ from 'lodash';
import slugify from "slugify";
import {EntityDbDataSource} from '../datasources';
import {RecordLimitsConfigurationReader, UniquenessConfigurationReader} from '../extensions';
import {KindLimitsConfigurationReader} from '../extensions/kind-limits';
import {SetFilterBuilder} from '../extensions/set';
import {GenericEntity, GenericEntityRelations, HttpErrorResponse, Reactions, Relation, SingleError, Tag, TagEntityRelation} from '../models';
import {ReactionsRepository} from './reactions.repository';
import {RelationRepository} from './relation.repository';
import {TagEntityRelationRepository} from './tag-entity-relation.repository';
import {TagRepository} from './tag.repository';

export class GenericEntityRepository extends DefaultCrudRepository<
  GenericEntity,
  typeof GenericEntity.prototype.id,
  GenericEntityRelations
> {

  public readonly relations: HasManyRepositoryFactory<Relation, typeof GenericEntity.prototype.id>;

  public readonly reactions: HasManyRepositoryFactory<Reactions, typeof GenericEntity.prototype.id>;

  public readonly tags: HasManyThroughRepositoryFactory<Tag, typeof Tag.prototype.id,
    TagEntityRelation,
    typeof GenericEntity.prototype.id
  >;

  private static response_limit = _.parseInt(process.env.response_limit_entity || "50");

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource, @repository.getter('RelationRepository') protected relationRepositoryGetter: Getter<RelationRepository>, @repository.getter('ReactionsRepository') protected reactionsRepositoryGetter: Getter<ReactionsRepository>, @repository.getter('TagEntityRelationRepository') protected tagEntityRelationRepositoryGetter: Getter<TagEntityRelationRepository>, @repository.getter('TagRepository') protected tagRepositoryGetter: Getter<TagRepository>,
    @inject('extensions.uniqueness.configurationreader') private uniquenessConfigReader: UniquenessConfigurationReader,
    @inject('extensions.record-limits.configurationreader') private recordLimitConfigReader: RecordLimitsConfigurationReader,
    @inject('extensions.kind-limits.configurationreader') private kindLimitConfigReader: KindLimitsConfigurationReader,
    @inject(RestBindings.Http.REQUEST) private request: Request,
  ) {
    super(GenericEntity, dataSource);
    this.tags = this.createHasManyThroughRepositoryFactoryFor('tags', tagRepositoryGetter, tagEntityRelationRepositoryGetter,);
    this.reactions = this.createHasManyRepositoryFactoryFor('reactions', reactionsRepositoryGetter,);
    this.registerInclusionResolver('reactions', this.reactions.inclusionResolver);
    this.relations = this.createHasManyRepositoryFactoryFor('relations', relationRepositoryGetter,);
    this.registerInclusionResolver('relations', this.relations.inclusionResolver);
  }

  async find(filter?: Filter<GenericEntity>, options?: Options) {

    // Calculate the limit value using optional chaining and nullish coalescing
    // If filter.limit is defined, use its value; otherwise, use GenericEntityRepository.response_limit
    const limit = filter?.limit || GenericEntityRepository.response_limit;

    // Update the filter object by spreading the existing filter and overwriting the limit property
    // Ensure that the new limit value does not exceed GenericEntityRepository.response_limit
    filter = {...filter, limit: Math.min(limit, GenericEntityRepository.response_limit)};

    return super.find(filter, options);
  }

  async create(data: DataObject<GenericEntity>) {

    const idempotencyKey: string | undefined = this.request.headers['idempotencykey'] as string | undefined;

    // check if same record already exists
    if (_.isString(idempotencyKey) && !_.isEmpty(idempotencyKey)) {

      // try to find if a record with this idempotency key is already created
      const sameRecord = await this.findOne({
        where: {
          and: [
            {
              idempotencyKey: idempotencyKey
            }
          ]
        }
      });

      // if record already created return the existing record as if it newly created
      if (sameRecord) {
        return sameRecord;
      }
    }

    data.idempotencyKey = idempotencyKey;

    this.checkDataKindFormat(data);

    this.checkDataKindValues(data);

    // take the date of now to make sure we have exactly the same date in all date fields
    let now = new Date().toISOString();

    // use incoming creationDateTime and lastUpdateDateTime if given. Override with default if it does not exist.
    data.creationDateTime = data.creationDateTime ? data.creationDateTime : now;
    data.lastUpdatedDateTime = data.lastUpdatedDateTime ? data.lastUpdatedDateTime : now;

    // autoapprove the record if it is configured
    data.validFromDateTime = process.env.autoapprove_entity == 'true' ? now : undefined;

    this.generateSlug(data);

    this.setOwnersCount(data);

    await this.checkUniquenessForCreate(data);

    await this.checkRecordLimits(data);

    // set version to 1.
    data.version = 1;

    return super.create(data);
  }

  async replaceById(id: string, data: DataObject<GenericEntity>, options?: Options) {

    let now = new Date().toISOString();
    let existingData = await this.findById(id);

    // set new version
    data.version = (existingData.version ?? 1) + 1;


    // we may use current date, if it does not exist in the given data
    data.lastUpdatedDateTime = data.lastUpdatedDateTime ? data.lastUpdatedDateTime : now;

    this.checkDataKindValues(data);

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    await this.checkRecordLimits(data);

    await this.checkUniquenessForUpdate(id, data);

    return super.replaceById(id, data, options);
  }

  async updateById(id: string, data: DataObject<GenericEntity>, options?: Options) {

    let existingData = await this.findById(id);

    // set new version
    data.version = (existingData.version ?? 1) + 1;

    // we may use current date, if it does not exist in the given data
    let now = new Date().toISOString();

    // gateway may allow user to modify lastUpdatedDateTime. If it is not given, set `now` as lastUpdatedDateTime.
    data.lastUpdatedDateTime = data.lastUpdatedDateTime ? data.lastUpdatedDateTime : now;

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    // we need to merge existing data with incoming data in order to check limits and uniquenesses
    let mergedData = _.defaults({}, data, existingData);

    // check if kind is correct, if it is given
    if (data.kind)
      this.checkDataKindValues(data);

    await this.checkRecordLimits(mergedData);

    await this.checkUniquenessForUpdate(id, mergedData);

    return super.updateById(id, data, options);
  }

  async updateAll(data: DataObject<GenericEntity>, where?: Where<GenericEntity>, options?: Options) {

    let now = new Date().toISOString();
    data.lastUpdatedDateTime = now;

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    return super.updateAll(data, where, options);
  }

  private async checkRecordLimits(newData: DataObject<GenericEntity>) {

    if (!this.recordLimitConfigReader.isRecordLimitsConfiguredForEntities(newData.kind))
      return;

    let limit = this.recordLimitConfigReader.getRecordLimitsCountForEntities(newData.kind)
    let set = this.recordLimitConfigReader.getRecordLimitsSetForEntities(newData.ownerUsers, newData.ownerGroups, newData.kind);
    let filterBuilder: FilterBuilder<GenericEntity>;

    if (this.recordLimitConfigReader.isLimitConfiguredForKindForEntities(newData.kind))
      filterBuilder = new FilterBuilder<GenericEntity>({
        where: {
          kind: newData.kind
        }
      })
    else {
      filterBuilder = new FilterBuilder<GenericEntity>()
    }

    let filter = filterBuilder.build();

    // add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter
      })
        .build();
    }

    let currentCount = await this.count(filter.where);

    if (currentCount.count >= limit!) {
      throw new HttpErrorResponse({
        statusCode: 403,
        name: "LimitExceededError",
        message: `Entity limit is exceeded.`,
        code: "ENTITY-LIMIT-EXCEEDED",
        status: 403,
        details: [new SingleError({
          code: "ENTITY-LIMIT-EXCEEDED",
          info: {
            limit: limit
          }
        })]
      });
    }

  }

  private generateSlug(data: DataObject<GenericEntity>) {

    if (data.name && !data.slug)
      data.slug = slugify(data.name ?? '', {lower: true, strict: true});
  }

  private setOwnersCount(data: DataObject<GenericEntity>) {

    if (_.isArray(data.ownerUsers))
      data.ownerUsersCount = data.ownerUsers?.length;

    if (_.isArray(data.ownerGroups))
      data.ownerGroupsCount = data.ownerGroups?.length;
  }

  private checkDataKindFormat(data: DataObject<GenericEntity>) {

    // make sure data kind is slug format
    if (data.kind) {
      let slugKind: string = slugify(data.kind, {lower: true, strict: true});

      if (slugKind != data.kind) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: "InvalidKindError",
          message: `Entity kind cannot contain special or uppercase characters. Use '${slugKind}' instead.`,
          code: "INVALID-ENTITY-KIND",
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
    let kind = data.kind || '';

    if (!this.kindLimitConfigReader.isKindAcceptableForEntity(kind)) {
      let validValues = this.kindLimitConfigReader.allowedKindsForEntities;

      throw new HttpErrorResponse({
        statusCode: 422,
        name: "InvalidKindError",
        message: `Entity kind '${data.kind}' is not valid. Use any of these values instead: ${validValues.join(', ')}`,
        code: "INVALID-ENTITY-KIND",
        status: 422,
      });
    }
  }

  private async checkUniquenessForCreate(newData: DataObject<GenericEntity>) {

    // return if no uniqueness is configured
    if (!this.uniquenessConfigReader.isUniquenessConfiguredForEntities(newData.kind))
      return;

    let whereBuilder: WhereBuilder<GenericEntity> = new WhereBuilder<GenericEntity>();

    // read the fields (name, slug) array for this kind
    let fields: string[] = this.uniquenessConfigReader.getFieldsForEntities(newData.kind);
    let set = this.uniquenessConfigReader.getSetForEntities(newData.ownerUsers, newData.ownerGroups, newData.kind);

    // add uniqueness fields to where builder
    _.forEach(fields, (field) => {

      whereBuilder.and({
        [field]: _.get(newData, field)
      });
    });

    let filter = new FilterBuilder<GenericEntity>()
      .where(whereBuilder.build())
      .build();

    // add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter
      })
        .build();
    }

    // final uniqueness controlling filter
    console.log('Uniqueness Filter: ', JSON.stringify(filter));

    let existingEntity = await super.findOne(filter);

    if (existingEntity) {

      throw new HttpErrorResponse({
        statusCode: 409,
        name: "DataUniquenessViolationError",
        message: "Entity already exists.",
        code: "ENTITY-ALREADY-EXISTS",
        status: 409,
      });
    }
  }

  private async checkUniquenessForUpdate(id: string, newData: DataObject<GenericEntity>) {

    if (!this.uniquenessConfigReader.isUniquenessConfiguredForEntities(newData.kind))
      return;

    let whereBuilder: WhereBuilder<GenericEntity> = new WhereBuilder<GenericEntity>();

    // read the fields (name, slug) array for this kind
    let fields: string[] = this.uniquenessConfigReader.getFieldsForEntities(newData.kind);
    let set = this.uniquenessConfigReader.getSetForEntities(newData.ownerUsers, newData.ownerGroups, newData.kind);

    _.forEach(fields, (field) => {

      whereBuilder.and({
        [field]: _.get(newData, field)
      });
    });

    // this is for preventing the same data to be returned
    whereBuilder.and({
      id: {
        neq: id
      }
    });

    let filter = new FilterBuilder<GenericEntity>()
      .where(whereBuilder.build())
      .fields('id')
      .build();

    // add set filter if configured
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter
      })
        .build();
    }

    // final uniqueness controlling filter
    console.log('Uniqueness Filter: ', JSON.stringify(filter));

    let violatingEntity = await super.findOne(filter);

    if (violatingEntity) {

      throw new HttpErrorResponse({
        statusCode: 409,
        name: "DataUniquenessViolationError",
        message: "Entity already exists.",
        code: "ENTITY-ALREADY-EXISTS",
        status: 409,
      });
    }
  }
}
