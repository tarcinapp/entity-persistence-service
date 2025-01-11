import { inject } from '@loopback/core';
import { DefaultCrudRepository, Filter, Options } from '@loopback/repository';
import _ from 'lodash';
import { EntityDbDataSource } from '../datasources';
import { SubListReactions, SubListReactionsRelations } from '../models';

export class SubListReactionsRepository extends DefaultCrudRepository<
  SubListReactions,
  typeof SubListReactions.prototype.id,
  SubListReactionsRelations
> {
  private static response_limit = _.parseInt(
    process.env.response_limit_list_reaction ?? '50',
  );

  constructor(@inject('datasources.EntityDb') dataSource: EntityDbDataSource) {
    super(SubListReactions, dataSource);
  }

  async find(filter?: Filter<SubListReactions>, options?: Options) {
    if (
      filter?.limit &&
      filter.limit > SubListReactionsRepository.response_limit
    ) {
      filter.limit = SubListReactionsRepository.response_limit;
    }

    return super.find(filter, options);
  }
}
