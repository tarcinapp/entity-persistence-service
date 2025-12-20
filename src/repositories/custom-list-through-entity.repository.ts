import { inject } from '@loopback/context';
import {
  DefaultCrudRepository,
  Fields,
  Filter,
  Getter,
  Options,
  repository,
} from '@loopback/repository';
import _ from 'lodash';
import { EntityDbDataSource } from '../datasources';
import {
  GenericEntity,
  List,
  ListWithRelations,
  ListToEntityRelation,
} from '../models';
import { ListEntityRelationRepository } from './list-entity-relation.repository';
import { ListRepository } from './list.repository';

export class CustomListThroughEntityRepository extends DefaultCrudRepository<
  List,
  typeof List.prototype._id,
  ListWithRelations
> {
  protected sourceEntityId: typeof GenericEntity.prototype._id;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @repository.getter('ListRepository')
    protected listRepositoryGetter: Getter<ListRepository>,
    @repository.getter('ListEntityRelationRepository')
    protected listEntityRepositoryGetter: Getter<ListEntityRelationRepository>,
  ) {
    super(List, dataSource);
  }

  public async find(
    filter?: Filter<List>,
    filterThrough?: Filter<ListToEntityRelation>,
    options?: Options,
  ): Promise<List[]> {
    // Get the through repository
    const listEntityRelationRepo = await this.listEntityRepositoryGetter();

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
            _entityId: true,
            _listId: true,
          },
        };
      } else {
        // if entityId explicitly given as false, remove it
        fields = _.omitBy(
          filterThrough.fields,
          (v, k) => k === '_entityId' && v === false,
        );

        // if listId explicitly given as false, remove it
        fields = _.omitBy(fields, (v, k) => k === 'listId' && v === false);
      }
    } else {
      fields = undefined;
    }

    // Define the throughFilter object
    const throughFilter = {
      where: { _entityId: this.sourceEntityId, ...filterThrough?.where },
      ...(fields !== undefined ? { fields: fields } : {}), // Only set fields if it's defined
      include: filterThrough?.include,
    };

    const relations = await listEntityRelationRepo.find(throughFilter);

    // Extract target list IDs from relations
    const listIds = relations.map((rel: ListToEntityRelation) => rel._listId);

    // Update the filter to only include lists matching the IDs
    const updatedFilter = {
      ...filter,
      where: { ...filter?.where, _id: { inq: listIds } },
    };

    // Fetch lists matching the updated filter
    const lists = await super.find(updatedFilter, options);

    // Map relation metadata to lists
    const listsWithMetadata = lists.map((list) => {
      const relation = relations.find(
        (rel: ListToEntityRelation) => rel._listId === list._id,
      );
      if (relation) {
        list._relationMetadata = {
          _id: relation._id,
          _kind: relation._kind,
          _validFromDateTime: relation._validFromDateTime,
          _validUntilDateTime: relation._validUntilDateTime,
        };
      }

      return list;
    });

    return this.injectRecordTypeArray(listsWithMetadata);
  }

  private injectRecordType<T extends List | ListWithRelations>(list: T): T {
    (list as any)._recordType = 'list';

    return list;
  }

  private injectRecordTypeArray<T extends List | ListWithRelations>(
    lists: T[],
  ): T[] {
    return lists.map((list) => this.injectRecordType(list));
  }
}
