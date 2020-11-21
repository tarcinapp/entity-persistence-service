import {Getter, inject} from '@loopback/core';
import {AnyObject, Count, DataObject, DefaultCrudRepository, Filter, FilterBuilder, HasManyRepositoryFactory, HasManyThroughRepositoryFactory, Options, repository, Where, WhereBuilder} from '@loopback/repository';
import _ from 'lodash';
import qs from 'qs';
import slugify from "slugify";
import {EntityDbDataSource} from '../datasources';
import {Set, SetFilterBuilder} from '../extensions/set';
import {GenericEntity, GenericEntityRelations, HttpErrorResponse, Reactions, Relation, Tag, TagEntityRelation} from '../models';
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

  generateSlug(data: DataObject<AnyObject>) {

    if (data.name)
      data.slug = slugify(data.name ?? '', {lower: true});
  }

  setOwnersCount(data: DataObject<AnyObject>) {

    if (_.isArray(data.ownerUsers))
      data.ownerUsersCount = data.ownerUsers?.length;

    if (_.isArray(data.ownerGroups))
      data.ownerGroupsCount = data.ownerGroups?.length;
  }

  checkDataKindFormat(data: DataObject<AnyObject>) {

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

  async checkUniquenessForUpdateAll(newData: DataObject<AnyObject>, fields: string[], where?: Where<AnyObject>) {

    // data objesi, composite unique index'i olusturan alanlardan hicbirisine sahip degilse, bu islemin unique index'i ihlal etme olasiligi yoktur
    if (_.every(fields, _.negate(_.partial(_.has, newData))))
      return;

    // eger data objesi, composite unique index'i olusturan alanlarin tamamini iceriyorsa, bu operasyonun birden fazla kaydi etkilememesi gerekir.
    // yani, where filtresi, bu durumda en fazla '1' sonuc dondurmelidir ki bu adıma izin verebilelim
    let hasAllFields: boolean = _.every(fields, _.partial(_.has, newData));

    if (hasAllFields) {
      // check if provied where clause returns more than 1 record
      let count: Count = await this.count(where);

      if (count.count > 1) {
        throw new HttpErrorResponse({
          statusCode: 409,
          name: "DataUniquenessViolationError",
          message: "Entity already exists.",
          code: "ENTITY-ALREADY-EXISTS",
          status: 409,
        });
      }
    }

    // TODO: eğer data objesi composite unique indexi oluşturan alanların bir kısmını içeriyorsa, etkilenen kayıtların unique index'i ihlal etme olasılığı var
    // bu durumu nasil yakalayabiliriz bilmiyorum ama
  }

  async checkUniquenessForCreate(newData: DataObject<AnyObject>) {

    // return if no uniqueness is configured
    if (!process.env.uniqueness_entity && !process.env.uniqueness_entity_set) return;

    let whereBuilder: WhereBuilder<AnyObject> = new WhereBuilder<AnyObject>();

    // add uniqueness fields if configured
    if (process.env.uniqueness_entity) {
      let fields: string[] = process.env.uniqueness_entity
        .replace(/\s/g, '')
        .split(',');

      _.forEach(fields, (field) => {

        whereBuilder.and({
          [field]: _.get(newData, field)
        });
      });
    }

    let filter = new FilterBuilder<AnyObject>()
      .where(whereBuilder.build())
      .fields('id')
      .build();

    // add set filter if configured
    if (process.env.uniqueness_entity_set) {

      let uniquenessStr = process.env.uniqueness_entity_set;
      uniquenessStr = uniquenessStr.replace(/(set\[.*owners\])/g, '$1='
        + (newData.ownerUsers ? newData.ownerUsers?.join(',') : '')
        + ';'
        + (newData.ownerGroups ? newData.ownerGroups?.join(',') : ''));

      let uniquenessSet = (qs.parse(uniquenessStr)).set as Set;

      filter = new SetFilterBuilder<AnyObject>(uniquenessSet, {
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

  async checkUniquenessForUpdate(id: string, newData: DataObject<AnyObject>) {

    // return if no uniqueness is configured
    if (!process.env.uniqueness_entity && !process.env.uniqueness_entity_set) return;

    let whereBuilder: WhereBuilder<AnyObject> = new WhereBuilder<AnyObject>();

    // add uniqueness fields if configured
    if (process.env.uniqueness_entity) {
      let fields: string[] = process.env.uniqueness_entity
        .replace(/\s/g, '')
        .split(',');

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
    }

    //
    whereBuilder.and({
      id: {
        neq: id
      }
    });

    let filter = new FilterBuilder<AnyObject>()
      .where(whereBuilder.build())
      .fields('id')
      .build();

    // add set filter if configured
    if (process.env.uniqueness_entity_set) {

      let uniquenessStr = process.env.uniqueness_entity_set;
      uniquenessStr = uniquenessStr.replace(/(set\[.*owners\])/g, '$1='
        + (newData.ownerUsers ? newData.ownerUsers?.join(',') : '')
        + ';'
        + (newData.ownerGroups ? newData.ownerGroups?.join(',') : ''));

      let uniquenessSet = (qs.parse(uniquenessStr)).set as Set;

      filter = new SetFilterBuilder<GenericEntity>(uniquenessSet, {
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
