import { expect } from '@loopback/testlab';
import { sanitizeFilterFields } from '../../../../extensions/utils/filter-helper';

describe('Utilities: FilterHelper', () => {
  describe('sanitizeFilterFields', () => {
    it('should convert string boolean values to actual booleans in fields property', () => {
      const filter = {
        fields: {
          name: 'true',
          age: 'false',
          address: 'true',
          description: 'something',
        },
      };

      sanitizeFilterFields(filter);

      expect(filter.fields).to.deepEqual({
        name: true,
        age: false,
        address: true,
        description: 'something',
      });
    });

    it('should handle nested objects', () => {
      const filter = {
        fields: {
          name: 'true',
        },
        where: {
          nested: {
            fields: {
              active: 'true',
              deleted: 'false',
            },
          },
        },
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        fields: {
          name: true,
        },
        where: {
          nested: {
            fields: {
              active: true,
              deleted: false,
            },
          },
        },
      });
    });

    it('should handle arrays of objects', () => {
      const filter = {
        or: [
          {
            fields: {
              visible: 'true',
            },
          },
          {
            fields: {
              archived: 'false',
            },
          },
        ],
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        or: [
          {
            fields: {
              visible: true,
            },
          },
          {
            fields: {
              archived: false,
            },
          },
        ],
      });
    });

    it('should handle null and undefined inputs', () => {
      expect(() => sanitizeFilterFields(null)).to.not.throw();
      expect(() => sanitizeFilterFields(undefined)).to.not.throw();
    });

    it('should not modify non-boolean string values', () => {
      const filter = {
        fields: {
          status: 'active',
          isEnabled: 'true',
          count: '123',
        },
      };

      sanitizeFilterFields(filter);

      expect(filter.fields).to.deepEqual({
        status: 'active',
        isEnabled: true,
        count: '123',
      });
    });

    it('should handle empty objects', () => {
      const filter = {
        fields: {},
        where: {},
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        fields: {},
        where: {},
      });
    });

    it('should convert string null values to actual null in where clause', () => {
      const filter = {
        where: {
          status: 'null',
          nested: {
            field: 'null',
            deepNested: {
              value: 'null',
            },
          },
          array: ['null', { prop: 'null' }],
          notNull: 'active',
        },
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        where: {
          status: null,
          nested: {
            field: null,
            deepNested: {
              value: null,
            },
          },
          array: [null, { prop: null }],
          notNull: 'active',
        },
      });
    });

    it('should convert string null values in operator objects', () => {
      const filter = {
        where: {
          and: [
            {
              or: [
                {
                  _validUntilDateTime: {
                    eq: 'null',
                  },
                },
                {
                  _validUntilDateTime: {
                    gt: '2025-02-13T08:16:52.823Z',
                  },
                },
              ],
            },
            {
              _validFromDateTime: {
                neq: 'null',
              },
            },
            {
              _validFromDateTime: {
                lt: '2025-02-13T08:20:52.823Z',
              },
            },
          ],
        },
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        where: {
          and: [
            {
              or: [
                {
                  _validUntilDateTime: {
                    eq: null,
                  },
                },
                {
                  _validUntilDateTime: {
                    gt: '2025-02-13T08:16:52.823Z',
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
                lt: '2025-02-13T08:20:52.823Z',
              },
            },
          ],
        },
      });
    });
  });

  describe('type conversion in where clause', () => {
    it('should convert string values to numbers when type is number', () => {
      const filter = {
        where: {
          rating: {
            eq: '6',
            type: 'number',
          },
          score: {
            gt: '4.5',
            type: 'number',
          },
          points: {
            between: ['10', '20'],
            type: 'number',
          },
          values: {
            inq: ['1', '2', '3'],
            type: 'number',
          },
        },
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        where: {
          rating: {
            eq: 6,
          },
          score: {
            gt: 4.5,
          },
          points: {
            between: [10, 20],
          },
          values: {
            inq: [1, 2, 3],
          },
        },
      });
    });

    it('should handle mixed valid and invalid numbers in arrays', () => {
      const filter = {
        where: {
          points: {
            between: ['10', 'invalid', '20'],
            type: 'number',
          },
          values: {
            inq: ['1', 'NaN', '3', 'invalid'],
            type: 'number',
          },
        },
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        where: {
          points: {
            between: [10, 'invalid', 20],
          },
          values: {
            inq: [1, 'NaN', 3, 'invalid'],
          },
        },
      });
    });

    it('should handle invalid number conversions gracefully', () => {
      const filter = {
        where: {
          rating: {
            eq: 'invalid',
            type: 'number',
          },
          score: {
            gt: '4.5',
            type: 'number',
          },
        },
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        where: {
          rating: {
            eq: 'invalid', // Invalid number remains as string
          },
          score: {
            gt: 4.5,
          },
        },
      });
    });

    it('should handle nested operators with type conversion', () => {
      const filter = {
        where: {
          and: [
            {
              rating: {
                gt: '4',
                type: 'number',
              },
            },
            {
              score: {
                lt: '10',
                type: 'number',
              },
            },
          ],
        },
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        where: {
          and: [
            {
              rating: {
                gt: 4,
              },
            },
            {
              score: {
                lt: 10,
              },
            },
          ],
        },
      });
    });

    it('should handle multiple operators for the same field', () => {
      const filter = {
        where: {
          rating: {
            gt: '4',
            lt: '10',
            type: 'number',
          },
        },
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        where: {
          rating: {
            gt: 4,
            lt: 10,
          },
        },
      });
    });

    it('should not affect fields without type hint', () => {
      const filter = {
        where: {
          rating: {
            gt: '4',
          },
          score: {
            eq: '10',
            type: 'number',
          },
        },
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        where: {
          rating: {
            gt: '4', // Remains string without type hint
          },
          score: {
            eq: 10,
          },
        },
      });
    });

    it('should handle type conversion in nested lookup filters', () => {
      const filter = {
        lookup: [
          {
            prop: 'field',
            scope: {
              where: {
                bar: {
                  gt: '5',
                  type: 'number',
                },
                baz: {
                  between: ['10', '20'],
                  type: 'number',
                },
                nested: {
                  and: [
                    {
                      foo: {
                        inq: ['1', '2', '3'],
                        type: 'number',
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      };

      sanitizeFilterFields(filter);

      expect(filter).to.deepEqual({
        lookup: [
          {
            prop: 'field',
            scope: {
              where: {
                bar: {
                  gt: 5,
                },
                baz: {
                  between: [10, 20],
                },
                nested: {
                  and: [
                    {
                      foo: {
                        inq: [1, 2, 3],
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      });
    });
  });
});
