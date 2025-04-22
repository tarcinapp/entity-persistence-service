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

  async find(filter?: Filter<EntityReactions>, options?: Options) {
    return super.find(filter, options);
  }
}
