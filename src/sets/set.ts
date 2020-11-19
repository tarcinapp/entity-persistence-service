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
  filter?: Filter<T>
}

export interface Set extends Condition, AndClause, OrClause {

}

export class SetFactory {

  constructor(private ownerUsers?: string[], private ownerGroups?: string[]) {
  }

  produceWhereClauseFor(setName: string, setValue?: string): Where<AnyObject> {

    if (setName == 'publics')
      return this.produceWhereClauseForPublics();

    if (setName == 'actives')
      return this.produceWhereClauseForActives();

    if (setName == 'inactives')
      return this.produceWhereClauseForInactives();

    if (setName == 'pendings')
      return this.produceWhereClauseForPendings();

    if (setName == 'my')
      return this.produceWhereClauseForMy(setValue);

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

  produceWhereClauseForMy(setValue?: string): Where<AnyObject> {

    if (!setValue) return {kind: false}; //impossible

    let parts = setValue.split(';');
    let users = parts[0] ? parts[0].split(',') : [];
    let groups = parts[1] ? parts[1].split(',') : [];

    if (users?.length && groups?.length)
      return {
        or: [
          {
            ownerUsers: {
              inq: users
            }
          },
          {
            and: [
              {
                ownerGroups: {
                  inq: groups
                }
              },
              {
                visibility: {
                  neq: 'private'
                }
              }
            ]
          }
        ]
      };

    if (users?.length)
      return {
        ownerUsers: {
          inq: users
        }
      }

    if (groups?.length)
      return {
        and: [
          {
            ownerGroups: {
              inq: groups
            }
          },
          {
            visibility: {
              neq: 'private'
            }
          }
        ]
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

    let filterBuilder: FilterBuilder;

    // add incoming filter to newly created filter
    if (this.options?.filter)
      filterBuilder = new FilterBuilder<AnyObject>(this.options?.filter);
    else
      filterBuilder = new FilterBuilder<AnyObject>();

    // override with the newly created where with the existing where
    return filterBuilder.where(whereBuilder.build())
      .build();
  }

  buildWhereClauseForSingleCondition(parentSet: Set, condition: string): Where<AnyObject>[] | Where<AnyObject> {

    if (condition != 'and' && condition != 'or')
      return this.setFactory.produceWhereClauseFor(condition, _.get(parentSet, condition));

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
