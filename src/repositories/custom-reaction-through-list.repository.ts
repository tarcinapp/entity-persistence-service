import { inject } from '@loopback/context';
import {
  Count,
  DataObject,
  Filter,
  Getter,
  Options,
  repository,
  Where,
} from '@loopback/repository';
import { EntityPersistenceBaseRepository } from './entity-persistence-base.repository';
import { EntityDbDataSource } from '../datasources';
import { ListReaction } from '../models';
import { ListReactionsRepository } from './list-reactions.repository';

export class CustomReactionThroughListRepository extends EntityPersistenceBaseRepository<
  ListReaction,
  typeof ListReaction.prototype._id
> {
  protected readonly recordTypeName = 'listReaction';
  public sourceListId: string;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @repository.getter('ListReactionsRepository')
    protected listReactionsRepositoryGetter: Getter<ListReactionsRepository>,
  ) {
    super(ListReaction, dataSource);
  }

  async find(
    filter?: Filter<ListReaction>,
    options?: Options,
  ): Promise<ListReaction[]> {
    const listReactionsRepo = await this.listReactionsRepositoryGetter();

    // Update the filter to only include reactions matching the list ID
    const updatedFilter = {
      ...filter,
      where: { ...filter?.where, _listId: this.sourceListId },
    };

    // For custom repository, we don't use listFilter since we're already scoped to a specific list
    return listReactionsRepo.find(updatedFilter, undefined, options);
  }

  async create(
    data: DataObject<ListReaction>,
    options?: Options,
  ): Promise<ListReaction> {
    const listReactionsRepo = await this.listReactionsRepositoryGetter();

    // Create a new data object with the list ID
    const reactionData = {
      ...data,
      _listId: this.sourceListId,
    } as DataObject<ListReaction>;

    return listReactionsRepo.create(reactionData, options);
  }

  async updateAll(
    data: DataObject<ListReaction>,
    where?: Where<ListReaction>,
    options?: Options,
  ): Promise<Count> {
    const listReactionsRepo = await this.listReactionsRepositoryGetter();

    // Update the where clause to only include reactions matching the list ID
    const updatedWhere = {
      ...where,
      _listId: this.sourceListId,
    };

    // For custom repository, we don't use listWhere since we're already scoped to a specific list
    return listReactionsRepo.updateAll(data, updatedWhere, undefined);
  }

  async deleteAll(
    where?: Where<ListReaction>,
    options?: Options,
  ): Promise<Count> {
    const listReactionsRepo = await this.listReactionsRepositoryGetter();

    // Update the where clause to only include reactions matching the list ID
    const updatedWhere = {
      ...where,
      _listId: this.sourceListId,
    };

    // For custom repository, we don't use listWhere since we're already scoped to a specific list
    return listReactionsRepo.deleteAll(updatedWhere);
  }
}
