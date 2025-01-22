import type { DataObject } from '@loopback/repository';
import { expect, sinon } from '@loopback/testlab';
import { setupApplication, teardownApplication } from './test-helper';
import type { EntityPersistenceApplication } from '../../..';
import { GenericListController } from '../../../controllers';
import type { Set } from '../../../extensions/utils/set';
import { GenericList } from '../../../models';
import { GenericListRepository } from '../../../repositories';

/**
 * Test suite for GenericListController
 * Tests all CRUD operations and their error cases.
 * Uses sinon stubs to isolate the controller from the repository layer.
 */
describe('GenericListController', () => {
  let app: EntityPersistenceApplication;
  let controller: GenericListController;
  let repository: sinon.SinonStubbedInstance<GenericListRepository>;

  before(async () => {
    ({ app } = await setupApplication());
  });

  after(async () => {
    await teardownApplication(app);
  });

  beforeEach(() => {
    // Create a fresh stub for each test to avoid interference
    repository = sinon.createStubInstance(GenericListRepository);
    controller = new GenericListController(repository);
  });

  /**
   * Tests for the create operation
   * Covers successful creation and various error cases:
   * - 409: Duplicate list name
   * - 422: Invalid/unmodifiable fields
   * - 429: List limit exceeded
   */
  describe('create()', () => {
    it('should successfully call GenericListRepository.create() with correct data', async () => {
      // Arrange
      const inputList: DataObject<GenericList> = {
        _name: 'testList',
        foo: 'bar',
      };

      const expectedList = new GenericList({
        _id: '123',
        _name: 'testList',
        foo: 'bar',
      });
      repository.create.resolves(expectedList);

      // Act
      const result = await controller.create(inputList);

      // Assert
      expect(result).to.eql(expectedList);
      sinon.assert.calledOnce(repository.create);
      sinon.assert.calledWithExactly(repository.create, inputList);
    });

    it('should throw 409 when list name already exists', async () => {
      // Arrange
      const inputList = {
        _name: 'existingName',
      };
      repository.create.rejects({ statusCode: 409 });

      // Act & Assert
      try {
        await controller.create(inputList);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 409);
      }
    });

    it('should throw 429 when list limit is exceeded', async () => {
      const inputList = {
        _name: 'newList',
      };
      repository.create.rejects({ statusCode: 429 });

      try {
        await controller.create(inputList);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 429);
      }
    });

    it('should throw 422 when trying to modify unmodifiable fields', async () => {
      const inputList = {
        _name: 'testList',
        _id: '123', // This should not be allowed
      };
      repository.create.rejects({ statusCode: 422 });

      try {
        await controller.create(inputList as DataObject<GenericList>);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 422);
      }
    });
  });

  describe('findById()', () => {
    it('should retrieve a list by id', async () => {
      const expectedList = new GenericList({
        _id: '123',
        _name: 'testList',
        foo: 'bar',
      });
      repository.findById.resolves(expectedList);

      const result = await controller.findById('123');
      expect(result).to.eql(expectedList);
      sinon.assert.calledOnce(repository.findById);
      sinon.assert.calledWith(repository.findById, '123');
    });

    it('should retrieve a list by id with filter', async () => {
      const expectedList = new GenericList({
        _id: '123',
        _name: 'testList',
        foo: 'bar',
      });
      const filter = { fields: ['_name'] };
      repository.findById.resolves(expectedList);

      const result = await controller.findById('123', filter);
      expect(result).to.eql(expectedList);
      sinon.assert.calledWith(repository.findById, '123', filter);
    });

    it('should throw 404 when list not found', async () => {
      repository.findById.rejects({ statusCode: 404 });

      try {
        await controller.findById('nonexistent');
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 404);
      }
    });
  });

  /**
   * Tests for the find operation
   * Verifies different combinations of filters and sets:
   * - Basic find without parameters
   * - Finding with filters
   * - Finding with sets
   * - Complex where conditions
   */
  describe('find()', () => {
    it('should retrieve lists with no filter or set', async () => {
      const expectedLists = [new GenericList({ _id: '123', _name: 'list1' })];
      repository.find.resolves(expectedLists);

      const result = await controller.find();
      expect(result).to.eql(expectedLists);
      sinon.assert.calledWith(repository.find, undefined);
    });

    it('should retrieve lists with only filter', async () => {
      const filter = { where: { _name: 'testList' } };
      const expectedLists = [
        new GenericList({ _id: '123', _name: 'testList' }),
      ];
      repository.find.resolves(expectedLists);

      const result = await controller.find(filter);
      expect(result).to.eql(expectedLists);
      sinon.assert.calledWith(repository.find, filter);
    });

    it('should retrieve lists with only set', async () => {
      const set: Set = { actives: 'true' };
      const expectedLists = [
        new GenericList({
          _id: '123',
          _validFromDateTime: new Date(Date.now() - 10000).toISOString(),
        }),
      ];
      repository.find.resolves(expectedLists);

      const result = await controller.find(undefined, set);
      expect(result).to.eql(expectedLists);
      sinon.assert.calledWithMatch(repository.find, sinon.match.has('where'));
    });

    it('should retrieve lists with both filter and set', async () => {
      // Arrange
      const set: Set = { actives: 'true' };
      const filter = { where: { _name: 'testList' }, limit: 10 };
      const expectedLists = [
        new GenericList({
          _id: '123',
          _name: 'testList',
          _validFromDateTime: new Date(Date.now() - 10000).toISOString(),
        }),
      ];
      repository.find.resolves(expectedLists);

      // Act
      const result = await controller.find(filter, set);

      // Assert
      expect(result).to.eql(expectedLists);
      // Verify that both set and filter conditions are included
      sinon.assert.calledWithMatch(
        repository.find,
        sinon.match.has('where').and(sinon.match.has('limit')),
      );
    });

    it('should handle complex where conditions', async () => {
      // Arrange
      const filter = {
        where: {
          and: [
            { _name: 'testList' },
            { or: [{ foo: 'value1' }, { foo: 'value2' }] },
          ],
        },
      };
      repository.find.resolves([]);

      // Act
      await controller.find(filter);

      // Assert
      sinon.assert.calledWithMatch(repository.find, filter);
    });
  });

  /**
   * Tests for update operations
   * Verifies both single-list and bulk updates
   * Includes validation of unmodifiable fields and list existence
   */
  describe('updateById()', () => {
    it('should update a list by id', async () => {
      // Arrange
      const id = '123';
      const updateData = {
        _name: 'updatedName',
        foo: 'baz',
      };
      repository.updateById.resolves();

      // Act
      await controller.updateById(id, updateData);

      // Assert
      sinon.assert.calledOnce(repository.updateById);
      sinon.assert.calledWithExactly(repository.updateById, id, updateData);
    });

    it('should throw 404 when list not found', async () => {
      const id = 'nonexistent';
      const updateData = { _name: 'updatedName' };
      repository.updateById.rejects({ statusCode: 404 });

      try {
        await controller.updateById(id, updateData);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 404);
      }
    });

    it('should throw 422 when trying to modify unmodifiable fields', async () => {
      const id = '123';
      const updateData = { _id: 'newId' } as DataObject<GenericList>;
      repository.updateById.rejects({ statusCode: 422 });

      try {
        await controller.updateById(id, updateData);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 422);
      }
    });
  });

  describe('deleteById()', () => {
    it('should delete a list by id', async () => {
      const id = '123';
      repository.deleteById.resolves();

      await controller.deleteById(id);
      sinon.assert.calledOnce(repository.deleteById);
      sinon.assert.calledWithExactly(repository.deleteById, id);
    });

    it('should throw 404 when list not found', async () => {
      const id = 'nonexistent';
      repository.deleteById.rejects({ statusCode: 404 });

      try {
        await controller.deleteById(id);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 404);
      }
    });
  });

  describe('count()', () => {
    it('should count lists with no set or where clause', async () => {
      const expectedCount = { count: 5 };
      repository.count.resolves(expectedCount);

      const result = await controller.count();
      expect(result).to.eql(expectedCount);
      sinon.assert.calledWith(repository.count, undefined);
    });

    it('should count lists with where clause', async () => {
      const where = { _name: 'testList' };
      const expectedCount = { count: 3 };
      repository.count.resolves(expectedCount);

      const result = await controller.count(undefined, where);
      expect(result).to.eql(expectedCount);
      sinon.assert.calledWith(repository.count, where);
    });

    it('should count lists with set', async () => {
      const set: Set = { actives: 'true' };
      const expectedCount = { count: 2 };
      repository.count.resolves(expectedCount);

      const result = await controller.count(set);
      expect(result).to.eql(expectedCount);
      sinon.assert.calledWithMatch(repository.count, sinon.match.object);
    });

    it('should handle empty set', async () => {
      const set: Set = {};
      const expectedCount = { count: 5 };
      repository.count.resolves(expectedCount);

      const result = await controller.count(set);
      expect(result).to.eql(expectedCount);
    });
  });

  describe('updateAll()', () => {
    it('should update all matching lists', async () => {
      const updateData = {
        _name: 'updatedName',
        foo: 'baz',
      };
      const where = { foo: 'bar' };
      const expectedCount = { count: 2 };
      repository.updateAll.resolves(expectedCount);

      const result = await controller.updateAll(updateData, undefined, where);
      expect(result).to.eql(expectedCount);
      sinon.assert.calledWith(repository.updateAll, updateData, where);
    });

    it('should update all matching lists with set', async () => {
      const updateData = { _name: 'updatedName' };
      const set: Set = { actives: 'true' };
      const expectedCount = { count: 1 };
      repository.updateAll.resolves(expectedCount);

      const result = await controller.updateAll(updateData, set);
      expect(result).to.eql(expectedCount);
      sinon.assert.calledWithMatch(
        repository.updateAll,
        updateData,
        sinon.match.object,
      );
    });

    it('should throw 422 when trying to modify unmodifiable fields', async () => {
      const updateData = { _id: 'newId' } as DataObject<GenericList>;
      repository.updateAll.rejects({ statusCode: 422 });

      try {
        await controller.updateAll(updateData);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 422);
      }
    });
  });

  describe('replaceById()', () => {
    it('should replace a list by id', async () => {
      const id = '123';
      const replaceData = {
        _name: 'replacedName',
        foo: 'baz',
      };
      repository.replaceById.resolves();

      await controller.replaceById(id, replaceData);
      sinon.assert.calledOnce(repository.replaceById);
      sinon.assert.calledWithExactly(repository.replaceById, id, replaceData);
    });

    it('should throw 404 when list to replace not found', async () => {
      const id = 'nonexistent';
      const replaceData = { _name: 'replacedName' };
      repository.replaceById.rejects({ statusCode: 404 });

      try {
        await controller.replaceById(id, replaceData);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 404);
      }
    });

    it('should throw 422 for invalid data', async () => {
      const id = '123';
      const invalidData = { _id: 'invalid' } as DataObject<GenericList>;
      repository.replaceById.rejects({ statusCode: 422 });

      try {
        await controller.replaceById(id, invalidData);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 422);
      }
    });

    it('should throw 422 when required fields are missing', async () => {
      const id = '123';
      const incompleteData = {} as DataObject<GenericList>;
      repository.replaceById.rejects({ statusCode: 422 });

      try {
        await controller.replaceById(id, incompleteData);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 422);
      }
    });
  });
});
