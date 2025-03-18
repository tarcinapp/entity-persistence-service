import { inject } from '@loopback/core';
import { DefaultCrudRepository, Filter, Options } from '@loopback/repository';
import { EntityDbDataSource } from '../datasources';
import { EntityReactions, ReactionsRelations } from '../models';

export class ReactionsRepository extends DefaultCrudRepository<
  EntityReactions,
  typeof EntityReactions.prototype.id,
  ReactionsRelations
> {
  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(EntityReactions, dataSource);
  }

  async find(filter?: Filter<EntityReactions>, options?: Options) {
    return super.find(filter, options);
  }
}
