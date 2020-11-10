import {AnyObject} from '@loopback/repository/dist/common-types';
import {Filter, FilterBuilder, Where, WhereBuilder} from '@loopback/repository/dist/query';
import _ from 'lodash';

export interface AndClause {
  and?: Set[];
}

export interface OrClause {
  or?: Set[];
}

export interface Condition {
  actives?: string,
  inactives?: string,
  pendings?: string,
  publics?: string,
  my?: string,
  day?: string,
  week?: string,
  month?: string
};

export interface SetOptions<T extends object = AnyObject> {
  filter?: Filter<T>,
  userId?: string,
  groups?: string[]
}

export interface Set extends Condition, AndClause, OrClause {

}

export class SetFactory {

  constructor(private userId?: string, private groups?: string[]) {

  }

  produceWhereClauseFor(setName: string): Where<AnyObject> {

    if (setName == 'publics')
      return this.produceWhereClauseForPublics();

    if (setName == 'actives')
      return this.produceWhereClauseForActives();

    if (setName == 'inactives')
      return this.produceWhereClauseForInactives();

    if (setName == 'pendings')
      return this.produceWhereClauseForPendings();

    if (setName == 'my')
      return this.produceWhereClauseForMy(this.userId, this.groups);

    if (setName == 'day')
      return this.produceWhereClauseForDay();

    if (setName == 'week')
      return this.produceWhereClauseForWeek();

    if (setName == 'month')
      return this.produceWhereClauseForMonth();

    return {};
  }

  produceWhereClauseForActives(): Where<AnyObject> {
    return {
      and: [
        {
          or: [
            {
              validUntilDateTime: null
            },
            {
              validUntilDateTime: {
                gt: Date.now()
              }
            }
          ]
        },
        {
          validFromDateTime: {
            neq: null
          }
        },
        {
          validFromDateTime: {
            lt: Date.now()
          }
        }
      ]
    };
  }

  produceWhereClauseForInactives(): Where<AnyObject> {
    return {
      and: [
        {
          validUntilDateTime: {
            neq: null
          }
        },
        {
          validUntilDateTime: {
            lt: Date.now()
          }
        }
      ]
    };
  }

  produceWhereClauseForPendings(): Where<AnyObject> {
    return {
      validFromDateTime: null
    };
  }

  produceWhereClauseForPublics(): Where<AnyObject> {
    return {
      visibility: 'public'
    };
  }

  produceWhereClauseForMy(userId?: string, groups?: string[]): Where<AnyObject> {

    if (userId && groups)
      return {
        or: [
          {
            ownerUsers: userId
          },
          {
            ownerGroups: {
              inq: groups
            }
          }
        ]
      };

    if (userId)
      return {
        ownerUsers: userId
      }

    if (groups)
      return {
        ownerGroups: {
          inq: groups
        }
      }

    return {};
  }

  produceWhereClauseForDay(): Where<AnyObject> {
    return {
      creationDateTime: {
        between: [Date.now() - 1, Date.now()]
      }
    }
  }

  produceWhereClauseForWeek(): Where<AnyObject> {
    return {
      creationDateTime: {
        between: [Date.now() - 7, Date.now()]
      }
    }
  }

  produceWhereClauseForMonth(): Where<AnyObject> {
    return {
      creationDateTime: {
        between: [Date.now() - 30, Date.now()]
      }
    }
  }
}

export class SetFilterBuilder<T extends object = AnyObject> {

  private setFactory: SetFactory;

  constructor(private set: Set, private options?: SetOptions<T>) {
    this.setFactory = new SetFactory();
  }

  build(): Filter<AnyObject> {

    let setWhere: Where<AnyObject>[] | Where<AnyObject>;
    let whereBuilder: WhereBuilder<AnyObject>;

    let keys = _.keys(this.set);
    setWhere = this.buildWhereClauseForConditions(this.set, keys);

    if (this.options?.filter?.where) {
      whereBuilder = new WhereBuilder<AnyObject>(this.options?.filter?.where);
      whereBuilder.and(setWhere);
    }
    else
      whereBuilder = new WhereBuilder<AnyObject>(setWhere);

    let filterBuilder = new FilterBuilder<AnyObject>();
    return filterBuilder.where(whereBuilder.build())
      .build();
  }

  buildWhereClauseForSingleCondition(parentSet: Set, condition: string): Where<AnyObject>[] | Where<AnyObject> {

    if (condition != 'and' && condition != 'or')
      return this.setFactory.produceWhereClauseFor(condition);

    let subSetArr = parentSet[condition];

    let subClauses = _.map(subSetArr, (subSet) => {
      let subSetKeys = _.keys(subSet);
      return this.buildWhereClauseForConditions(subSet, subSetKeys);
    });

    let subWhereBuilder = new WhereBuilder<AnyObject>();

    if (condition == 'and')
      subWhereBuilder.and(subClauses);

    if (condition == 'or')
      subWhereBuilder.or(subClauses);

    return subWhereBuilder.build();
  };

  buildWhereClauseForConditions(parentSet: Set, conditions: string[]): Where<AnyObject>[] | Where<AnyObject> {

    if (conditions.length == 1)
      return this.buildWhereClauseForSingleCondition(parentSet, conditions[0]);

    return _.map(conditions, (condition) => {
      return this.buildWhereClauseForSingleCondition(parentSet, condition);
    });
  }
}
