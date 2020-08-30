import {DefaultCrudRepository} from '@loopback/repository';
import {List, ListRelations} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject} from '@loopback/core';

export class ListRepository extends DefaultCrudRepository<
  List,
  typeof List.prototype.id,
  ListRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(List, dataSource);
  }
}
