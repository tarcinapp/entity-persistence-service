import { Getter, inject } from '@loopback/core';
import {
  Count,
  Filter,
  HasManyRepositoryFactory,
  InclusionResolver,
  Options,
  Where,
  repository,
} from '@loopback/repository';
import { EntityRepository } from './entity.repository';
import { ListEntityRelationRepository } from './list-entity-relation.repository';
import { ListReactionsRepository } from './list-reactions.repository';
import { EntityDbDataSource } from '../../datasources';
import {
  IdempotencyConfigurationReader,
  KindConfigurationReader,
  ValidfromConfigurationReader,
  VisibilityConfigurationReader,
} from '../../extensions';
import { ResponseLimitConfigurationReader } from '../../extensions/config-helpers/response-limit-config-helper';
import {
  LookupBindings,
  LookupHelper,
} from '../../extensions/utils/lookup-helper';
import {
  GenericEntity,
  List,
  ListToEntityRelation,
  ListReaction,
  ListRelations,
} from '../../models';
import { LoggingService } from '../../services/logging.service';
import { LookupConstraintBindings } from '../../services/lookup-constraint.bindings';
import { LookupConstraintService } from '../../services/lookup-constraint.service';
import { RecordLimitCheckerBindings } from '../../services/record-limit-checker.bindings';
import { RecordLimitCheckerService } from '../../services/record-limit-checker.service';
import { EntityPersistenceBusinessRepository } from '../base/entity-persistence-business.repository';
import {
  CustomEntityThroughListRepository,
  CustomRepositoriesBindings,
} from '../custom';

/**
 * ListRepository - Concrete repository for List model.
 *
 * This repository extends EntityPersistenceBusinessRepository (Level 2A) and provides
 * only list-specific functionality. All common business logic (CRUD, validation,
 * lifecycle management) is inherited from the base class.
 *
 * ## List-Specific Features:
 * - Relations: entities (through pivot table), reactions (hasMany)
 * - Parent/child list relationships via _parents field
 * - Cascading deletes for relations and reactions
 * - Custom entities inclusion resolver with whereThrough support
 *
 * ## Inherited from Base:
 * - find, findById, create, replaceById, updateById, updateAll
 * - Validation, idempotency, slug generation, count fields
 * - Kind validation, lookup processing, findParents, findChildren, createChild
 */
export class ListRepository extends EntityPersistenceBusinessRepository<
  List,
  typeof List.prototype._id,
  ListRelations
> {
  // ABSTRACT PROPERTY IMPLEMENTATIONS
  protected readonly recordTypeName = 'list';
  protected readonly entityTypeName = 'List';
  protected readonly errorCodePrefix = 'LIST';
  protected readonly uriPathSegment = 'lists';

  // RELATIONS
  public readonly entities: (
    listId: typeof List.prototype._id,
  ) => Promise<CustomEntityThroughListRepository>;

  public readonly reactions: HasManyRepositoryFactory<
    ListReaction,
    typeof List.prototype._id
  >;

  constructor(
    @inject('datasources.EntityDb')
    dataSource: EntityDbDataSource,

    @repository.getter('ListEntityRelationRepository')
    protected listEntityRelationRepositoryGetter: Getter<ListEntityRelationRepository>,

    @repository.getter('EntityRepository')
    protected entityRepositoryGetter: Getter<EntityRepository>,

    @repository.getter('ListReactionsRepository')
    protected reactionsRepositoryGetter: Getter<ListReactionsRepository>,

    @inject.getter(
      CustomRepositoriesBindings.CUSTOM_ENTITY_THROUGH_LIST_REPOSITORY,
    )
    protected customEntityThroughListRepositoryGetter: Getter<CustomEntityThroughListRepository>,

    @repository.getter('ListRepository')
    protected listRepositoryGetter: Getter<ListRepository>,

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

    @inject(RecordLimitCheckerBindings.SERVICE)
    protected readonly recordLimitChecker: RecordLimitCheckerService,

    @inject(LookupConstraintBindings.SERVICE)
    protected readonly lookupConstraintService: LookupConstraintService,
  ) {
    super(List, dataSource);

    // Setup reactions relation
    this.reactions = this.createHasManyRepositoryFactoryFor(
      '_reactions',
      reactionsRepositoryGetter,
    );
    this.registerInclusionResolver(
      '_reactions',
      this.reactions.inclusionResolver,
    );

    // Define the entities method (through pivot table)
    this.entities = async (listId: typeof List.prototype._id) => {
      // First verify that the list exists - this will throw 404 if not found
      await this.findById(listId);

      const repo = await this.customEntityThroughListRepositoryGetter();

      // set the sourceListId to the custom repo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (repo as any).sourceListId = listId;

      return repo;
    };

    // Register custom entities inclusion resolver
    this.registerInclusionResolver(
      '_entities',
      this.createEntitiesInclusionResolver(
        listEntityRelationRepositoryGetter,
        entityRepositoryGetter,
      ),
    );
  }

  // ABSTRACT HOOK METHOD IMPLEMENTATIONS
  protected getDefaultKind(): string {
    return this.kindConfigReader.defaultListKind;
  }

  protected getIdempotencyFields(kind?: string): string[] {
    return this.idempotencyConfigReader.getIdempotencyForLists(kind);
  }

  protected getVisibilityForKind(kind?: string): string {
    return this.visibilityConfigReader.getVisibilityForLists(kind);
  }

  protected getValidFromForKind(kind?: string): boolean {
    return this.validfromConfigReader.getValidFromForLists(kind);
  }

  protected getResponseLimit(): number {
    return this.responseLimitConfigReader.getListResponseLimit();
  }

  protected isKindAcceptable(kind: string): boolean {
    return this.kindConfigReader.isKindAcceptableForList(kind);
  }

  protected getAllowedKinds(): string[] {
    return this.kindConfigReader.allowedKindsForLists;
  }

  // LIST-SPECIFIC: CASCADE DELETE OPERATIONS
  async deleteById(id: string, options?: Options): Promise<void> {
    const listEntityRelationRepo =
      await this.listEntityRelationRepositoryGetter();
    const reactionsRepo = await this.reactionsRepositoryGetter();

    // Delete all relations associated with the list
    await listEntityRelationRepo.deleteAll({ _listId: id }, options);

    // Delete all reactions associated with the list
    await reactionsRepo.deleteAll({ _listId: id }, options);

    return super.deleteById(id, options);
  }

  async deleteAll(where?: Where<List>, options?: Options): Promise<Count> {
    const listEntityRelationRepo =
      await this.listEntityRelationRepositoryGetter();
    const reactionsRepo = await this.reactionsRepositoryGetter();

    this.loggingService.info('ListRepository.deleteAll - Where condition:', {
      where,
    });

    // Get IDs of lists to delete
    const idsToDelete = (
      await this.find({ where, fields: ['_id'] }, options)
    ).map((list) => list._id);

    // Delete all relations by matching _listId
    await listEntityRelationRepo.deleteAll(
      { _listId: { inq: idsToDelete } },
      options,
    );

    // Delete all reactions associated with the lists
    await reactionsRepo.deleteAll({ _listId: { inq: idsToDelete } }, options);

    return super.deleteAll(where, options);
  }

  // LIST-SPECIFIC: CUSTOM INCLUSION RESOLVER
  /**
   * Custom inclusion resolver for the _entities relation aware of whereThrough and setThrough
   * @param listEntityRelationRepositoryGetter
   * @param entityRepositoryGetter
   * @returns
   */
  createEntitiesInclusionResolver(
    listEntityRelationRepositoryGetter: Getter<ListEntityRelationRepository>,
    entityRepositoryGetter: Getter<EntityRepository>,
  ): InclusionResolver<List, GenericEntity> {
    return async (lists, inclusion) => {
      const listEntityRelationRepo = await listEntityRelationRepositoryGetter();
      const entityRepo = await entityRepositoryGetter();

      // Extract filters from the inclusion object
      const relationFilter: Where<ListToEntityRelation> =
        typeof inclusion === 'object' ? (inclusion.whereThrough ?? {}) : {};
      const entityFilter = typeof inclusion === 'object' ? inclusion.scope : {};

      // Find relationships that match the provided filters
      const listEntityRelations = await listEntityRelationRepo.find({
        where: {
          _listId: { inq: lists.map((l) => l._id) },
          ...relationFilter, // Apply dynamic filters to the through model
        },
      });

      const entityIds = listEntityRelations.map(
        (rel: ListToEntityRelation) => rel._entityId,
      );

      // Find entities matching the related IDs and any additional filters
      const entities = await entityRepo.find({
        where: {
          _id: { inq: entityIds },
          ...entityFilter?.where, // Apply additional filters for the entity
        },
        ...entityFilter, // Apply entity-level filters like limit, order, etc.
      });

      // Map entities back to their respective lists
      const entitiesByListId = new Map<string | undefined, GenericEntity[]>();

      listEntityRelations.forEach((rel: ListToEntityRelation) => {
        if (!entitiesByListId.has(rel._listId)) {
          entitiesByListId.set(rel._listId, []);
        }

        const entity = entities.find((e) => e._id === rel._entityId);
        if (entity) {
          entitiesByListId.get(rel._listId)?.push(entity);
        }
      });

      // Return entities grouped by list, preserving the order of the lists
      return lists.map((list) => entitiesByListId.get(list._id) ?? []);
    };
  }
}
