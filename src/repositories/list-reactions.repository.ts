import { Getter, inject } from '@loopback/core';
import {
  DefaultCrudRepository,
  Filter,
  HasManyRepositoryFactory,
  Options,
  repository,
} from '@loopback/repository';
import _ from 'lodash';
import { EntityDbDataSource } from '../datasources';
import { ListReactions, ListReactionsRelations, SubReactions } from '../models';
import { SubReactionsRepository } from './sub-reactions.repository';

export class ListReactionsRepository extends DefaultCrudRepository<
  ListReactions,
  typeof ListReactions.prototype.id,
  ListReactionsRelations
> {
  public readonly subReactions: HasManyRepositoryFactory<
    SubReactions,
    typeof ListReactions.prototype.id
  >;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private static response_limit = _.parseInt(
    process.env.response_limit_list_reaction ?? '50',
  );

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @repository.getter('SubReactionsRepository')
    protected subReactionsRepositoryGetter: Getter<SubReactionsRepository>,
  ) {
    super(ListReactions, dataSource);
    this.subReactions = this.createHasManyRepositoryFactoryFor(
      'subReactions',
      subReactionsRepositoryGetter,
    );
    this.registerInclusionResolver(
      'subReactions',
      this.subReactions.inclusionResolver,
    );
  }

  async find(filter?: Filter<ListReactions>, options?: Options) {
    if (
      filter?.limit &&
      filter.limit > ListReactionsRepository.response_limit
    ) {
      filter.limit = ListReactionsRepository.response_limit;
    }

    return super.find(filter, options);
  }
}
