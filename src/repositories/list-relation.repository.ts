import {DefaultCrudRepository} from '@loopback/repository';
import {ListRelation, ListRelationRelations} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject} from '@loopback/core';

export class ListRelationRepository extends DefaultCrudRepository<
  ListRelation,
  typeof ListRelation.prototype.id,
  ListRelationRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(ListRelation, dataSource);
  }
}
