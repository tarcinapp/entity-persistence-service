import type {
  Filter,
  OrClause as LbOrClause,
  Where,
} from '@loopback/repository';
import { FilterBuilder, WhereBuilder } from '@loopback/repository';
import type { AnyObject } from '@loopback/repository/dist/common-types';
import _ from 'lodash';

/**
 * Sets are a powerful feature for streamlining data filtering and selection.
 * They provide a convenient way to retrieve specific subsets of data based on
 * predefined conditions or custom logical combinations.
 *
 * Key Features:
 * 1. Sets - Filter the main records (lists/entities) using predefined conditions
 *    Example: ?set[actives] - Returns only active lists/entities
 *
 * 2. Combining Sets - Use logical operators (AND, OR) to combine multiple conditions
 *    Example: ?set[and][0][actives]&set[and][1][publics]
 *
 * 3. Sets with Filters - Combine sets with standard filters
 *    Example: ?set[actives]&filter[where][_kind]=config
 *
 * 4. SetThrough - Filter the relation records themselves (not the related entities/lists)
 *    Example: /lists/{listId}/entities?setThrough[actives]
 *    This filters the relation records between lists and entities
 *
 * 5. WhereThrough - Apply where conditions to filter relation records
 *    Example: /lists/{listId}/entities?whereThrough[foo]=bar
 *    This filters the relation records, not the entities or lists
 *
 * 6. Sets with Include - Apply sets/where conditions to included relations
 *    Example: ?filter[include][0][relation]=_entities
 *             &filter[include][0][setThrough][actives]
 *             &filter[include][0][whereThrough][foo]=bar
 *
 * Note: setThrough and whereThrough operate on the relation records themselves,
 * not on the related entities or lists. This is different from regular sets
 * which filter the main records.
 */

/**
 * Interface defining all available predefined set conditions.
 * Each condition represents a specific data subset based on predefined rules.
 */
export interface Condition {
  /** Selects all data where validFromDateTime is valid and not expired */
  actives?: string;
  /** Selects data where validUntilDateTime is in the past */
  expired?: string;
  /** Selects data where validFromDateTime is empty */
  pendings?: string;
  /** Selects all data with public visibility */
  publics?: string;
  /** Selects data owned by specific users/groups */
  owners?: UserAndGroupInfo;
  /** Selects data from the last 24 hours */
  day?: string;
  /** Selects data from the last 7 days */
  week?: string;
  /** Selects data from the last 30 days */
  month?: string;
  /** Combines active & public records with user's own active/pending records */
  audience?: UserAndGroupInfo;
  /** Selects data viewable by specific users/groups */
  viewers?: UserAndGroupInfo;
  /** Selects root-level records (records with no parents) */
  roots?: string;
  /** Selects records that expired within the last 30 days */
  expired30?: string;
}

/**
 * Interface for specifying user and group IDs in owner/viewer sets
 * Used in format: set[owners][userIds]=userId1,userId2&set[owners][groupIds]=groupId1,groupId2
 */
export interface UserAndGroupInfo {
  /** Comma-separated list of user IDs */
  userIds?: string;
  /** Comma-separated list of group IDs */
  groupIds?: string;
}

/**
 * Interface for combining multiple sets with AND operator
 * Example: ?set[and][0][actives]&set[and][1][publics]
 */
export interface AndClause {
  and?: Set[];
}

/**
 * Interface for combining multiple sets with OR operator
 * Example: ?set[or][0][actives]&set[or][1][publics]
 */
export interface OrClause {
  or?: Set[];
}

/**
 * Main Set interface that combines all possible set operations
 * Can be used for:
 * 1. Simple conditions: ?set[actives]
 * 2. Logical combinations: ?set[and][0][actives]&set[and][1][publics]
 * 3. Owner/viewer filters: ?set[owners][userIds]=user1,user2
 */
export interface Set extends Condition, AndClause, OrClause {}

/**
 * This interface is created to be used as a parameter of the constructor of the
 * SetFilterBuilder(this is the class controllers are interacting with).
 *
 * We are taking the existing filter as a property of this interface. We may
 * add other properties to configure the behavior of the SetFilterBuilder in the
 * future.
 */
export interface SetOptions<T extends object = AnyObject> {
  filter?: Filter<T>;
}

/**
 * Controllers are using this class to generate a single filter from given set
 * and from given filter.
 */
export class SetFilterBuilder<T extends object = AnyObject> {
  private setTransformer: SetToFilterTransformer;

  constructor(
    private set: Set,
    private options?: SetOptions<T>,
  ) {
    this.setTransformer = new SetToFilterTransformer();
  }

  build(): Filter<T> {
    const keys = _.keys(this.set);

    // generate the where clause from the set here
    const setWhere: Where<T>[] | Where<T> = this.buildWhereClauseForConditions(
      this.set,
      keys,
    );
    let whereBuilder: WhereBuilder<T>;

    /**
     * if a filter is given too, merge the where clause generated by the set
     * (above) with the given filter.
     *
     * if there is no filter given, only where clause is going to be the one
     * generated from the set.
     */
    if (this.options?.filter?.where) {
      whereBuilder = new WhereBuilder<T>();
      if (Array.isArray(setWhere)) {
        whereBuilder.and([this.options.filter.where, ...setWhere]);
      } else {
        whereBuilder.and([this.options.filter.where, setWhere]);
      }
    } else {
      if (Array.isArray(setWhere)) {
        whereBuilder = new WhereBuilder<T>();
        setWhere.forEach((where) => whereBuilder.and(where));
      } else {
        whereBuilder = new WhereBuilder<T>(setWhere);
      }
    }

    /**
     * Till this line, we have a 'where' clause.
     * We need to make it a 'filter' using the FilterBuilder.
     */
    let filterBuilder: FilterBuilder<T>;

    /**
     * If there is a filter given in the beginning, use this given filter to
     * instantiate the FilterBuilder. This is necessary because we need to keep
     * other properties of the filter (like skip, take, etc) in the new filter
     * too.
     *
     * Tested: As we already use the 'where' clause coming from the filter in our
     * whereBuilder, we may need to omit it while instantiating the
     * FilterBuilder. Test this.
     * Result: WhereBuilder above is already modifying the given filter too.
     * Using the filter here does not cause multiple nested queries. I decided
     * to keep it as it is.
     */
    if (this.options?.filter) {
      filterBuilder = new FilterBuilder<T>(this.options?.filter);
    } else {
      filterBuilder = new FilterBuilder<T>();
    }

    /**
     * Use the where clause we generated in the newly filter and return it.
     */
    return filterBuilder.where(whereBuilder.build()).build();
  }

  buildWhereClauseForSingleKeyOfSet(
    parentSet: Set,
    key: string,
  ): Where<AnyObject>[] | Where<AnyObject> {
    if (key !== 'and' && key !== 'or') {
      return this.setTransformer.produceWhereClauseFor(
        key,
        _.get(parentSet, key),
      );
    }

    /**
     * If we reach this line, key is either 'and' or 'or'
     */
    const subSetArr = parentSet[key];

    /**
     * traverse through items under the condition.
     */
    const subClauses = _.map(subSetArr, (subSet) => {
      const subSetKeys = _.keys(subSet);

      return this.buildWhereClauseForConditions(subSet, subSetKeys);
    });

    // this is to merge all sub-clauses to a 'where' clause.
    const subWhereBuilder = new WhereBuilder<AnyObject>();

    if (key === 'and') {
      subWhereBuilder.and(subClauses);
    }

    if (key === 'or') {
      subWhereBuilder.or(subClauses);
    }

    return subWhereBuilder.build();
  }

  buildWhereClauseForConditions(
    parentSet: Set,
    keys: string[],
  ): Where<AnyObject>[] | Where<AnyObject> {
    if (keys.length === 1) {
      return this.buildWhereClauseForSingleKeyOfSet(parentSet, keys[0]);
    }

    return _.map(keys, (condition) => {
      return this.buildWhereClauseForSingleKeyOfSet(parentSet, condition);
    });
  }
}

/**
 * SetToFilterTransformer is a private (non-exported) class that used by the
 * SetFilterBuilder to build filters from given 'filter' and 'set' objects.
 *
 * SetFilterBuilder is the one used by controllers.
 */
class SetToFilterTransformer {
  constructor(
    private _ownerUsers?: string[],
    private _ownerGroups?: string[],
  ) {}

  produceWhereClauseFor(
    setName: string,
    setValue?: string | UserAndGroupInfo,
  ): Where<AnyObject> {
    if (setName === 'publics') {
      return this.produceWhereClauseForPublics();
    }

    if (setName === 'actives') {
      return this.produceWhereClauseForActives();
    }

    if (setName === 'expired') {
      return this.produceWhereClauseForExpired();
    }

    if (setName === 'pendings') {
      return this.produceWhereClauseForPendings();
    }

    if (setName === 'owners' && _.isObject(setValue)) {
      return this.produceWhereClauseForOwners(setValue);
    }

    if (setName === 'viewers' && _.isObject(setValue)) {
      return this.produceWhereClauseForViewers(setValue);
    }

    if (setName === 'day') {
      return this.produceWhereClauseForDay();
    }

    if (setName === 'week') {
      return this.produceWhereClauseForWeek();
    }

    if (setName === 'month') {
      return this.produceWhereClauseForMonth();
    }

    if (setName === 'audience' && _.isObject(setValue)) {
      return this.produceWhereClauseForAudience(setValue);
    }

    if (setName === 'roots') {
      return this.produceWhereClauseForRoots();
    }

    if (setName === 'expired30') {
      return this.produceWhereClauseForExpired30();
    }

    return {};
  }

  produceWhereClauseForAudience(setValue: UserAndGroupInfo): Where<AnyObject> {
    const clause: Where<AnyObject> = {
      or: [
        {
          and: [
            this.produceWhereClauseForActives(),
            this.produceWhereClauseForPublics(),
          ],
        },
        {
          and: [
            this.produceWhereClauseForOwners(setValue),
            {
              or: [
                this.produceWhereClauseForActives(),
                this.produceWhereClauseForPendings(),
              ],
            },
          ],
        },
        {
          and: [
            this.produceWhereClauseForViewers(setValue),
            this.produceWhereClauseForActives(),
          ],
        },
      ],
    };

    return clause;
  }

  produceWhereClauseForActives(): Where<AnyObject> {
    const now = new Date();
    const nowISOString = now.toISOString();

    return {
      and: [
        {
          or: [
            {
              _validUntilDateTime: null,
            },
            {
              _validUntilDateTime: {
                gt: nowISOString,
              },
            },
          ],
        },
        {
          _validFromDateTime: {
            neq: null,
          },
        },
        {
          _validFromDateTime: {
            lt: nowISOString,
          },
        },
      ],
    };
  }

  produceWhereClauseForExpired(): Where<AnyObject> {
    const now = new Date();
    const nowISOString = now.toISOString();

    return {
      and: [
        {
          _validUntilDateTime: {
            neq: null,
          },
        },
        {
          _validUntilDateTime: {
            lt: nowISOString,
          },
        },
      ],
    };
  }

  produceWhereClauseForPendings(): Where<AnyObject> {
    const now = new Date();
    const nowISOString = now.toISOString();

    return {
      or: [
        {
          _validFromDateTime: null,
        },
        {
          _validFromDateTime: {
            gt: nowISOString,
          },
        },
      ],
    };
  }

  produceWhereClauseForPublics(): Where<AnyObject> {
    return {
      _visibility: 'public',
    };
  }

  produceWhereClauseForOwners(setValue?: UserAndGroupInfo): Where<AnyObject> {
    // if owners set query is used it must have a value, otherwise the filter should return emtpy
    // todo: maybe we'd like to throw exception here
    if (!setValue) {
      return { kind: false };
    }

    const filter: Where<AnyObject> = {};

    /**
     * If there is both user ids and group names provided
     * we returning all records matching either of them
     */
    const userIdsGiven = _.get(setValue, 'userIds.length');
    const groupIdsGiven = _.get(setValue, 'groupIds.length');

    if (userIdsGiven && groupIdsGiven) {
      const userIdsArr = setValue?.userIds!.split(',');
      const groupIdsArr = setValue?.groupIds!.split(',');

      return {
        or: [
          this.prepareOwnerUsersClause(userIdsArr),
          this.prepareOwnerGroupsClause(groupIdsArr),
        ],
      };
    }

    if (userIdsGiven) {
      const userIdsArr = setValue?.userIds!.split(',');

      return this.prepareOwnerUsersClause(userIdsArr);
    }

    if (groupIdsGiven) {
      const groupIdsArr = setValue?.groupIds!.split(',');

      return this.prepareOwnerGroupsClause(groupIdsArr);
    }

    /**
     * If there is no user id or group name provided, we return
     * records with zero user and zero groups
     */
    if (!userIdsGiven) {
      _.set(filter, '_ownerUsersCount', 0);
    }

    if (!groupIdsGiven) {
      _.set(filter, '_ownerGroupsCount', 0);
    }

    return filter;
  }

  produceWhereClauseForViewers(setValue?: UserAndGroupInfo): Where<AnyObject> {
    // if viewers set query is used it must have a value, otherwise the filter should return emtpy
    // todo: maybe we'd like to throw exception here
    if (!setValue) {
      return { kind: false };
    }

    const filter: Where<AnyObject> = {};

    /**
     * If there is both user ids and group names provided
     * we returning all records matching either of them
     */
    const userIdsGiven = _.get(setValue, 'userIds.length');
    const groupIdsGiven = _.get(setValue, 'groupIds.length');

    if (userIdsGiven && groupIdsGiven) {
      const userIdsArr = setValue?.userIds!.split(',');
      const groupIdsArr = setValue?.groupIds!.split(',');

      return {
        or: [
          this.prepareViewerUsersClause(userIdsArr),
          this.prepareViewerGroupsClause(groupIdsArr),
        ],
      };
    }

    if (userIdsGiven) {
      const userIdsArr = setValue?.userIds!.split(',');

      return this.prepareViewerUsersClause(userIdsArr);
    }

    if (groupIdsGiven) {
      const groupIdsArr = setValue?.groupIds!.split(',');

      return this.prepareViewerGroupsClause(groupIdsArr);
    }

    /**
     * If there is no user id or group name provided, we return
     * records with zero user and zero groups
     */
    if (!userIdsGiven) {
      _.set(filter, '_ownerUsersCount', 0);
    }

    if (!groupIdsGiven) {
      _.set(filter, '_ownerGroupsCount', 0);
    }

    return filter;
  }

  produceWhereClauseForDay(): Where<AnyObject> {
    const now = new Date();
    // Create start of day by using UTC methods to avoid timezone issues
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    return {
      _creationDateTime: {
        between: [startOfDay.toISOString(), now.toISOString()],
      },
    };
  }

  produceWhereClauseForWeek(): Where<AnyObject> {
    const now = new Date();
    // Create start of week using UTC methods
    const startOfWeek = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - now.getUTCDay(), // Subtract days to get to Sunday
      ),
    );

    return {
      _creationDateTime: {
        between: [startOfWeek.toISOString(), now.toISOString()],
      },
    };
  }

  produceWhereClauseForMonth(): Where<AnyObject> {
    const now = new Date();
    // Create start of month using UTC methods
    const startOfMonth = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        1, // First day of the month
      ),
    );

    return {
      _creationDateTime: {
        between: [startOfMonth.toISOString(), now.toISOString()],
      },
    };
  }

  private prepareOwnerUsersClause(users: string[]): Where<AnyObject> {
    const ownerUsersClause: LbOrClause<AnyObject> = {
      or: [],
    };

    ownerUsersClause.or = users.map((user) => {
      return {
        _ownerUsers: user,
      };
    });

    return ownerUsersClause;
  }

  private prepareOwnerGroupsClause(groups: string[]): Where<AnyObject> {
    const ownerGroupsClause: Where<AnyObject> = {};
    const groupNamesClause: LbOrClause<AnyObject> = {
      or: [],
    };

    groupNamesClause.or = groups.map((group) => {
      return {
        _ownerGroups: group,
      };
    });

    ownerGroupsClause.and = [
      groupNamesClause,
      {
        _visibility: {
          neq: 'private',
        },
      },
    ];

    return ownerGroupsClause;
  }

  private prepareViewerUsersClause(users: string[]): Where<AnyObject> {
    const viewerUsersClause: LbOrClause<AnyObject> = {
      or: [],
    };

    viewerUsersClause.or = users.map((user) => {
      return {
        _viewerUsers: user,
      };
    });

    return viewerUsersClause;
  }

  private prepareViewerGroupsClause(groups: string[]): Where<AnyObject> {
    const viewerGroupsClause: Where<AnyObject> = {};
    const groupNamesClause: LbOrClause<AnyObject> = {
      or: [],
    };

    groupNamesClause.or = groups.map((group) => {
      return {
        _viewerGroups: group,
      };
    });

    viewerGroupsClause.and = [
      groupNamesClause,
      {
        _visibility: {
          neq: 'private',
        },
      },
    ];

    return viewerGroupsClause;
  }

  produceWhereClauseForRoots(): Where<AnyObject> {
    return {
      _parentsCount: 0,
    };
  }

  produceWhereClauseForExpired30(): Where<AnyObject> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      and: [
        {
          _validUntilDateTime: {
            neq: null,
          },
        },
        {
          _validUntilDateTime: {
            lt: thirtyDaysAgo.toISOString(),
          },
        },
      ],
    };
  }
}
