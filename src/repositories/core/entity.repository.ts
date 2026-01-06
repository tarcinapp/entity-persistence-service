import { Getter, inject } from '@loopback/core';
import {
  Count,
  HasManyRepositoryFactory,
  Options,
  Where,
  repository,
} from '@loopback/repository';

import { EntityReactionsRepository } from './entity-reactions.repository';
import { ListEntityRelationRepository } from './list-entity-relation.repository';
import { ListRepository } from './list.repository';
import { EntityDbDataSource } from '../../datasources';
import {
  IdempotencyConfigurationReader,
  KindConfigurationReader,
  ValidfromConfigurationReader,
  VisibilityConfigurationReader,
} from '../../extensions';

import { ResponseLimitConfigurationReader } from '../../extensions/config-helpers/response-limit-config-helper';
import {
  LookupHelper,
  LookupBindings,
} from '../../extensions/utils/lookup-helper';
import {
  GenericEntity,
  GenericEntityRelations,
  EntityReaction,
} from '../../models';
import { LoggingService } from '../../services/logging.service';
import { LookupConstraintBindings } from '../../services/lookup-constraint.bindings';
import { LookupConstraintService } from '../../services/lookup-constraint.service';
import { RecordLimitCheckerService } from '../../services/record-limit-checker.service';
import { EntityPersistenceBusinessRepository } from '../base/entity-persistence-business.repository';
import {
  CustomListThroughEntityRepository,
  CustomRepositoriesBindings,
} from '../custom';

/**
 * EntityRepository - Concrete repository for GenericEntity model.
 *
 * This repository extends EntityPersistenceBusinessRepository (Level 2A) and provides
 * only entity-specific functionality. All common business logic (CRUD, validation,
 * lifecycle management) is inherited from the base class.
 *
 * ## Entity-Specific Features:
 * - Relations: lists (through pivot table), reactions (hasMany)
 * - Parent/child entity relationships via _parents field
 * - Cascading deletes for relations and reactions
 *
 * ## Inherited from Base:
 * - find, findById, create, replaceById, updateById, updateAll
 * - Validation, idempotency, slug generation, count fields
 * - Kind validation, lookup processing
 */
export class EntityRepository extends EntityPersistenceBusinessRepository<
  GenericEntity,
  typeof GenericEntity.prototype._id,
  GenericEntityRelations
> {
  // ABSTRACT PROPERTY IMPLEMENTATIONS
  protected readonly recordTypeName = 'entity';
  protected readonly entityTypeName = 'Entity';
  protected readonly errorCodePrefix = 'ENTITY';
  protected readonly uriPathSegment = 'entities';

  // RELATIONS
  public readonly lists: (
    entityId: typeof GenericEntity.prototype._id,
  ) => Promise<CustomListThroughEntityRepository>;

  public readonly reactions: HasManyRepositoryFactory<
    EntityReaction,
    typeof GenericEntity.prototype._id
  >;

  constructor(
    @inject('datasources.EntityDb')
    dataSource: EntityDbDataSource,

    @repository.getter('ListRepository')
    protected listRepositoryGetter: Getter<ListRepository>,

    @repository.getter('EntityReactionsRepository')
    protected reactionsRepositoryGetter: Getter<EntityReactionsRepository>,

    @repository.getter('ListEntityRelationRepository')
    protected listEntityRelationRepositoryGetter: Getter<ListEntityRelationRepository>,

    @inject.getter(
      CustomRepositoriesBindings.CUSTOM_LIST_THROUGH_ENTITY_REPOSITORY,
    )
    protected customListThroughEntityRepositoryGetter: Getter<CustomListThroughEntityRepository>,

    @inject('extensions.kind.configurationreader')
    protected readonly kindConfigReader: KindConfigurationReader,

    @inject('extensions.visibility.configurationreader')
    protected readonly visibilityConfigReader: VisibilityConfigurationReader,

    @inject('extensions.validfrom.configurationreader')
    protected readonly validfromConfigReader: ValidfromConfigurationReader,

    @inject('extensions.idempotency.configurationreader')
    protected readonly idempotencyConfigReader: IdempotencyConfigurationReader,

    @inject('extensions.response-limit.configurationreader')
    protected readonly responseLimitConfigReader: ResponseLimitConfigurationReader,

    @inject(LookupBindings.HELPER)
    protected readonly lookupHelper: LookupHelper,

    @inject('services.LoggingService')
    protected readonly loggingService: LoggingService,

    @inject('services.record-limit-checker')
    protected readonly recordLimitChecker: RecordLimitCheckerService,

    @inject(LookupConstraintBindings.SERVICE)
    protected readonly lookupConstraintService: LookupConstraintService,
  ) {
    super(GenericEntity, dataSource);

    // Setup reactions relation
    this.reactions = this.createHasManyRepositoryFactoryFor(
      '_reactions',
      reactionsRepositoryGetter,
    );
    this.registerInclusionResolver(
      '_reactions',
      this.reactions.inclusionResolver,
    );

    // Setup lists relation (through pivot table)
    this.lists = async (entityId: typeof GenericEntity.prototype._id) => {
      const repo = await this.customListThroughEntityRepositoryGetter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (repo as any).sourceEntityId = entityId;

      return repo;
    };
  }

  // ABSTRACT HOOK METHOD IMPLEMENTATIONS
  protected getDefaultKind(): string {
    return this.kindConfigReader.defaultEntityKind;
  }

  protected getIdempotencyFields(kind?: string): string[] {
    return this.idempotencyConfigReader.getIdempotencyForEntities(kind);
  }

  protected getVisibilityForKind(kind?: string): string {
    return this.visibilityConfigReader.getVisibilityForEntities(kind);
  }

  protected getValidFromForKind(kind?: string): boolean {
    return this.validfromConfigReader.getValidFromForEntities(kind);
  }

  protected getResponseLimit(): number {
    return this.responseLimitConfigReader.getEntityResponseLimit();
  }

  protected isKindAcceptable(kind: string): boolean {
    return this.kindConfigReader.isKindAcceptableForEntity(kind);
  }

  protected getAllowedKinds(): string[] {
    return this.kindConfigReader.allowedKindsForEntities;
  }

  // ENTITY-SPECIFIC: CASCADE DELETE OPERATIONS
  async deleteById(id: string, options?: Options): Promise<void> {
    const listEntityRelationRepo =
      await this.listEntityRelationRepositoryGetter();
    const reactionsRepo = await this.reactionsRepositoryGetter();

    // Delete all relations associated with the entity
    await listEntityRelationRepo.deleteAll({ _entityId: id });

    // Delete all reactions associated with the entity
    await reactionsRepo.deleteAll({ _entityId: id });

    return super.deleteById(id, options);
  }

  async deleteAll(
    where?: Where<GenericEntity>,
    options?: Options,
  ): Promise<Count> {
    const listEntityRelationRepo =
      await this.listEntityRelationRepositoryGetter();
    const reactionsRepo = await this.reactionsRepositoryGetter();

    this.loggingService.info('EntityRepository.deleteAll - Where condition:', {
      where,
    });

    // Get IDs of entities to delete
    const idsToDelete = (await this.find({ where, fields: ['_id'] })).map(
      (entity) => entity._id,
    );

    // Delete all relations by matching _entityId
    await listEntityRelationRepo.deleteAll({ _entityId: { inq: idsToDelete } });

    // Delete all reactions associated with the entities
    await reactionsRepo.deleteAll({ _entityId: { inq: idsToDelete } });

    return super.deleteAll(where, options);
  }
}
