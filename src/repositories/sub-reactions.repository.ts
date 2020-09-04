import {DefaultCrudRepository} from '@loopback/repository';
import {SubReactions, SubReactionsRelations} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject} from '@loopback/core';

export class SubReactionsRepository extends DefaultCrudRepository<
  SubReactions,
  typeof SubReactions.prototype.id,
  SubReactionsRelations
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
  ) {
    super(SubReactions, dataSource);
  }
}
