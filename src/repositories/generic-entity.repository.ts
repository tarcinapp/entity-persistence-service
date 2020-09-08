import {Getter, inject} from '@loopback/core';
import {DataObject, DefaultCrudRepository, HasManyRepositoryFactory, HasManyThroughRepositoryFactory, repository} from '@loopback/repository';
import {EntityDbDataSource} from '../datasources';
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

    /**
     * Check if there is an existing entity with same name
     * and validUntil field does not have a value.
     */
    const activeEntityWithSameName = await super.findOne({
      where: {
        name: entity.name,
        validUntil: {
          inq: [null]
        }
      }
    });

    /**
     * If the query above returns an entity then throw an error as new entity
     * with an existing name can not be created.
     */
    if (activeEntityWithSameName) {

      throw new HttpErrorResponse({
        statusCode: 409,
        name: "DataUniquenessViolationError",
        message: "Entity already exists. See error object `details` property for more info.",
        code: "ENTITY-ALREADY-EXISTS",
        details: [new SingleError({
          path: '/name',
          code: 'NAME-ALREADY-EXISTS',
          message: 'Name already exists',
          info: {
            "violatedUniquenessProperty": "name"
          }
        })],
        status: 409,
      });
    }

    return super.create(entity);
  }
}
