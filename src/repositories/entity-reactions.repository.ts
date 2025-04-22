import { inject } from '@loopback/core';
import { DefaultCrudRepository, Filter, Options } from '@loopback/repository';
import { EntityDbDataSource } from '../datasources';
import {
  KindConfigurationReader,
  ValidfromConfigurationReader,
  VisibilityConfigurationReader,
  IdempotencyConfigurationReader,
  ResponseLimitConfigurationReader,
} from '../extensions';
import {
  LookupHelper,
  LookupBindings,
} from '../extensions/utils/lookup-helper';
import { EntityReactions } from '../models';
import { LoggingService } from '../services/logging.service';
import { LookupConstraintBindings } from '../services/lookup-constraint.bindings';
import { LookupConstraintService } from '../services/lookup-constraint.service';
import { RecordLimitCheckerService } from '../services/record-limit-checker.service';

export class EntityReactionsRepository extends DefaultCrudRepository<
  EntityReactions,
  typeof EntityReactions.prototype.id
> {
  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @inject('extensions.kind.configurationreader')
    private kindConfigReader: KindConfigurationReader,
    @inject('extensions.visibility.configurationreader')
    private visibilityConfigReader: VisibilityConfigurationReader,
    @inject('extensions.validfrom.configurationreader')
    private validfromConfigReader: ValidfromConfigurationReader,
    @inject('extensions.idempotency.configurationreader')
    private idempotencyConfigReader: IdempotencyConfigurationReader,
    @inject('extensions.response-limit.configurationreader')
    private responseLimitConfigReader: ResponseLimitConfigurationReader,
    @inject(LookupBindings.HELPER)
    private lookupHelper: LookupHelper,
    @inject('services.LoggingService')
    private loggingService: LoggingService,
    @inject('services.record-limit-checker')
    private recordLimitChecker: RecordLimitCheckerService,
    @inject(LookupConstraintBindings.SERVICE)
    private lookupConstraintService: LookupConstraintService,
  ) {
    super(EntityReactions, dataSource);
  }

  private async processLookups(
    reactions: EntityReactions[],
    filter?: Filter<EntityReactions>,
  ): Promise<EntityReactions[]> {
    if (!filter?.lookup) {
      return reactions;
    }

    // Since EntityReactions is a different type than GenericEntity or List,
    // we need to handle the lookup processing differently
    // For now, we'll return the reactions as is since lookup processing
    // might not be applicable to reactions
    return reactions;
  }

  private async processLookup(
    reaction: EntityReactions,
    filter?: Filter<EntityReactions>,
  ): Promise<EntityReactions> {
    if (!filter?.lookup) {
      return reaction;
    }

    // Since EntityReactions is a different type than GenericEntity or List,
    // we need to handle the lookup processing differently
    // For now, we'll return the reaction as is since lookup processing
    // might not be applicable to reactions
    return reaction;
  }

  async find(
    filter?: Filter<EntityReactions>,
    options?: Options,
  ): Promise<EntityReactions[]> {
    try {
      const limit =
        filter?.limit ??
        this.responseLimitConfigReader.getEntityReactionResponseLimit();

      filter = {
        ...filter,
        limit: Math.min(
          limit,
          this.responseLimitConfigReader.getEntityReactionResponseLimit(),
        ),
      };

      this.loggingService.info(
        'EntityReactionsRepository.find - Modified filter:',
        {
          filter,
        },
      );

      const reactions = await super.find(filter, options);

      return await this.processLookups(reactions, filter);
    } catch (error) {
      this.loggingService.error('EntityReactionsRepository.find - Error:', {
        error,
      });
      throw error;
    }
  }
}
