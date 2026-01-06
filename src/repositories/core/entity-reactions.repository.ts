import { inject, Getter } from '@loopback/core';
import { DataObject, repository, Options } from '@loopback/repository';
import { EntityRepository } from './entity.repository';
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
import { EntityReaction, HttpErrorResponse } from '../../models';
import { LoggingService } from '../../services/logging.service';
import { LookupConstraintBindings } from '../../services/lookup-constraint.bindings';
import { LookupConstraintService } from '../../services/lookup-constraint.service';
import { RecordLimitCheckerBindings } from '../../services/record-limit-checker.bindings';
import { RecordLimitCheckerService } from '../../services/record-limit-checker.service';
import { EntityPersistenceReactionRepository } from '../base/entity-persistence-reaction.repository';

/**
 * EntityReactionsRepository - Concrete repository for EntityReaction model.
 *
 * This repository extends EntityPersistenceReactionRepository and provides
 * only entity-reaction-specific functionality. All common reaction logic (CRUD, validation,
 * lifecycle management, hierarchical relationships) is inherited from the base class.
 *
 * ## Entity-Reaction-Specific Features:
 * - Target existence check: verifies Entity exists before creating reaction
 * - Configuration hooks: connects to EntityReaction-specific config readers
 * - Collection names: points to entity and entity-reactions collections
 *
 * ## Inherited from Base:
 * - find, findById, count, create, updateById, replaceById, updateAll, deleteById, deleteAll
 * - findParents, findChildren, createChild
 * - Idempotency, validation, slug generation, count fields
 * - MongoDB pipeline aggregation
 */
export class EntityReactionsRepository extends EntityPersistenceReactionRepository<
  EntityReaction,
  typeof EntityReaction.prototype.id
> {
  // ABSTRACT IDENTITY PROPERTY IMPLEMENTATIONS
  protected readonly recordTypeName = 'entityReaction';
  protected readonly reactionTypeName = 'Entity reaction';
  protected readonly errorCodePrefix = 'ENTITY-REACTION';
  protected readonly uriPathSegment = 'entity-reactions';
  protected readonly sourceIdFieldName = '_entityId';

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

    @repository.getter('EntityRepository')
    protected entityRepositoryGetter: Getter<EntityRepository>,
  ) {
    super(EntityReaction, dataSource);
  }

  // ABSTRACT HOOK METHOD IMPLEMENTATIONS - Configuration
  protected getDefaultKind(): string {
    return this.kindConfigReader.defaultEntityReactionKind;
  }

  protected getIdempotencyFields(kind?: string): string[] {
    return this.idempotencyConfigReader.getIdempotencyForEntityReactions(kind);
  }

  protected getVisibilityForKind(kind?: string): string {
    return this.visibilityConfigReader.getVisibilityForEntityReactions(kind);
  }

  protected getValidFromForKind(kind?: string): boolean {
    return this.validfromConfigReader.getValidFromForEntityReactions(kind);
  }

  protected getResponseLimit(): number {
    return this.responseLimitConfigReader.getEntityReactionResponseLimit();
  }

  protected isKindAcceptable(kind: string): boolean {
    return this.kindConfigReader.isKindAcceptableForEntityReactions(kind);
  }

  protected getAllowedKinds(): string[] {
    return this.kindConfigReader.allowedKindsForEntityReactions;
  }

  // ABSTRACT HOOK METHOD IMPLEMENTATIONS - Target Existence
  /**
   * Check if the referenced Entity exists before creating/updating a reaction.
   */
  protected async checkTargetExistence(
    data: DataObject<EntityReaction>,
    options?: Options,
  ): Promise<void> {
    if (data._entityId) {
      try {
        const entityRepository = await this.entityRepositoryGetter();
        await entityRepository.findById(data._entityId, undefined, options);
      } catch (error) {
        if (
          error.code === 'ENTITY_NOT_FOUND' ||
          error.code === 'ENTITY-NOT-FOUND'
        ) {
          throw new HttpErrorResponse({
            statusCode: 404,
            name: 'NotFoundError',
            message: `Entity with id '${data._entityId}' could not be found.`,
            code: 'ENTITY-NOT-FOUND',
          });
        }

        throw error;
      }
    }
  }

  // ABSTRACT HOOK METHOD IMPLEMENTATIONS - MongoDB Pipeline
  protected getSourceCollectionName(): string {
    return CollectionConfigHelper.getInstance().getEntityCollectionName();
  }

  protected getReactionsCollectionName(): string {
    return CollectionConfigHelper.getInstance().getEntityReactionsCollectionName();
  }
}
