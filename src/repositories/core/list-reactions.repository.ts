import { inject, Getter } from '@loopback/core';
import { DataObject, repository } from '@loopback/repository';
import { ListRepository } from './list.repository';
import { EntityDbDataSource } from '../../datasources';
import {
  KindConfigurationReader,
  ValidfromConfigurationReader,
  VisibilityConfigurationReader,
  IdempotencyConfigurationReader,
} from '../../extensions';
import { CollectionConfigHelper } from '../../extensions/config-helpers/collection-config-helper';
import { ResponseLimitConfigurationReader } from '../../extensions/config-helpers/response-limit-config-helper';
import {
  LookupHelper,
  LookupBindings,
} from '../../extensions/utils/lookup-helper';
import {
  MongoPipelineHelper,
  MongoPipelineHelperBindings,
} from '../../extensions/utils/mongo-pipeline-helper';
import { ListReaction, HttpErrorResponse } from '../../models';
import { LoggingService } from '../../services/logging.service';
import { LookupConstraintBindings } from '../../services/lookup-constraint.bindings';
import { LookupConstraintService } from '../../services/lookup-constraint.service';
import { RecordLimitCheckerBindings } from '../../services/record-limit-checker.bindings';
import { RecordLimitCheckerService } from '../../services/record-limit-checker.service';
import { EntityPersistenceReactionRepository } from '../base/entity-persistence-reaction.repository';

/**
 * ListReactionsRepository - Concrete repository for ListReaction model.
 *
 * This repository extends EntityPersistenceReactionRepository (Level 2B) and provides
 * only list-reaction-specific functionality. All common reaction logic (CRUD, validation,
 * lifecycle management, hierarchical relationships) is inherited from the base class.
 *
 * ## List-Reaction-Specific Features:
 * - Target existence check: verifies List exists before creating reaction
 * - Configuration hooks: connects to ListReaction-specific config readers
 * - Collection names: points to lists and list-reactions collections
 *
 * ## Inherited from Base:
 * - find, findById, count, create, updateById, replaceById, updateAll, deleteById, deleteAll
 * - findParents, findChildren, createChild
 * - Idempotency, validation, slug generation, count fields
 * - MongoDB pipeline aggregation
 */
export class ListReactionsRepository extends EntityPersistenceReactionRepository<
  ListReaction,
  typeof ListReaction.prototype.id
> {
  // ABSTRACT IDENTITY PROPERTY IMPLEMENTATIONS
  protected readonly recordTypeName = 'listReaction';
  protected readonly reactionTypeName = 'List reaction';
  protected readonly errorCodePrefix = 'LIST-REACTION';
  protected readonly uriPathSegment = 'list-reactions';
  protected readonly sourceIdFieldName = '_listId';

  constructor(
    @inject('datasources.EntityDb')
    dataSource: EntityDbDataSource,

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

    @inject(MongoPipelineHelperBindings.HELPER)
    protected readonly mongoPipelineHelper: MongoPipelineHelper,

    @repository.getter('ListRepository')
    protected listRepositoryGetter: Getter<ListRepository>,
  ) {
    super(ListReaction, dataSource);
  }

  // ABSTRACT HOOK METHOD IMPLEMENTATIONS - Configuration
  protected getDefaultKind(): string {
    return this.kindConfigReader.defaultListReactionKind;
  }

  protected getIdempotencyFields(kind?: string): string[] {
    return this.idempotencyConfigReader.getIdempotencyForListReactions(kind);
  }

  protected getVisibilityForKind(kind?: string): string {
    return this.visibilityConfigReader.getVisibilityForListReactions(kind);
  }

  protected getValidFromForKind(kind?: string): boolean {
    return this.validfromConfigReader.getValidFromForListReactions(kind);
  }

  protected getResponseLimit(): number {
    return this.responseLimitConfigReader.getListReactionResponseLimit();
  }

  protected isKindAcceptable(kind: string): boolean {
    return this.kindConfigReader.isKindAcceptableForListReactions(kind);
  }

  protected getAllowedKinds(): string[] {
    return this.kindConfigReader.allowedKindsForListReactions;
  }

  // ABSTRACT HOOK METHOD IMPLEMENTATIONS - Target Existence
  /**
   * Check if the referenced List exists before creating/updating a reaction.
   */
  protected async checkTargetExistence(
    data: DataObject<ListReaction>,
  ): Promise<void> {
    if (data._listId) {
      try {
        const listRepository = await this.listRepositoryGetter();
        await listRepository.findById(data._listId);
      } catch (error) {
        if (
          error.code === 'ENTITY_NOT_FOUND' ||
          error.code === 'LIST-NOT-FOUND'
        ) {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: 'NotFoundError',
            message: `List with id '${data._listId}' could not be found.`,
            code: 'LIST-NOT-FOUND',
          });
        }

        throw error;
      }
    }
  }

  // ABSTRACT HOOK METHOD IMPLEMENTATIONS - MongoDB Pipeline
  protected getSourceCollectionName(): string {
    return CollectionConfigHelper.getInstance().getListCollectionName();
  }

  protected getReactionsCollectionName(): string {
    return CollectionConfigHelper.getInstance().getListReactionsCollectionName();
  }
}
