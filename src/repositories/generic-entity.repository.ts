import {Getter, inject} from '@loopback/core';
import {DataObject, DefaultCrudRepository, Filter, FilterBuilder, HasManyRepositoryFactory, HasManyThroughRepositoryFactory, Options, repository, Where, WhereBuilder} from '@loopback/repository';
import _ from 'lodash';
import slugify from "slugify";
import {EntityDbDataSource} from '../datasources';
import {RecordLimitsConfigurationReader, UniquenessConfigurationReader} from '../extensions';
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
    @inject('extensions.record-limits.configurationreader') private recordLimitConfigReader: RecordLimitsConfigurationReader
  ) {
    super(GenericEntity, dataSource);
    this.tags = this.createHasManyThroughRepositoryFactoryFor('tags', tagRepositoryGetter, tagEntityRelationRepositoryGetter,);
    this.reactions = this.createHasManyRepositoryFactoryFor('reactions', reactionsRepositoryGetter,);
    this.registerInclusionResolver('reactions', this.reactions.inclusionResolver);
    this.relations = this.createHasManyRepositoryFactoryFor('relations', relationRepositoryGetter,);
    this.registerInclusionResolver('relations', this.relations.inclusionResolver);
  }

  async find(filter?: Filter<GenericEntity>, options?: Options) {

    if (filter?.limit && filter.limit > GenericEntityRepository.response_limit)
      filter.limit = GenericEntityRepository.response_limit;

    return super.find(filter, options);
  }

  async create(data: DataObject<GenericEntity>) {

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    await this.checkUniquenessForCreate(data);

    await this.checkRecordLimits(data);

    return super.create(data);
  }

  async replaceById(id: string, data: DataObject<GenericEntity>, options?: Options) {

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    await this.checkUniquenessForUpdate(id, data);

    return super.replaceById(id, data, options);
  }

  async updateById(id: string, data: DataObject<GenericEntity>, options?: Options) {

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    await this.checkUniquenessForUpdate(id, data);

    return super.updateById(id, data, options);
  }

  async updateAll(data: DataObject<GenericEntity>, where?: Where<GenericEntity>, options?: Options) {

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    return super.updateAll(data, where, options);
  }

  private async checkRecordLimits(newData: DataObject<GenericEntity>) {

    if (!this.recordLimitConfigReader.isRecordLimitsConfiguredForEntities(newData.kind))
      return;

    let limit = this.recordLimitConfigReader.getRecordLimitsCountForEntities(newData.kind)
    let set = this.uniquenessConfigReader.getSetForEntities(newData.ownerUsers, newData.ownerGroups, newData.kind);
    let whereBuilder: WhereBuilder<GenericEntity> = new WhereBuilder<GenericEntity>();

    if (this.recordLimitConfigReader.isLimitConfiguredForKindForEntities(newData.kind))
      whereBuilder.and({
        kind: newData.kind
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

    let currentCount = await this.count(filter);

    if (currentCount.count >= limit!) {
      throw new HttpErrorResponse({
        statusCode: 403,
        name: "LimitExceededError",
        message: `Entity creation limit is exceeded.`,
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

    if (data.name)
      data.slug = slugify(data.name ?? '', {lower: true});
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
      let slugKind: string = slugify(data.kind, {lower: true});

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
    let fields: string[] = this.uniquenessConfigReader.getFieldsForLists(newData.kind);
    let set = this.uniquenessConfigReader.getSetForLists(newData.ownerUsers, newData.ownerGroups, newData.kind);

    // if there is at least single field in the fields array that does not present on new data, then we should find it from the db.
    if (_.some(fields, _.negate(_.partial(_.has, newData)))) {
      let existingEntity = await super.findById(id);

      _.forEach(fields, (field) => {

        whereBuilder.and({
          [field]: _.has(newData, field) ? _.get(newData, field) : _.get(existingEntity, field)
        });
      });

    } else {
      _.forEach(fields, (field) => {

        whereBuilder.and({
          [field]: _.get(newData, field)
        });
      });
    }

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
}
