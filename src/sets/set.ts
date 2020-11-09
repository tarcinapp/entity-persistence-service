import {AnyObject} from '@loopback/repository/dist/common-types';
import {Where} from '@loopback/repository/dist/query';

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

export interface Set extends Condition, AndClause, OrClause {

}


export class SetFactory {

  produceWhereClauseFor(setName: string, userId?: string, groups?: string[]): Where<AnyObject> {

    if (setName == 'publics')
      return this.produceWhereClauseForPublics();

    if (setName == 'actives')
      return this.produceWhereClauseForActives();

    if (setName == 'inactives')
      return this.produceWhereClauseForInactives();

    if (setName == 'pendings')
      return this.produceWhereClauseForPendings();

    if (setName == 'my')
      return this.produceWhereClauseForMy(userId ?? '', groups ?? []);

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

  produceWhereClauseForMy(userId: string, groups: string[]): Where<AnyObject> {
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
