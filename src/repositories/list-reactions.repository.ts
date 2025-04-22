import { inject } from '@loopback/core';
import { DefaultCrudRepository, Filter, Options } from '@loopback/repository';
import { EntityDbDataSource } from '../datasources';
import { ListReaction, ListReactionsRelations } from '../models';

export class ListReactionsRepository extends DefaultCrudRepository<
  ListReaction,
  typeof ListReaction.prototype.id,
  ListReactionsRelations
> {
  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(ListReaction, dataSource);
  }

  async find(filter?: Filter<ListReaction>, options?: Options) {
    return super.find(filter, options);
  }
}
