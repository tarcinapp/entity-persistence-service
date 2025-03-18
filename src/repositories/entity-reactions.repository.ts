import { inject } from '@loopback/core';
import { DefaultCrudRepository, Filter, Options } from '@loopback/repository';
import { EntityDbDataSource } from '../datasources';
import { EntityReactions } from '../models';

export class EntityReactionsRepository extends DefaultCrudRepository<
  EntityReactions,
  typeof EntityReactions.prototype.id
> {
  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(EntityReactions, dataSource);
  }

  async find(filter?: Filter<EntityReactions>, options?: Options) {
    return super.find(filter, options);
  }
}
