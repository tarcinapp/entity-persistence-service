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
  });
});
