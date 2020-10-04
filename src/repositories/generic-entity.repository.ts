import {Getter, inject} from '@loopback/core';
import {DataObject, DefaultCrudRepository, Filter, FilterBuilder, HasManyRepositoryFactory, HasManyThroughRepositoryFactory, Options, repository, Where} from '@loopback/repository';
import * as _ from "lodash";
import {EntityDbDataSource} from '../datasources';
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

  async create(entity: DataObject<GenericEntity>) {

    await this.checkUniqueness(entity);

    return super.create(entity);
  }

  async updateById(id: string, data: DataObject<GenericEntity>, options?: Options) {

    await this.checkUniqueness(data);

    return super.updateById(id, data, options);
  }

  async checkUniqueness(entity: DataObject<GenericEntity>) {

    if (!process.env.uniqueness_entity)
      return;

    let fields: string[] = process.env.uniqueness_entity
      .replace(/\s/g, '')
      .split(',');

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
}
