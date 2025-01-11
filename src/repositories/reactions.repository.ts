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
import { Reactions, ReactionsRelations, SubReactions } from '../models';
import { SubReactionsRepository } from './sub-reactions.repository';

export class ReactionsRepository extends DefaultCrudRepository<
  Reactions,
  typeof Reactions.prototype.id,
  ReactionsRelations
> {
  public readonly subReactions: HasManyRepositoryFactory<
    SubReactions,
    typeof Reactions.prototype.id
  >;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private static response_limit = _.parseInt(
    process.env.response_limit_entity_reaction ?? '50',
  );

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @repository.getter('SubReactionsRepository')
    protected subReactionsRepositoryGetter: Getter<SubReactionsRepository>,
  ) {
    super(Reactions, dataSource);
    this.subReactions = this.createHasManyRepositoryFactoryFor(
      'subReactions',
      subReactionsRepositoryGetter,
    );
    this.registerInclusionResolver(
      'subReactions',
      this.subReactions.inclusionResolver,
    );
  }

  async find(filter?: Filter<Reactions>, options?: Options) {
    if (filter?.limit && filter.limit > ReactionsRepository.response_limit) {
      filter.limit = ReactionsRepository.response_limit;
    }

    return super.find(filter, options);
  }
}
