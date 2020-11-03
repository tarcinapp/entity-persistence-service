import {Getter, inject} from '@loopback/core';
import {Count, DataObject, DefaultCrudRepository, Filter, FilterBuilder, HasManyRepositoryFactory, HasManyThroughRepositoryFactory, Options, repository, Where} from '@loopback/repository';
import _ from "lodash";
import slugify from "slugify";
import {EntityDbDataSource} from '../datasources';
import {GenericEntity, GenericEntityRelations, HttpErrorResponse, Reactions, Relation, Tag, TagEntityRelation} from '../models';
import {ReactionsRepository} from './reactions.repository';
import {RelationRepository} from './relation.repository';
import {TagEntityRelationRepository} from './tag-entity-relation.repository';
import {TagRepository} from './tag.repository';

// this library does not have types
const mapKeysDeep = require("map-keys-deep-lodash");

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

    // handle special use of $null
    let filterStr = JSON.stringify(filter);
    filterStr = filterStr.replace(/\"\$null\"/g, "null");
    filter = JSON.parse(filterStr);

    // we need to modify incoming filter to replace any square brackets in object keys
    // this is required as 'qs' library has a bug in parsing nested filters
    // {"[key]": "value"} becomes {"key":"value"}
    let workaroundFilter = mapKeysDeep(filter, (value: string, key: string) => {
      return _.replace(key, /\[|\]/g, "");
    });

    console.log(JSON.stringify(workaroundFilter));

    return super.find(workaroundFilter, options);
  }

  async create(data: DataObject<GenericEntity>) {

    await this.checkDataKindFormat(data);

    data.slug = slugify(data.name ?? '', {lower: true});

    if (process.env.uniqueness_entity) {

      let fields: string[] = process.env.uniqueness_entity
        .replace(/\s/g, '')
        .split(',');

      await this.checkUniqueness(data, fields);
    }

    return super.create(data);
  }

  async replaceById(id: string, data: DataObject<GenericEntity>, options?: Options) {

    await this.checkDataKindFormat(data);

    // prevent this call to change the slug field
    if (data.slug)
      data.slug = undefined;

    data.slug = slugify(data.name ?? '', {lower: true});

    if (process.env.uniqueness_entity) {

      let fields: string[] = process.env.uniqueness_entity
        .replace(/\s/g, '')
        .split(',');

      // add id to data to check uniqueness
      data.id = id;
      await this.checkUniqueness(data, fields);
    }

    return super.replaceById(id, data, options);
  }

  async updateById(id: string, data: DataObject<GenericEntity>, options?: Options) {

    await this.checkDataKindFormat(data);

    // prevent this call to change the slug field
    if (data.slug)
      data.slug = undefined;

    if (data.name)
      data.slug = slugify(data.name, {lower: true});

    if (process.env.uniqueness_entity) {

      let fields: string[] = process.env.uniqueness_entity
        .replace(/\s/g, '')
        .split(',');

      // add id to data to check uniqueness
      data.id = id;

      await this.checkUniqueness(data, fields);
    }

    return super.updateById(id, data, options);
  }

  async updateAll(data: DataObject<GenericEntity>, where?: Where<GenericEntity>, options?: Options) {

    await this.checkDataKindFormat(data);

    // prevent this call to change the slug field
    if (data.slug)
      data.slug = undefined;

    if (data.name)
      data.slug = slugify(data.name, {lower: true});

    if (process.env.uniqueness_entity) {

      let fields: string[] = process.env.uniqueness_entity
        .replace(/\s/g, '')
        .split(',');
      await this.checkUniquenessForUpdateAll(data, fields, where);
    }

    return super.updateAll(data, where, options);
  }

  async checkUniquenessForUpdateAll(data: DataObject<GenericEntity>, fields: string[], where?: Where<GenericEntity>) {

    // data objesi, composite unique index'i olusturan alanlardan hicbirisine sahip degilse, bu islemin unique index'i ihlal etme olasiligi yoktur
    let hasNoField: boolean = _.every(fields, (f) => {
      return !_.has(data, f)
    });

    if (hasNoField) return;

    // eger data objesi, composite unique index'i olusturan alanlarin tamamini iceriyorsa, bu operasyonun birden fazla kaydi etkilememesi gerekir.
    // yani, where filtresi, bu durumda en fazla '1' sonuc dondurmelidir ki bu adıma izin verebilelim
    let hasAllFields: boolean = _.every(fields, _.partial(_.has, data));

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

  async checkUniqueness(entity: DataObject<GenericEntity>, fields: string[]) {

    const where: Where<GenericEntity> = {
      and: [
        {
          or: [
            {
              validUntilDateTime: null
            },
            {
              validUntilDateTime: {
                gt: Date.now()
              }
            }
          ]
        },
        {
          validFromDateTime: {
            neq: null
          }
        },
        {
          validFromDateTime: {
            lt: Date.now()
          }
        }
      ]
    };

    // if entity.id exists, then this method is invoked from update or replace methods
    // we must make sure we are not retrieving the same data
    if (entity.id) {
      where.and.push({
        id: {
          neq: entity.id
        }
      });
    }

    if (_.isArray(entity.ownerUsers) && _.includes(fields, 'ownerUsers')) {

      if (entity.ownerUsers?.length == 1) {
        where.and.push({
          ownerUsers: entity.ownerUsers[0]
        });
      }

      if (entity.ownerUsers?.length > 1) {
        let or: object[] = [];

        _.forEach(entity.ownerUsers, (ownerUser) => {
          or.push({
            ownerUsers: ownerUser
          })
        });

        where.and.push(or);
      }

      fields = _.pull(fields, 'ownerUsers');
    }

    _.forEach(fields, (field) => {
      let clause = {};
      clause = _.set(clause, field, _.get(entity, field));
      where.and.push(clause);
    });

    let filter: Filter<GenericEntity> = new FilterBuilder()
      .fields('id')
      .where(where)
      .build();

    /**
    * Check if there is an existing entity
    */
    const activeEntityWithSameName = await super.findOne(filter);

    if (activeEntityWithSameName) {

      throw new HttpErrorResponse({
        statusCode: 409,
        name: "DataUniquenessViolationError",
        message: "Entity already exists.",
        code: "ENTITY-ALREADY-EXISTS",
        status: 409,
      });
    }
  }

  async checkDataKindFormat(data: DataObject<GenericEntity>) {

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
}
