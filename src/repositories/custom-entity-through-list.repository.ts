import { inject } from '@loopback/context';
import {
  DataObject,
  DefaultCrudRepository,
  Fields,
  Filter,
  Getter,
  Options,
  repository,
  Where,
} from '@loopback/repository';
import _ from 'lodash';
import { EntityDbDataSource } from '../datasources';
import {
  GenericEntity,
  GenericEntityWithRelations,
  GenericList,
  GenericListToEntityRelation,
} from '../models';
import { GenericEntityRepository } from './generic-entity.repository';
import { GenericListEntityRelationRepository } from './generic-list-entity-relation.repository';

export class CustomEntityThroughListRepository extends DefaultCrudRepository<
  GenericEntity,
  typeof GenericEntity.prototype._id,
  GenericEntityWithRelations
> {
  protected sourceListId: typeof GenericList.prototype._id;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,

    @repository.getter('GenericEntityRepository')
    protected genericEntityRepositoryGetter: Getter<GenericEntityRepository>,

    @repository.getter('GenericListEntityRelationRepository')
    protected genericListEntityRepositoryGetter: Getter<GenericListEntityRelationRepository>,
  ) {
    super(GenericEntity, dataSource);
  }

  async find(
    filter?: Filter<GenericEntity>,
    filterThrough?: Filter<GenericListToEntityRelation>,
    options?: Options,
  ): Promise<GenericEntity[]> {
    // Get the through repository
    const genericListEntityRelationRepo =
      await this.genericListEntityRepositoryGetter();

    // Calculate fields logic
    let fields: Fields<GenericListToEntityRelation> | undefined;

    if (Array.isArray(filterThrough?.fields)) {
      // If fields is an array, ensure listId and entityId exists
      fields = _.union(filterThrough?.fields, ['_entityId', '_listId']);
    } else if (filterThrough?.fields) {
      // If fields is an object
      const fieldValues = Object.values(filterThrough.fields);

      // if there are fields with true values
      if (fieldValues.includes(true)) {
        // make sure entityId and listId are true
        fields = {
          ...filterThrough.fields,
          ...{
            entityId: true,
            listId: true,
          },
        };
      } else {
        // if entityId explicitly given as false, remove it
        fields = _.omitBy(
          filterThrough.fields,
          (v, k) => k === 'entityId' && v === false,
        );

        // if listId explicitly given as false, remove it
        fields = _.omitBy(fields, (v, k) => k === 'listId' && v === false);
      }
    } else {
      fields = undefined;
    }

    // Define the throughFilter object
    const throughFilter = {
      where: { _listId: this.sourceListId, ...filterThrough?.where },
      ...(fields !== undefined ? { fields: fields } : {}), // Only set fields if it's defined
      include: filterThrough?.include,
    };

    const relations = await genericListEntityRelationRepo.find(
      throughFilter,
      options,
    );

    // Extract target entity IDs from relations
    const entityIds = relations.map((rel) => rel._entityId);

    // Update the filter to only include entities matching the IDs
    const updatedFilter = {
      ...filter,
      where: { ...filter?.where, _id: { inq: entityIds } },
    };

    // Fetch entities matching the updated filter
    const entities = await super.find(updatedFilter, options);

    // Map relation metadata to entities, excluding `toMetadata`
    return entities.map((entity) => {
      const relation = relations.find((rel) => rel._entityId === entity._id);
      if (relation) {
        // Exclude `toMetadata` while retaining other properties

        entity._relationMetadata = {
          _id: relation._id,
          _kind: relation._kind,
          _validFromDateTime: relation._validFromDateTime,
          _validUntilDateTime: relation._validUntilDateTime,
        };
      }

      return entity;
    });
  }

  /**
   * Creates the generic entity first, then the relation calling the repositories of these individual records.
   * Deletes the entity if the relation creation fails.
   * @param data Generic Entity
   * @returns Created Generic Entity
   */
  async create(
    data: DataObject<GenericEntity>,
    options?: Options,
  ): Promise<GenericEntity> {
    const genericEntitiesRepo = await this.genericEntityRepositoryGetter();
    const genericListEntityRelationRepo =
      await this.genericListEntityRepositoryGetter();

    const entity = await genericEntitiesRepo.create(data, options);

    try {
      await genericListEntityRelationRepo.create(
        {
          _entityId: entity._id,
          _listId: this.sourceListId,
        },
        options,
      );
    } catch (err) {
      await genericEntitiesRepo.deleteById(entity._id, options);
      throw err;
    }

    return entity;
  }

  /**
   * Finds the ids of entities by the given source list id through the relation repository.
   * Then adds id filter to the given where object and calls the generic entity repository.
   *
   * @param data
   * @param where
   * @param options
   * @returns
   */
  async updateAll(
    data: DataObject<GenericEntity>,
    where?: Where<GenericEntity>,
    whereThrough?: Where<GenericListToEntityRelation>,
    options?: Options,
  ) {
    const genericEntitiesRepo = await this.genericEntityRepositoryGetter();
    const genericListEntityRelationRepo =
      await this.genericListEntityRepositoryGetter();

    const relations = await genericListEntityRelationRepo.find({
      where: {
        _listId: this.sourceListId,
        ...whereThrough,
      },
    });
    const entityIds = relations.map((rel) => rel._entityId);

    where = { _id: { inq: entityIds }, ...where };

    return genericEntitiesRepo.updateAll(data, where, options);
  }

  async deleteAll(
    where?: Where<GenericEntity>,
    whereThrough?: Where<GenericListToEntityRelation>,
    options?: Options,
  ) {
    const genericEntitiesRepo = await this.genericEntityRepositoryGetter();
    const genericListEntityRelationRepo =
      await this.genericListEntityRepositoryGetter();

    const relations = await genericListEntityRelationRepo.find({
      where: {
        _listId: this.sourceListId,
        ...whereThrough,
      },
    });
    const entityIds = relations.map((rel) => rel._entityId);

    where = { _id: { inq: entityIds }, ...where };

    return genericEntitiesRepo.deleteAll(where, options);
  }
}
