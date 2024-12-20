import {inject} from '@loopback/context';
import {
  DefaultCrudRepository,
  Filter,
  Getter,
  Options,
  repository
} from '@loopback/repository';
import _ from 'lodash';
import {EntityDbDataSource} from '../datasources';
import {
  GenericEntity,
  GenericEntityRelations,
  GenericList,
  GenericListEntityRelation
} from '../models';
import {GenericEntityRepository} from './generic-entity.repository';
import {GenericListEntityRelationRepository} from './generic-list-entity-relation.repository';

export class CustomListEntityRelRepository extends DefaultCrudRepository<
  GenericEntity,
  typeof GenericEntity.prototype.id,
  GenericEntityRelations
> {

  protected sourceListId: typeof GenericList.prototype.id;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,

    @repository.getter('GenericEntityRepository')
    protected genericEntityRepositoryGetter: Getter<GenericEntityRepository>,

    @repository.getter('GenericListEntityRelationRepository')
    protected genericListEntityRepositoryGetter: Getter<GenericListEntityRelationRepository>
  ) {
    super(GenericEntity, dataSource);
  }


  async find(
    filter?: Filter<GenericEntity>,
    filterThrough?: Filter<GenericListEntityRelation>,
    options?: Options
  ): Promise<GenericEntity[]> {
    // Get the through repository
    const genericListEntityRelationRepo = await this.genericListEntityRepositoryGetter();

    // Calculate fields logic
    let fields;

    if (Array.isArray(filterThrough?.fields)) {
      // If fields is an array, ensure listId and entityId exists
      fields = _.union(fields, ['entityId', 'listId']);
    } else if (filterThrough?.fields) {
      // If fields is an object
      const fieldValues = Object.values(filterThrough.fields);

      // if there are fields with true values
      if (fieldValues.includes(true)) {

        // make sure entityId and listId are true
        fields = {
          ...filterThrough.fields,
          ...({
            entityId: true,
            listId: true
          })
        }
      } else {
        // if entityId explicitly given as false, remove it
        fields = _.omitBy(filterThrough.fields, (v, k) => k === 'entityId' && v === false);

        // if entityId explicitly given as false, remove it
        fields = _.omitBy(fields, (v, k) => k === 'listId' && v === false);
      }
    } else {
      // If fields is undefined, leave it undefined
      fields = undefined;
    }

    // Define the throughFilter object
    const throughFilter = {
      where: {listId: this.sourceListId, ...filterThrough?.where},
      ...(fields ? {fields: fields} : {}), // Only set fields if it's defined
      include: filterThrough?.include,
    };

    const relations = await genericListEntityRelationRepo.find(throughFilter, options);

    // Extract target entity IDs from relations
    const entityIds = relations.map(rel => rel.entityId);

    // Update the filter to only include entities matching the IDs
    const updatedFilter = {
      ...filter,
      where: {...filter?.where, id: {inq: entityIds}},
    };

    // Fetch entities matching the updated filter
    const entities = await super.find(updatedFilter, options);

    // Map relation metadata to entities, excluding `toMetadata`
    return entities.map(entity => {
      const relation = relations.find(rel => rel.entityId === entity.id);
      if (relation) {
        // Exclude `toMetadata` while retaining other properties
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {toMetadata, entityId, listId, ...relationWithoutToMetadata} = relation;

        entity.relationMetadata = {
          ...relationWithoutToMetadata,
        };
      }
      return entity;
    });
  }

}
