import {AnyObject} from '@loopback/repository/dist/common-types';
import {Filter, FilterBuilder, OrClause as LbOrClause, Where, WhereBuilder} from '@loopback/repository/dist/query';
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
  owners?: string,
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

    if (setName == 'owners')
      return this.produceWhereClauseForOwners(setValue);

    if (setName == 'day')
      return this.produceWhereClauseForDay();

    if (setName == 'week')
      return this.produceWhereClauseForWeek();

    if (setName == 'month')
      return this.produceWhereClauseForMonth();

    if (setName == 'prod')
      return this.produceWhereClauseForProd(setValue);

    return {};
  }

  produceWhereClauseForProd(setValue: string | undefined): Where<AnyObject> {
    let clause: Where<AnyObject> = {
      or: [
        {
          and: [
            this.produceWhereClauseForActives(),
            this.produceWhereClauseForPublics()
          ]
        },
        {
          and: [
            this.produceWhereClauseForOwners(setValue),
            {
              or: [
                this.produceWhereClauseForActives(),
                this.produceWhereClauseForPendings()
              ]
            }
          ]
        }
      ]
    };

    return clause;
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

  produceWhereClauseForOwners(setValue?: string): Where<AnyObject> {

    // if owners set query is used it must have a value, otherwise the filter should return emtpy
    // todo: maybe we'd like to throw exception here
    if (!setValue) return {kind: false};

    // parse value to the groups [ownerUsers array][ownerGroups array]
    let matches = setValue.match(/\[([^\]]*)\](?:\[([^\]]*)\])?/);

    // if the value does not match the regex, filter should return emtpy
    // todo: maybe we'd like to throw exception here too
    if (matches == null) return {kind: false};

    // matching groups should have exactly three values, otherwise the filter should return emtpy
    // todo: throw exception here?
    if (matches.length != 3) return {kind: false};

    let users = matches[1] ? matches[1].split(',') : [];
    let groups = matches[2] ? matches[2].split(',') : [];

    let filter: Where<AnyObject> = {}

    /**
     * If there is both user ids and group names provided
     * we returning all records matching either of them
     */
    if (users?.length && groups?.length) {
      return {
        or: [
          this.prepareOwnerUsersClause(users),
          this.prepareOwnerGroupsClause(groups)
        ]
      };
    }

    if (users?.length) {
      return this.prepareOwnerUsersClause(users);
    }

    if (groups?.length) {
      return this.prepareOwnerGroupsClause(groups);
    }


    /**
     * If there is no user id or group name provided, we return
     * records with zero user and zero groups
     */
    if (users.length == 0)
      _.set(filter, 'ownerUsersCount', 0);

    if (groups.length == 0)
      _.set(filter, 'ownerGroupsCount', 0);

    return filter;
  }

  private prepareOwnerUsersClause(users: string[]): Where<AnyObject> {
    let ownerUsersClause: LbOrClause<AnyObject> = {
      or: []
    };

    ownerUsersClause.or = users.map(user => {

      return {
        ownerUsers: user
      }
    });

    return ownerUsersClause;
  }

  private prepareOwnerGroupsClause(groups: string[]): Where<AnyObject> {
    let ownerGroupsClause: Where<AnyObject> = {};
    let groupNamesClause: LbOrClause<AnyObject> = {
      or: []
    };

    groupNamesClause.or = groups.map(group => {

      return {
        ownerGroups: group
      }
    });

    ownerGroupsClause.and = [
      groupNamesClause,
      {
        visibility: {
          neq: 'private'
        }
      }
    ]

    return ownerGroupsClause;
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
