import {DefaultCrudRepository} from '@loopback/repository';
import {ListEntityRelation, ListEntityRelationRelations} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject} from '@loopback/core';

export class ListEntityRelationRepository extends DefaultCrudRepository<
  ListEntityRelation,
  typeof ListEntityRelation.prototype.id,
  ListEntityRelationRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(ListEntityRelation, dataSource);
  }
}
