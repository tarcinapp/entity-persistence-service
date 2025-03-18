import { inject } from '@loopback/core';
import { DefaultCrudRepository, Filter, Options } from '@loopback/repository';
import { EntityDbDataSource } from '../datasources';
import { ListReactions, ListReactionsRelations } from '../models';

export class ListReactionsRepository extends DefaultCrudRepository<
  ListReactions,
  typeof ListReactions.prototype.id,
  ListReactionsRelations
> {
  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(ListReactions, dataSource);
  }

  async find(filter?: Filter<ListReactions>, options?: Options) {
    return super.find(filter, options);
  }
}
