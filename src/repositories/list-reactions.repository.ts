import {DefaultCrudRepository} from '@loopback/repository';
import {ListReactions, ListReactionsRelations} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject} from '@loopback/core';

export class ListReactionsRepository extends DefaultCrudRepository<
  ListReactions,
  typeof ListReactions.prototype.id,
  ListReactionsRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(ListReactions, dataSource);
  }
}
