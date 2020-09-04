import {DefaultCrudRepository} from '@loopback/repository';
import {SubListReactions, SubListReactionsRelations} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject} from '@loopback/core';

export class SubListReactionsRepository extends DefaultCrudRepository<
  SubListReactions,
  typeof SubListReactions.prototype.id,
  SubListReactionsRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(SubListReactions, dataSource);
  }
}
