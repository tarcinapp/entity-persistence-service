import { inject } from '@loopback/core';
import { DefaultCrudRepository, Filter, Options } from '@loopback/repository';
import _ from 'lodash';
import { EntityDbDataSource } from '../datasources';
import { SubReactions, SubReactionsRelations } from '../models';

export class SubReactionsRepository extends DefaultCrudRepository<
  SubReactions,
  typeof SubReactions.prototype.id,
  SubReactionsRelations
> {
  private static response_limit = _.parseInt(
    process.env.response_limit_entity_reaction || '50',
  );

  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(SubReactions, dataSource);
  }

  async find(filter?: Filter<SubReactions>, options?: Options) {
    if (filter?.limit && filter.limit > SubReactionsRepository.response_limit)
      filter.limit = SubReactionsRepository.response_limit;

    return super.find(filter, options);
  }
}
