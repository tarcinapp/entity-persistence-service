import { inject } from '@loopback/core';
import { Filter, FilterBuilder, Where } from '@loopback/repository';
import { AnyObject } from '@loopback/repository/dist/common-types';
import { RestBindings } from '@loopback/rest';
import _ from 'lodash';
import { LoggingService } from '../../services/logging.service';
import { Set, SetFilterBuilder as UtilsSetFilterBuilder } from '../utils/set-helper';

export class SetFilterBuilder<T extends object = AnyObject> {
  constructor(
    private set: Set,
    private options?: { filter?: Filter<T> },
    @inject('services.LoggingService', { optional: true })
    private loggingService?: LoggingService,
    @inject(RestBindings.Http.REQUEST, { optional: true })
    private request?: any,
  ) {}

  build(): Filter<T> {
    // Log the set being used
    if (this.loggingService) {
      this.loggingService.debug(
        `Building filter from set: ${JSON.stringify(this.set, null, 2)}`,
        {},
        this.request,
      );
    }

    const where = this.buildWhere();

    // Log the resulting where clause
    if (this.loggingService) {
      this.loggingService.debug(
        `Set filter produced where clause: ${JSON.stringify(where, null, 2)}`,
        {},
        this.request,
      );
    }

    if (!this.options?.filter) {
      return new FilterBuilder<T>({
        where: where as Where<T>,
      }).build();
    } else {
      const filter = _.cloneDeep(this.options.filter);
      const whereFilter = new FilterBuilder<T>({
        where: where as Where<T>,
      }).build();
      filter.where = this.mergeWhere(whereFilter.where, filter.where);

      // Log the final merged filter
      if (this.loggingService) {
        this.loggingService.debug(
          `Final merged filter: ${JSON.stringify(filter, null, 2)}`,
          {},
          this.request,
        );
      }

      return filter;
    }
  }

  private buildWhere(): Where<AnyObject> {
    // Handle logical combinators first
    if (this.set.and) {
      const andConditions = this.set.and.map((andSet) => {
        const builder = new UtilsSetFilterBuilder<AnyObject>(andSet);

        return builder.build().where;
      });

      return {
        and: andConditions,
      };
    }

    if (this.set.or) {
      const orConditions = this.set.or.map((orSet) => {
        const builder = new UtilsSetFilterBuilder<AnyObject>(orSet);

        return builder.build().where;
      });

      return {
        or: orConditions,
      };
    }

    // Delegate other single-key sets (including dynamic-duration sets)
    const utilBuilder = new UtilsSetFilterBuilder<AnyObject>(this.set as AnyObject);
    return utilBuilder.build().where as Where<AnyObject>;
  }

  private mergeWhere(whereA?: Where<T>, whereB?: Where<T>): Where<T> {
    if (!whereA) {
      return whereB || {};
    }

    if (!whereB) {
      return whereA;
    }

    return {
      and: [whereA, whereB],
    };
  }
}
