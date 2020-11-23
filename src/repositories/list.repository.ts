import {Getter, inject} from '@loopback/core';
import {DataObject, DefaultCrudRepository, Filter, FilterBuilder, HasManyRepositoryFactory, HasManyThroughRepositoryFactory, Options, repository, Where, WhereBuilder} from '@loopback/repository';
import _ from "lodash";
import qs from 'qs';
import slugify from "slugify";
import {EntityDbDataSource} from '../datasources';
import {Set, SetFilterBuilder} from '../extensions/set';
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

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    await this.checkUniquenessForCreate(data);

    return super.create(data);
  }

  async replaceById(id: string, data: DataObject<List>, options?: Options) {

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    await this.checkUniquenessForUpdate(id, data);

    return super.replaceById(id, data, options);
  }

  async updateById(id: string, data: DataObject<List>, options?: Options) {

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    await this.checkUniquenessForUpdate(id, data);

    return super.updateById(id, data, options);
  }

  async updateAll(data: DataObject<List>, where?: Where<List>, options?: Options) {

    this.checkDataKindFormat(data);

    this.generateSlug(data);

    this.setOwnersCount(data);

    return super.updateAll(data, where, options);
  }

  private generateSlug(data: DataObject<List>) {

    if (data.name)
      data.slug = slugify(data.name ?? '', {lower: true});
  }

  private setOwnersCount(data: DataObject<List>) {

    if (_.isArray(data.ownerUsers))
      data.ownerUsersCount = data.ownerUsers?.length;

    if (_.isArray(data.ownerGroups))
      data.ownerGroupsCount = data.ownerGroups?.length;
  }

  private checkDataKindFormat(data: DataObject<List>) {

    // make sure data kind is slug format
    if (data.kind) {
      let slugKind: string = slugify(data.kind, {lower: true});

      if (slugKind != data.kind) {
        throw new HttpErrorResponse({
          statusCode: 422,
          name: "InvalidKindError",
          message: `List kind cannot contain special or uppercase characters. Use '${slugKind}' instead.`,
          code: "INVALID-LIST-KIND",
          status: 422,
        });
      }
    }
  }

  private async checkUniquenessForCreate(newData: DataObject<List>) {

    // return if no uniqueness is configured
    if (!process.env.uniqueness_list_fields && !process.env.uniqueness_list_set) return;

    let whereBuilder: WhereBuilder<List> = new WhereBuilder<List>();

    // add uniqueness fields if configured
    if (process.env.uniqueness_list_fields) {
      let fields: string[] = process.env.uniqueness_list_fields
        .replace(/\s/g, '')
        .split(',');

      _.forEach(fields, (field) => {

        whereBuilder.and({
          [field]: _.get(newData, field)
        });
      });
    }

    let filter = new FilterBuilder<List>()
      .where(whereBuilder.build())
      .fields('id')
      .build();

    // add set filter if configured
    if (process.env.uniqueness_list_set) {

      let uniquenessStr = process.env.uniqueness_list_set;
      uniquenessStr = uniquenessStr.replace(/(set\[.*owners\])/g, '$1='
        + (newData.ownerUsers ? newData.ownerUsers?.join(',') : '')
        + ';'
        + (newData.ownerGroups ? newData.ownerGroups?.join(',') : ''));

      let uniquenessSet = (qs.parse(uniquenessStr)).set as Set;

      filter = new SetFilterBuilder<List>(uniquenessSet, {
        filter: filter
      })
        .build();
    }

    // final uniqueness controlling filter
    console.log('Uniqueness Filter: ', JSON.stringify(filter));

    let existingList = await super.findOne(filter);

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

  private async checkUniquenessForUpdate(id: string, newData: DataObject<List>) {

    // return if no uniqueness is configured
    if (!process.env.uniqueness_list_fields && !process.env.uniqueness_list_set) return;

    let whereBuilder: WhereBuilder<List> = new WhereBuilder<List>();

    // add uniqueness fields if configured
    if (process.env.uniqueness_list_fields) {
      let fields: string[] = process.env.uniqueness_list_fields
        .replace(/\s/g, '')
        .split(',');

      // if there is at least single field in the fields array that does not present on new data, then we should find it from the db.
      if (_.some(fields, _.negate(_.partial(_.has, newData)))) {
        let existingList = await super.findById(id);

        _.forEach(fields, (field) => {

          whereBuilder.and({
            [field]: _.has(newData, field) ? _.get(newData, field) : _.get(existingList, field)
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

    let filter = new FilterBuilder<List>()
      .where(whereBuilder.build())
      .fields('id')
      .build();

    // add set filter if configured
    if (process.env.uniqueness_list_set) {

      let uniquenessStr = process.env.uniqueness_list_set;
      uniquenessStr = uniquenessStr.replace(/(set\[.*owners\])/g, '$1='
        + (newData.ownerUsers ? newData.ownerUsers?.join(',') : '')
        + ';'
        + (newData.ownerGroups ? newData.ownerGroups?.join(',') : ''));

      let uniquenessSet = (qs.parse(uniquenessStr)).set as Set;

      filter = new SetFilterBuilder<List>(uniquenessSet, {
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
        message: "List already exists.",
        code: "LIST-ALREADY-EXISTS",
        status: 409,
      });
    }
  }


}
