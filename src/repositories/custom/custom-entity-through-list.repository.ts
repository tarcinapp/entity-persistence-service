import {BindingScope, ContextTags, inject, injectable, intercept} from '@loopback/context';
import {
  Count,
  DataObject,
  Fields,
  Filter,
  Getter,
  Options,
  repository,
  Where,
} from '@loopback/repository';
import _ from 'lodash';
import {EntityDbDataSource} from '../../datasources';
import {transactional} from '../../decorators';
import {
  GenericEntity,
  GenericEntityWithRelations,
  List,
  ListToEntityRelation,
} from '../../models';
import {EntityPersistenceBaseRepository} from '../base/entity-persistence-base.repository';
import {EntityRepository} from '../core/entity.repository';
import {ListEntityRelationRepository} from '../core/list-entity-relation.repository';


@injectable({
  scope: BindingScope.TRANSIENT,
  tags: {interceptable: true} // LB4'e "bu sınıfa aracı girsin" der
})
export class CustomEntityThroughListRepository extends EntityPersistenceBaseRepository<
  GenericEntity,
  typeof GenericEntity.prototype._id,
  GenericEntityWithRelations
> {
  protected readonly recordTypeName = 'entity';
  protected sourceListId: typeof List.prototype._id;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,

    @repository.getter('EntityRepository')
    protected entityRepositoryGetter: Getter<EntityRepository>,

    @repository.getter('ListEntityRelationRepository')
    protected listEntityRepoGetter: Getter<ListEntityRelationRepository>,
  ) {
    super(GenericEntity, dataSource);
  }

  async find(
    filter?: Filter<GenericEntity>,
    filterThrough?: Filter<ListToEntityRelation>,
    options?: Options,
  ): Promise<GenericEntity[]> {
    // Get the through repository
    const listEntityRelationRepo = await this.listEntityRepoGetter();

    // Calculate fields logic
    let fields: Fields<ListToEntityRelation> | undefined;

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
          (v, k) => k === '_entityId' && v === false,
        );

        // if listId explicitly given as false, remove it
        fields = _.omitBy(fields, (v, k) => k === '_listId' && v === false);
      }
    } else {
      fields = undefined;
    }

    // Define the throughFilter object
    const throughFilter = {
      where: {_listId: this.sourceListId, ...filterThrough?.where},
      ...(fields !== undefined ? {fields: fields} : {}), // Only set fields if it's defined
      include: filterThrough?.include,
    };

    const relations = await listEntityRelationRepo.find(throughFilter);

    // Extract target entity IDs from relations
    const entityIds = relations.map(
      (rel: ListToEntityRelation) => rel._entityId,
    );

    // Update the filter to only include entities matching the IDs
    const updatedFilter = {
      ...filter,
      where: {...filter?.where, _id: {inq: entityIds}},
    };

    // Fetch entities matching the updated filter
    const entities = await super.find(updatedFilter, options);

    // Map relation metadata to entities, excluding `toMetadata`
    const entitiesWithMetadata = entities.map((entity) => {
      const relation = relations.find(
        (rel: ListToEntityRelation) => rel._entityId === entity._id,
      );
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

    return this.injectRecordTypeArray(entitiesWithMetadata);
  }

  async create(
    data: DataObject<GenericEntity>,
    options: Options = {},
  ): Promise<GenericEntity> {
    const entitiesRepo = await this.entityRepositoryGetter();
    const listEntityRelationRepo = await this.listEntityRepoGetter();

    const entity = await entitiesRepo.create(data, options);

    await listEntityRelationRepo.create(
      {
        _entityId: entity._id,
        _listId: this.sourceListId,
      },
      options,
    );

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
    whereThrough?: Where<ListToEntityRelation>,
    options?: Options,
  ) {
    const entitiesRepo = await this.entityRepositoryGetter();
    const listEntityRelationRepo = await this.listEntityRepoGetter();

    const relations = await listEntityRelationRepo.find({
      where: {
        _listId: this.sourceListId,
        ...whereThrough,
      },
    }, undefined, undefined, options);
    const entityIds = relations.map(
      (rel: ListToEntityRelation) => rel._entityId,
    );

    where = {_id: {inq: entityIds}, ...where};

    return entitiesRepo.updateAll(data, where, options);
  }

  async deleteAll(
    where?: Where<GenericEntity>,
    whereThrough?: Where<ListToEntityRelation>,
    options?: Options,
  ): Promise<Count> {
    const entitiesRepo = await this.entityRepositoryGetter();
    const listEntityRelationRepo = await this.listEntityRepoGetter();

    // 1. Find all relations to identify which entities are linked to this list
    const relations = await listEntityRelationRepo.find({
      where: {
        _listId: this.sourceListId,
        ...whereThrough,
      },
    }, undefined, undefined, options);

    if (relations.length === 0) return {count: 0};

    const entityIds = relations.map(
      (rel: ListToEntityRelation) => rel._entityId,
    );

    // 2. Delete the actual entities
    const entityWhere = {_id: {inq: entityIds}, ...where};
    const entitiesDeleteCount = await entitiesRepo.deleteAll(entityWhere, options);

    // 3. Delete the relations to maintain referential integrity
    const relationWhere = {
      _listId: this.sourceListId,
      _entityId: {inq: entityIds},
      ...whereThrough,
    };
    await listEntityRelationRepo.deleteAll(relationWhere, options);

    // Return the count of deleted entities as the primary result
    return entitiesDeleteCount;
  }
}
