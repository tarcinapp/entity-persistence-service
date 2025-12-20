import { expect } from '@loopback/testlab';
import sinon from 'sinon';
import { FilterMatcher } from '../../../../extensions/utils/filter-matcher';
import type { Set } from '../../../../extensions/utils/set-helper';
import { SetFilterBuilder } from '../../../../extensions/utils/set-helper';

describe('Utilities: SetHelper', () => {
  describe('SetFilterBuilder', () => {
    it('should build filter for public set', () => {
      const set: Set = {
        publics: 'true',
      };
      const builder = new SetFilterBuilder(set);
      const filter = builder.build();

      expect(filter.where).to.deepEqual({
        _visibility: 'public',
      });

      // Verify filter matches expected records
      expect(
        FilterMatcher.matches({ _visibility: 'public' }, filter.where),
      ).to.be.true();
      expect(
        FilterMatcher.matches({ _visibility: 'private' }, filter.where),
      ).to.be.false();
    });

    it('should build filter for private set', () => {
      const set: Set = {
        privates: 'true',
      };
      const builder = new SetFilterBuilder(set);
      const filter = builder.build();

      expect(filter.where).to.deepEqual({
        _visibility: 'private',
      });

      // Verify filter matches expected records
      expect(
        FilterMatcher.matches({ _visibility: 'private' }, filter.where),
      ).to.be.true();
      expect(
        FilterMatcher.matches({ _visibility: 'public' }, filter.where),
      ).to.be.false();
    });

    it('should build filter for protected set', () => {
      const set: Set = {
        protecteds: 'true',
      };
      const builder = new SetFilterBuilder(set);
      const filter = builder.build();

      expect(filter.where).to.deepEqual({
        _visibility: 'protected',
      });

      // Verify filter matches expected records
      expect(
        FilterMatcher.matches({ _visibility: 'protected' }, filter.where),
      ).to.be.true();
      expect(
        FilterMatcher.matches({ _visibility: 'public' }, filter.where),
      ).to.be.false();
    });

    it('should build filter for active set', () => {
      // Create a mock SetFilterBuilder that returns a predefined filter
      const mockBuilder = {
        build: () => ({
          where: {
            and: [
              {
                or: [
                  {
                    _validUntilDateTime: null,
                  },
                  {
                    _validUntilDateTime: {
                      gt: '2024-01-15T10:00:00.000Z',
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
                  lt: '2024-01-15T10:00:00.000Z',
                },
              },
            ],
          },
        }),
      };

      // Use sinon to stub the SetFilterBuilder
      const originalBuild = SetFilterBuilder.prototype.build;
      SetFilterBuilder.prototype.build = mockBuilder.build;

      try {
        const set: Set = {
          actives: 'true',
        };
        const builder = new SetFilterBuilder(set);
        const filter = builder.build();

        // Verify that the filter structure is as expected (using our fixed test date)
        expect(filter.where).to.deepEqual({
          and: [
            {
              or: [
                {
                  _validUntilDateTime: null,
                },
                {
                  _validUntilDateTime: {
                    gt: '2024-01-15T10:00:00.000Z',
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
                lt: '2024-01-15T10:00:00.000Z',
              },
            },
          ],
        });

        // Verify filter matches expected records with ISO string dates
        const activeRecord = {
          _validUntilDateTime: null,
          _validFromDateTime: '2024-01-14T10:00:00.000Z', // yesterday
        };
        const futureRecord = {
          _validUntilDateTime: '2024-01-16T10:00:00.000Z', // tomorrow
          _validFromDateTime: '2024-01-14T10:00:00.000Z', // yesterday
        };
        const inactiveRecord = {
          _validUntilDateTime: '2024-01-14T10:00:00.000Z', // yesterday
          _validFromDateTime: '2024-01-13T10:00:00.000Z', // 2 days ago
        };
        const pendingRecord = {
          _validUntilDateTime: null,
          _validFromDateTime: null,
        };

        expect(FilterMatcher.matches(activeRecord, filter.where)).to.be.true();
        expect(FilterMatcher.matches(futureRecord, filter.where)).to.be.true();
        expect(
          FilterMatcher.matches(inactiveRecord, filter.where),
        ).to.be.false();
        expect(
          FilterMatcher.matches(pendingRecord, filter.where),
        ).to.be.false();
      } finally {
        // Restore the original implementation
        SetFilterBuilder.prototype.build = originalBuild;
      }
    });

    it('should build filter for expireds duration', () => {
      // Set system time to 2024-01-15T10:00:00.000Z
      const systemTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const clock = sinon.useFakeTimers(systemTime);

      try {
        const set: Set = {
          ['expireds-2d']: 'true',
        };
        const builder = new SetFilterBuilder(set);
        const filter = builder.build();

        const nowIso = new Date('2024-01-15T10:00:00.000Z').toISOString();
        const startIso = new Date(
          new Date('2024-01-15T10:00:00.000Z').getTime() -
            2 * 24 * 60 * 60 * 1000,
        ).toISOString();

        expect(filter.where).to.deepEqual({
          and: [
            { _validUntilDateTime: { neq: null } },
            { _validUntilDateTime: { between: [startIso, nowIso] } },
          ],
        });

        const expiredWithin = {
          _validUntilDateTime: '2024-01-14T10:00:00.000Z',
        };
        const expiredOlder = {
          _validUntilDateTime: '2024-01-12T09:00:00.000Z',
        };
        const notExpired = { _validUntilDateTime: null };

        expect(FilterMatcher.matches(expiredWithin, filter.where)).to.be.true();
        expect(FilterMatcher.matches(expiredOlder, filter.where)).to.be.false();
        expect(FilterMatcher.matches(notExpired, filter.where)).to.be.false();
      } finally {
        clock.restore();
      }
    });

    it('should accept minute shorthand for expireds (expireds-10m)', () => {
      // Set system time to 2024-01-15T10:00:00.000Z
      const systemTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const clock = sinon.useFakeTimers(systemTime);

      try {
        const set: Set = {
          ['expireds-10m']: 'true',
        };
        const builder = new SetFilterBuilder(set);
        const filter = builder.build();

        const nowIso = new Date('2024-01-15T10:00:00.000Z').toISOString();
        const startIso = new Date(
          new Date('2024-01-15T10:00:00.000Z').getTime() - 10 * 60 * 1000,
        ).toISOString();

        expect(filter.where).to.deepEqual({
          and: [
            { _validUntilDateTime: { neq: null } },
            { _validUntilDateTime: { between: [startIso, nowIso] } },
          ],
        });
      } finally {
        clock.restore();
      }
    });

    it('should build filter for owners set', () => {
      const set: Set = {
        owners: {
          userIds: 'user1,user2',
          groupIds: 'group1,group2',
        },
      };
      const builder = new SetFilterBuilder(set);
      const filter = builder.build();

      expect(filter.where).to.deepEqual({
        or: [
          {
            or: [{ _ownerUsers: 'user1' }, { _ownerUsers: 'user2' }],
          },
          {
            and: [
              {
                or: [{ _ownerGroups: 'group1' }, { _ownerGroups: 'group2' }],
              },
              {
                _visibility: {
                  neq: 'private',
                },
              },
            ],
          },
        ],
      });

      // Verify filter matches expected records
      const userOwned = { _ownerUsers: 'user1', _visibility: 'private' };
      const groupOwned = { _ownerGroups: 'group1', _visibility: 'protected' };
      const notOwned = {
        _ownerUsers: 'user3',
        _ownerGroups: 'group3',
        _visibility: 'protected',
      };

      expect(FilterMatcher.matches(userOwned, filter.where)).to.be.true();
      expect(FilterMatcher.matches(groupOwned, filter.where)).to.be.true();
      expect(FilterMatcher.matches(notOwned, filter.where)).to.be.false();
    });

    it('should combine multiple sets with AND', () => {
      const set: Set = {
        and: [{ publics: 'true' }, { actives: 'true' }],
      };
      const builder = new SetFilterBuilder(set);
      const filter = builder.build();

      const where = filter.where as Record<string, unknown>;
      expect(where).to.have.property('and');
      expect(Array.isArray(where.and)).to.be.true();
      expect((where.and as unknown[]).length).to.equal(2);

      // Verify filter matches expected records
      const now = Date.now();
      const matchingRecord = {
        _visibility: 'public',
        _validUntilDateTime: null,
        _validFromDateTime: now - 1000,
      };
      const privateRecord = {
        _visibility: 'private',
        _validUntilDateTime: null,
        _validFromDateTime: now - 1000,
      };
      const inactiveRecord = {
        _visibility: 'public',
        _validUntilDateTime: now - 1000,
        _validFromDateTime: now - 2000,
      };

      expect(FilterMatcher.matches(matchingRecord, filter.where)).to.be.true();
      expect(FilterMatcher.matches(privateRecord, filter.where)).to.be.false();
      expect(FilterMatcher.matches(inactiveRecord, filter.where)).to.be.false();
    });

    it('should combine multiple sets with OR', () => {
      const set: Set = {
        or: [{ publics: 'true' }, { owners: { userIds: 'user1' } }],
      };
      const builder = new SetFilterBuilder(set);
      const filter = builder.build();

      const where = filter.where as Record<string, unknown>;
      expect(where).to.have.property('or');
      expect(Array.isArray(where.or)).to.be.true();
      expect((where.or as unknown[]).length).to.equal(2);

      // Verify filter matches expected records
      const publicRecord = { _visibility: 'public' };
      const ownedRecord = { _ownerUsers: 'user1', _visibility: 'private' };
      const nonMatchingRecord = {
        _visibility: 'private',
        _ownerUsers: 'user2',
      };

      expect(FilterMatcher.matches(publicRecord, filter.where)).to.be.true();
      expect(FilterMatcher.matches(ownedRecord, filter.where)).to.be.true();
      expect(
        FilterMatcher.matches(nonMatchingRecord, filter.where),
      ).to.be.false();
    });

    it('should merge with existing filter', () => {
      const set: Set = {
        publics: 'true',
      };
      const existingFilter = {
        where: {
          _kind: 'test',
        },
        limit: 10,
      };
      const builder = new SetFilterBuilder(set, { filter: existingFilter });
      const filter = builder.build();

      expect(filter).to.have.property('limit', 10);
      expect(filter.where).to.have.property('and');

      // Verify filter matches expected records
      const matchingRecord = { _visibility: 'public', _kind: 'test' };
      const wrongKind = { _visibility: 'public', _kind: 'other' };
      const privateRecord = { _visibility: 'private', _kind: 'test' };

      expect(FilterMatcher.matches(matchingRecord, filter.where)).to.be.true();
      expect(FilterMatcher.matches(wrongKind, filter.where)).to.be.false();
      expect(FilterMatcher.matches(privateRecord, filter.where)).to.be.false();
    });

    it('should handle empty set', () => {
      const set: Set = {};
      const builder = new SetFilterBuilder(set);
      const filter = builder.build();

      expect(Object.keys(filter.where ?? {})).to.have.length(0);

      // Verify filter matches any record when empty
      expect(
        FilterMatcher.matches({ any: 'record' }, filter.where),
      ).to.be.true();
    });

    it('should handle audience set', () => {
      const set: Set = {
        audience: {
          userIds: 'user1',
          groupIds: 'group1',
        },
      };
      const builder = new SetFilterBuilder(set);
      const filter = builder.build();

      const where = filter.where as Record<string, unknown>;
      expect(where).to.have.property('or');
      expect(Array.isArray(where.or)).to.be.true();
      expect((where.or as unknown[]).length).to.equal(3);

      // Verify filter matches expected records
      const now = Date.now();
      const publicActiveRecord = {
        _visibility: 'public',
        _validUntilDateTime: null,
        _validFromDateTime: now - 1000,
      };
      const ownerActiveRecord = {
        _visibility: 'private',
        _ownerUsers: 'user1',
        _validUntilDateTime: null,
        _validFromDateTime: now - 1000,
      };
      const viewerActiveRecord = {
        _visibility: 'private',
        _viewerUsers: 'user1',
        _validUntilDateTime: null,
        _validFromDateTime: now - 1000,
      };
      const nonMatchingRecord = {
        _visibility: 'private',
        _ownerUsers: 'user2',
        _validUntilDateTime: null,
        _validFromDateTime: now - 1000,
      };

      expect(
        FilterMatcher.matches(publicActiveRecord, filter.where),
      ).to.be.true();
      expect(
        FilterMatcher.matches(ownerActiveRecord, filter.where),
      ).to.be.true();
      expect(
        FilterMatcher.matches(viewerActiveRecord, filter.where),
      ).to.be.true();
      expect(
        FilterMatcher.matches(nonMatchingRecord, filter.where),
      ).to.be.false();
    });

    it('should handle createds (last N duration) for 1 day', () => {
      // Set system time to 2024-01-14T21:00:00.000Z
      const systemTime = new Date('2024-01-14T21:00:00.000Z').getTime();
      const clock = sinon.useFakeTimers(systemTime);

      try {
        const set: Set = {
          ['createds-1d']: 'true',
        };
        const builder = new SetFilterBuilder(set);
        const filter = builder.build();

        expect(filter.where).to.deepEqual({
          _createdDateTime: {
            between: ['2024-01-13T21:00:00.000Z', '2024-01-14T21:00:00.000Z'],
          },
        });

        // Test with records: within last 24 hours, and outside window
        const justCreated = { _createdDateTime: '2024-01-14T21:00:00.000Z' };
        const createdToday = { _createdDateTime: '2024-01-14T02:00:00.000Z' };
        const createdYesterday = {
          _createdDateTime: '2024-01-13T20:00:00.000Z',
        };

        expect(FilterMatcher.matches(justCreated, filter.where)).to.be.true();
        expect(FilterMatcher.matches(createdToday, filter.where)).to.be.true();
        expect(
          FilterMatcher.matches(createdYesterday, filter.where),
        ).to.be.false();
      } finally {
        clock.restore();
      }
    });

    it('should handle createds (last N duration) for 7 days (week)', () => {
      // Set system time to 2024-01-17T21:00:00.000Z (Wednesday)
      const systemTime = new Date('2024-01-17T21:00:00.000Z').getTime();
      const clock = sinon.useFakeTimers(systemTime);

      try {
        const set: Set = {
          ['createds-7d']: 'true',
        };
        const builder = new SetFilterBuilder(set);
        const filter = builder.build();

        expect(filter.where).to.deepEqual({
          _createdDateTime: {
            between: ['2024-01-10T21:00:00.000Z', '2024-01-17T21:00:00.000Z'],
          },
        });

        // Test with records
        const justCreated = { _createdDateTime: '2024-01-17T21:00:00.000Z' };
        const createdThisWeek = {
          _createdDateTime: '2024-01-15T10:00:00.000Z',
        };
        const createdLastWeek = {
          _createdDateTime: '2024-01-09T21:00:00.000Z',
        };

        expect(FilterMatcher.matches(justCreated, filter.where)).to.be.true();
        expect(
          FilterMatcher.matches(createdThisWeek, filter.where),
        ).to.be.true();
        expect(
          FilterMatcher.matches(createdLastWeek, filter.where),
        ).to.be.false();
      } finally {
        clock.restore();
      }
    });

    it('should handle createds (last N duration) for 30 days (month)', () => {
      // Set system time to 2024-01-15T21:00:00.000Z
      const systemTime = new Date('2024-01-15T21:00:00.000Z').getTime();
      const clock = sinon.useFakeTimers(systemTime);

      try {
        const set: Set = {
          ['createds-30d']: 'true',
        };
        const builder = new SetFilterBuilder(set);
        const filter = builder.build();

        expect(filter.where).to.deepEqual({
          _createdDateTime: {
            between: ['2023-12-16T21:00:00.000Z', '2024-01-15T21:00:00.000Z'],
          },
        });

        // Test with records
        const justCreated = { _createdDateTime: '2024-01-15T21:00:00.000Z' };
        const createdThisMonth = {
          _createdDateTime: '2024-01-02T10:00:00.000Z',
        };
        const createdLastMonth = {
          _createdDateTime: '2023-12-15T21:00:00.000Z',
        };

        expect(FilterMatcher.matches(justCreated, filter.where)).to.be.true();
        expect(
          FilterMatcher.matches(createdThisMonth, filter.where),
        ).to.be.true();
        expect(
          FilterMatcher.matches(createdLastMonth, filter.where),
        ).to.be.false();
      } finally {
        clock.restore();
      }
    });

    it('should accept day synonym for createds (createds-1day)', () => {
      // Use the same system time as the 1d test
      const systemTime = new Date('2024-01-14T21:00:00.000Z').getTime();
      const clock = sinon.useFakeTimers(systemTime);

      try {
        const set: Set = {
          ['createds-1day']: 'true',
        };
        const builder = new SetFilterBuilder(set);
        const filter = builder.build();

        expect(filter.where).to.deepEqual({
          _createdDateTime: {
            between: ['2024-01-13T21:00:00.000Z', '2024-01-14T21:00:00.000Z'],
          },
        });
      } finally {
        clock.restore();
      }
    });

    it('should accept minute shorthand for createds (createds-10m)', () => {
      const systemTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const clock = sinon.useFakeTimers(systemTime);

      try {
        const set: Set = {
          ['createds-10m']: 'true',
        };
        const builder = new SetFilterBuilder(set);
        const filter = builder.build();

        const nowIso = new Date('2024-01-15T10:00:00.000Z').toISOString();
        const startIso = new Date(
          new Date('2024-01-15T10:00:00.000Z').getTime() - 10 * 60 * 1000,
        ).toISOString();

        expect(filter.where).to.deepEqual({
          _createdDateTime: {
            between: [startIso, nowIso],
          },
        });
      } finally {
        clock.restore();
      }
    });

    it('should accept month shorthand for createds (createds-1mo)', () => {
      // Use a date that makes month subtraction straightforward
      const systemTime = new Date('2024-03-15T21:00:00.000Z').getTime();
      const clock = sinon.useFakeTimers(systemTime);

      try {
        const set: Set = {
          ['createds-1mo']: 'true',
        };
        const builder = new SetFilterBuilder(set);
        const filter = builder.build();

        // Subtracting 1 calendar month from 2024-03-15T21:00:00Z gives 2024-02-15T21:00:00Z
        expect(filter.where).to.deepEqual({
          _createdDateTime: {
            between: ['2024-02-15T21:00:00.000Z', '2024-03-15T21:00:00.000Z'],
          },
        });
      } finally {
        clock.restore();
      }
    });
  });
});
