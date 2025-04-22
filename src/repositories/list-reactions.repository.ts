import { inject } from '@loopback/core';
import { DefaultCrudRepository, Filter, Options } from '@loopback/repository';
import { EntityDbDataSource } from '../datasources';
import { ListReaction, ListReactionRelations } from '../models';

export class ListReactionsRepository extends DefaultCrudRepository<
  ListReaction,
  typeof ListReaction.prototype.id,
  ListReactionRelations
> {
  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(ListReaction, dataSource);
  }

  async find(filter?: Filter<ListReaction>, options?: Options) {
    return super.find(filter, options);
  }
}
