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
import { EntityReaction } from '../models';
import { EntityReactionsRepository } from './entity-reactions.repository';

export class CustomReactionThroughEntityRepository extends EntityPersistenceBaseRepository<
  EntityReaction,
  typeof EntityReaction.prototype._id
> {
  protected readonly recordTypeName = 'entityReaction';
  public sourceEntityId: string;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @repository.getter('EntityReactionsRepository')
    protected entityReactionsRepositoryGetter: Getter<EntityReactionsRepository>,
  ) {
    super(EntityReaction, dataSource);
  }

  async find(
    filter?: Filter<EntityReaction>,
    options?: Options,
  ): Promise<EntityReaction[]> {
    const entityReactionsRepo = await this.entityReactionsRepositoryGetter();

    // Update the filter to only include reactions matching the entity ID
    const updatedFilter = {
      ...filter,
      where: { ...filter?.where, _entityId: this.sourceEntityId },
    };

    return entityReactionsRepo.find(updatedFilter, options);
  }

  async create(
    data: DataObject<EntityReaction>,
    options?: Options,
  ): Promise<EntityReaction> {
    const entityReactionsRepo = await this.entityReactionsRepositoryGetter();

    // Create a new data object with the entity ID
    const reactionData = {
      ...data,
      _entityId: this.sourceEntityId,
    } as DataObject<EntityReaction>;

    return entityReactionsRepo.create(reactionData, options);
  }

  async updateAll(
    data: DataObject<EntityReaction>,
    where?: Where<EntityReaction>,
    options?: Options,
  ): Promise<Count> {
    const entityReactionsRepo = await this.entityReactionsRepositoryGetter();

    // Update the where clause to only include reactions matching the entity ID
    const updatedWhere = {
      ...where,
      _entityId: this.sourceEntityId,
    };

    return entityReactionsRepo.updateAll(data, updatedWhere, options);
  }

  async deleteAll(
    where?: Where<EntityReaction>,
    options?: Options,
  ): Promise<Count> {
    const entityReactionsRepo = await this.entityReactionsRepositoryGetter();

    // Update the where clause to only include reactions matching the entity ID
    const updatedWhere = {
      ...where,
      _entityId: this.sourceEntityId,
    };

    return entityReactionsRepo.deleteAll(updatedWhere, options);
  }
}
