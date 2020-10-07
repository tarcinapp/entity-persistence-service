import {Getter, inject} from '@loopback/core';
import {Count, DataObject, DefaultCrudRepository, Filter, FilterBuilder, HasManyRepositoryFactory, HasManyThroughRepositoryFactory, Options, repository, Where} from '@loopback/repository';
import _ from "lodash";
import {EntityDbDataSource} from '../datasources';
import {GenericEntity, HttpErrorResponse, List, ListEntityRelation, ListReactions, ListRelation, ListRelations, Tag, TagListRelation} from '../models';
import {GenericEntityRepository} from './generic-entity.repository';
import {ListEntityRelationRepository} from './list-entity-relation.repository';
import {ListReactionsRepository} from './list-reactions.repository';
import {ListRelationRepository} from './list-relation.repository';
import {TagListRelationRepository} from './tag-list-relation.repository';
import {TagRepository} from './tag.repository';

export class ListRepository extends DefaultCrudRepository<
  List,
  typeof List.prototype.id,
  ListRelations
  > {

  public readonly genericEntities: HasManyThroughRepositoryFactory<GenericEntity, typeof GenericEntity.prototype.id,
    ListEntityRelation,
    typeof List.prototype.id
  >;

  public readonly relations: HasManyRepositoryFactory<ListRelation, typeof List.prototype.id>;

  public readonly reactions: HasManyRepositoryFactory<ListReactions, typeof List.prototype.id>;

  public readonly tags: HasManyThroughRepositoryFactory<Tag, typeof Tag.prototype.id,
    TagListRelation,
    typeof List.prototype.id
  >;

  private static response_limit = _.parseInt(process.env.response_limit_list || "50");

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource, @repository.getter('ListEntityRelationRepository') protected listEntityRelationRepositoryGetter: Getter<ListEntityRelationRepository>, @repository.getter('GenericEntityRepository') protected genericEntityRepositoryGetter: Getter<GenericEntityRepository>, @repository.getter('ListRelationRepository') protected listRelationRepositoryGetter: Getter<ListRelationRepository>, @repository.getter('ListReactionsRepository') protected listReactionsRepositoryGetter: Getter<ListReactionsRepository>, @repository.getter('TagListRelationRepository') protected tagListRelationRepositoryGetter: Getter<TagListRelationRepository>, @repository.getter('TagRepository') protected tagRepositoryGetter: Getter<TagRepository>,
  ) {
    super(List, dataSource);
    this.tags = this.createHasManyThroughRepositoryFactoryFor('tags', tagRepositoryGetter, tagListRelationRepositoryGetter,);
    this.reactions = this.createHasManyRepositoryFactoryFor('reactions', listReactionsRepositoryGetter,);
    this.registerInclusionResolver('reactions', this.reactions.inclusionResolver);
    this.relations = this.createHasManyRepositoryFactoryFor('relations', listRelationRepositoryGetter,);
    this.registerInclusionResolver('relations', this.relations.inclusionResolver);
    this.genericEntities = this.createHasManyThroughRepositoryFactoryFor('genericEntities', genericEntityRepositoryGetter, listEntityRelationRepositoryGetter,);
  }

  async find(filter?: Filter<List>, options?: Options) {

    if (filter?.limit && filter.limit > ListRepository.response_limit)
      filter.limit = ListRepository.response_limit;

    return super.find(filter, options);
  }

  async create(data: DataObject<List>) {

    if (process.env.uniqueness_list) {

      let fields: string[] = process.env.uniqueness_list
        .replace(/\s/g, '')
        .split(',');

      await this.checkUniqueness(data, fields);
    }

    return super.create(data);
  }

  async replaceById(id: string, data: DataObject<List>, options?: Options) {

    if (process.env.uniqueness_list) {

      let fields: string[] = process.env.uniqueness_list
        .replace(/\s/g, '')
        .split(',');

      await this.checkUniqueness(data, fields);
    }

    return super.replaceById(id, data, options);
  }

  async updateById(id: string, data: DataObject<List>, options?: Options) {

    if (process.env.uniqueness_list) {

      let fields: string[] = process.env.uniqueness_list
        .replace(/\s/g, '')
        .split(',');

      await this.checkUniqueness(data, fields);
    }

    return super.updateById(id, data, options);
  }

  async updateAll(data: DataObject<List>, where?: Where<List>, options?: Options) {

    if (process.env.uniqueness_list) {

      let fields: string[] = process.env.uniqueness_list
        .replace(/\s/g, '')
        .split(',');
      await this.checkUniquenessForUpdateAll(data, fields, where);
    }

    return super.updateAll(data, where, options);
  }

  async checkUniqueness(entity: DataObject<List>, fields: string[]) {

    const where: Where<List> = {
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

    let filter: Filter<List> = new FilterBuilder()
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

  async checkUniquenessForUpdateAll(data: DataObject<List>, fields: string[], where?: Where<List>) {

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
        throw "this operation violates unique index";
      }
    }

    // TODO: eğer data objesi composite unique indexi oluşturan alanların bir kısmını içeriyorsa, etkilenen kayıtların unique index'i ihlal etme olasılığı var
    // bu durumu nasil yakalayabiliriz bilmiyorum ama
  }
}
