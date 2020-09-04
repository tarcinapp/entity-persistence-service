import {DefaultCrudRepository, repository, HasManyRepositoryFactory} from '@loopback/repository';
import {ListReactions, ListReactionsRelations, SubReactions} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject, Getter} from '@loopback/core';
import {SubReactionsRepository} from './sub-reactions.repository';

export class ListReactionsRepository extends DefaultCrudRepository<
  ListReactions,
  typeof ListReactions.prototype.id,
  ListReactionsRelations
> {

  public readonly subReactions: HasManyRepositoryFactory<SubReactions, typeof ListReactions.prototype.id>;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource, @repository.getter('SubReactionsRepository') protected subReactionsRepositoryGetter: Getter<SubReactionsRepository>,
  ) {
    super(ListReactions, dataSource);
    this.subReactions = this.createHasManyRepositoryFactoryFor('subReactions', subReactionsRepositoryGetter,);
    this.registerInclusionResolver('subReactions', this.subReactions.inclusionResolver);
  }
}
