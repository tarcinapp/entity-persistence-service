import {DefaultCrudRepository, repository, HasManyRepositoryFactory} from '@loopback/repository';
import {Reactions, ReactionsRelations, SubReactions} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject, Getter} from '@loopback/core';
import {SubReactionsRepository} from './sub-reactions.repository';

export class ReactionsRepository extends DefaultCrudRepository<
  Reactions,
  typeof Reactions.prototype.id,
  ReactionsRelations
> {

  public readonly subReactions: HasManyRepositoryFactory<SubReactions, typeof Reactions.prototype.id>;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource, @repository.getter('SubReactionsRepository') protected subReactionsRepositoryGetter: Getter<SubReactionsRepository>,
  ) {
    super(Reactions, dataSource);
    this.subReactions = this.createHasManyRepositoryFactoryFor('subReactions', subReactionsRepositoryGetter,);
    this.registerInclusionResolver('subReactions', this.subReactions.inclusionResolver);
  }
}
