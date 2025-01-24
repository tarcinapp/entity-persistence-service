import type { Where } from '@loopback/repository';
import { expect } from '@loopback/testlab';
import { FilterMatcher } from '../../../../extensions/utils/filter-matcher';

describe('FilterMatcher', () => {
  describe('matches', () => {
    it('returns true when whereClause is undefined', () => {
      const record = { name: 'test' };
      expect(FilterMatcher.matches(record, undefined)).to.be.true();
    });

    describe('logical operators', () => {
      interface TestRecord {
        name: string;
        age: number;
        active?: boolean;
        role?: string;
      }

      it('handles AND conditions correctly', () => {
        const record: TestRecord = { name: 'test', age: 25, active: true };
        const filter: Where<TestRecord> = {
          and: [{ name: 'test' }, { age: { gt: 20 } }, { active: true }],
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<TestRecord> = {
          and: [{ name: 'test' }, { age: { gt: 30 } }, { active: true }],
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles OR conditions correctly', () => {
        const record: TestRecord = { name: 'test', age: 25 };
        const filter: Where<TestRecord> = {
          or: [{ name: 'wrong' }, { age: { gt: 20 } }],
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<TestRecord> = {
          or: [{ name: 'wrong' }, { age: { lt: 20 } }],
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles nested AND/OR conditions', () => {
        const record: TestRecord = { name: 'test', age: 25, role: 'admin' };
        const filter: Where<TestRecord> = {
          and: [
            {
              or: [{ name: 'test' }, { name: 'other' }],
            },
            {
              or: [{ age: { gt: 20 } }, { role: 'super-admin' }],
            },
          ],
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();
      });
    });

    describe('comparison operators', () => {
      interface NumberRecord {
        age: number;
        score: number;
      }

      const record: NumberRecord = { age: 25, score: 75.5 };

      it('handles eq operator', () => {
        const filter: Where<NumberRecord> = { age: { eq: 25 } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<NumberRecord> = { age: { eq: 26 } };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles neq operator', () => {
        const filter: Where<NumberRecord> = { age: { neq: 26 } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<NumberRecord> = { age: { neq: 25 } };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles gt operator', () => {
        const filter: Where<NumberRecord> = { age: { gt: 20 } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<NumberRecord> = { age: { gt: 25 } };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles gte operator', () => {
        const filter: Where<NumberRecord> = { age: { gte: 25 } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<NumberRecord> = { age: { gte: 26 } };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles lt operator', () => {
        const filter: Where<NumberRecord> = { age: { lt: 30 } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<NumberRecord> = { age: { lt: 25 } };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles lte operator', () => {
        const filter: Where<NumberRecord> = { age: { lte: 25 } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<NumberRecord> = { age: { lte: 24 } };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles between operator', () => {
        const filter: Where<NumberRecord> = { age: { between: [20, 30] } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<NumberRecord> = {
          age: { between: [26, 30] },
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });
    });

    describe('array operators', () => {
      interface ArrayRecord {
        tags: string[];
        numbers: number[];
      }

      const record: ArrayRecord = {
        tags: ['nodejs', 'typescript'],
        numbers: [1, 2, 3],
      };

      it('handles direct equality with arrays', () => {
        const filter: Where<ArrayRecord> = { tags: 'nodejs' as any };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<ArrayRecord> = { tags: 'java' as any };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles inq operator', () => {
        const filter: Where<ArrayRecord> = {
          tags: { inq: ['nodejs', 'java'] } as any,
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<ArrayRecord> = {
          tags: { inq: ['java', 'python'] } as any,
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles nin operator', () => {
        const filter: Where<ArrayRecord> = {
          tags: { nin: ['java', 'python'] } as any,
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<ArrayRecord> = {
          tags: { nin: ['nodejs', 'java'] } as any,
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles array equality with multiple values', () => {
        const filter: Where<ArrayRecord> = {
          tags: ['nodejs', 'typescript'] as any,
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const partialFilter: Where<ArrayRecord> = { tags: ['nodejs'] as any };
        expect(FilterMatcher.matches(record, partialFilter)).to.be.true();

        const failingFilter: Where<ArrayRecord> = {
          tags: ['nodejs', 'java'] as any,
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles inq operator with multiple values', () => {
        const filter: Where<ArrayRecord> = {
          tags: { inq: ['nodejs', 'typescript', 'java'] } as any,
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<ArrayRecord> = {
          tags: { inq: ['java', 'python', 'ruby'] } as any,
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles nin operator with multiple values', () => {
        const filter: Where<ArrayRecord> = {
          tags: { nin: ['java', 'python', 'ruby'] } as any,
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<ArrayRecord> = {
          tags: { nin: ['nodejs', 'java', 'python'] } as any,
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });
    });

    describe('string operators', () => {
      interface StringRecord {
        name: string;
        email: string;
      }

      const record: StringRecord = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      it('handles like operator', () => {
        const filter: Where<StringRecord> = { name: { like: 'John%' } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        expect(
          FilterMatcher.matches(record, { name: { like: '%Doe' } }),
        ).to.be.true();
        expect(
          FilterMatcher.matches(record, { name: { like: '%oh%' } }),
        ).to.be.true();
        expect(
          FilterMatcher.matches(record, { name: { like: 'Jane%' } }),
        ).to.be.false();
      });

      it('handles case-insensitive like operator', () => {
        const filter: Where<StringRecord> = {
          name: { like: 'john%', options: 'i' } as any,
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        expect(
          FilterMatcher.matches(record, {
            name: { like: '%doe', options: 'i' } as any,
          }),
        ).to.be.true();
        expect(
          FilterMatcher.matches(record, {
            name: { like: '%OH%', options: 'i' } as any,
          }),
        ).to.be.true();
        expect(
          FilterMatcher.matches(record, {
            name: { like: 'JANE%', options: 'i' } as any,
          }),
        ).to.be.false();
      });

      it('handles nlike operator', () => {
        const filter: Where<StringRecord> = { name: { nlike: 'Jane%' } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<StringRecord> = { name: { nlike: 'John%' } };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles case-insensitive nlike operator', () => {
        const filter: Where<StringRecord> = {
          name: { nlike: 'jane%', options: 'i' } as any,
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<StringRecord> = {
          name: { nlike: 'JOHN%', options: 'i' } as any,
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles ilike operator', () => {
        const filter: Where<StringRecord> = { name: { ilike: 'john%' } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        expect(
          FilterMatcher.matches(record, { name: { ilike: '%DOE' } }),
        ).to.be.true();
        expect(
          FilterMatcher.matches(record, { name: { ilike: '%Oh%' } }),
        ).to.be.true();
        expect(
          FilterMatcher.matches(record, { name: { ilike: 'JANE%' } }),
        ).to.be.false();
      });

      it('handles nilike operator', () => {
        const filter: Where<StringRecord> = { name: { nilike: 'jane%' } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<StringRecord> = {
          name: { nilike: 'JOHN%' },
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles regexp operator', () => {
        const filter: Where<StringRecord> = {
          email: { regexp: '^[^@]+@[^@]+\\.[^@]+$' },
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<StringRecord> = {
          email: { regexp: '^\\d+$' },
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles case-insensitive like operator with options', () => {
        const filter: Where<StringRecord> = {
          name: { like: 'john%', options: 'i' } as any,
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        expect(
          FilterMatcher.matches(record, {
            name: { like: '%DOE', options: 'i' } as any,
          }),
        ).to.be.true();
        expect(
          FilterMatcher.matches(record, {
            name: { like: '%OH%', options: 'i' } as any,
          }),
        ).to.be.true();
        expect(
          FilterMatcher.matches(record, {
            name: { like: 'JANE%', options: 'i' } as any,
          }),
        ).to.be.false();
      });

      it('handles case-insensitive nlike operator with options', () => {
        const filter: Where<StringRecord> = {
          name: { nlike: 'jane%', options: 'i' } as any,
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<StringRecord> = {
          name: { nlike: 'JOHN%', options: 'i' } as any,
        };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles like operator with special characters', () => {
        const specialRecord: StringRecord = {
          name: 'John.Doe',
          email: 'john@example.com',
        };

        const filter: Where<StringRecord> = {
          name: { like: 'John.%' },
        };
        expect(FilterMatcher.matches(specialRecord, filter)).to.be.true();

        expect(
          FilterMatcher.matches(specialRecord, {
            name: { like: '%.Doe' },
          }),
        ).to.be.true();
        expect(
          FilterMatcher.matches(specialRecord, {
            name: { like: '%\\.%' },
          }),
        ).to.be.true();
      });

      it('handles regexp operator with flags', () => {
        const filter: Where<StringRecord> = {
          name: { regexp: '/john/i' },
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        expect(
          FilterMatcher.matches(record, {
            name: { regexp: new RegExp('JOHN', 'i') },
          }),
        ).to.be.true();
        expect(
          FilterMatcher.matches(record, {
            name: { regexp: '/\\w+\\.\\w+/' },
          }),
        ).to.be.false();
      });
    });

    describe('null and undefined handling', () => {
      interface NullableRecord {
        name: string;
        nullField?: string;
        emptyField: string;
        optionalField?: string;
      }

      const record: NullableRecord = {
        name: 'test',
        nullField: undefined,
        emptyField: '',
      };

      it('handles null values correctly', () => {
        const filter: Where<NullableRecord> = { nullField: undefined };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        const failingFilter: Where<NullableRecord> = { name: undefined };
        expect(FilterMatcher.matches(record, failingFilter)).to.be.false();
      });

      it('handles exists operator', () => {
        const filter: Where<NullableRecord> = { name: { exists: true } };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        expect(
          FilterMatcher.matches(record, { optionalField: { exists: false } }),
        ).to.be.true();
        expect(
          FilterMatcher.matches(record, { name: { exists: false } }),
        ).to.be.false();
        expect(
          FilterMatcher.matches(record, { optionalField: { exists: true } }),
        ).to.be.false();
      });
    });

    describe('date handling', () => {
      interface DateRecord {
        date: string;
        dateObj: Date;
      }

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const record: DateRecord = {
        date: now.toISOString(),
        dateObj: now,
      };

      it('handles date string comparisons', () => {
        const filter: Where<DateRecord> = {
          date: { gt: yesterday.toISOString() },
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        expect(
          FilterMatcher.matches(record, {
            date: { lt: tomorrow.toISOString() },
          }),
        ).to.be.true();
      });

      it('handles Date object comparisons', () => {
        const filter: Where<DateRecord> = {
          dateObj: { gt: yesterday },
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        expect(
          FilterMatcher.matches(record, {
            dateObj: { lt: tomorrow },
          }),
        ).to.be.true();
      });

      it('handles between operator with dates', () => {
        const filter: Where<DateRecord> = {
          date: {
            between: [yesterday.toISOString(), tomorrow.toISOString()],
          },
        };
        expect(FilterMatcher.matches(record, filter)).to.be.true();

        expect(
          FilterMatcher.matches(record, {
            dateObj: { between: [yesterday, tomorrow] },
          }),
        ).to.be.true();
      });
    });
  });
});
