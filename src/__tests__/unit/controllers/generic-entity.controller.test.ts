import type { DataObject } from '@loopback/repository';
import { expect, sinon } from '@loopback/testlab';
import { setupApplication, teardownApplication } from './test-helper';
import type { EntityPersistenceApplication } from '../../..';
import { GenericEntityController } from '../../../controllers';
import type { Set } from '../../../extensions/utils/set-helper';
import { GenericEntity } from '../../../models';
import { EntityRepository } from '../../../repositories';

/**
 * Test suite for GenericEntityController
 * Tests all CRUD operations and their error cases.
 * Uses sinon stubs to isolate the controller from the repository layer.
 */
describe('EntityController', () => {
  let app: EntityPersistenceApplication;
  let controller: GenericEntityController;
  let repository: sinon.SinonStubbedInstance<EntityRepository>;
  let originalEntityKinds: string | undefined;

  before(async () => {
    ({ app } = await setupApplication());
  });

  after(async () => {
    await teardownApplication(app);
  });

  beforeEach(() => {
    // Save original env value to restore after each test
    originalEntityKinds = process.env.entity_kinds;
    process.env.entity_kinds = 'book';

    // Create a fresh stub for each test to avoid interference
    repository = sinon.createStubInstance(EntityRepository);
    controller = new GenericEntityController(repository);
  });

  afterEach(() => {
    // Restore original env value to maintain test isolation
    process.env.entity_kinds = originalEntityKinds;
  });

  /**
   * Tests for the create operation
   * Covers successful creation and various error cases:
   * - 409: Duplicate entity name
   * - 422: Invalid/unmodifiable fields
   * - 429: Entity limit exceeded
   */
  describe('create()', () => {
    it('should successfully call EntityRepository.create() with correct data', async () => {
      // Arrange
      const inputEntity: DataObject<GenericEntity> = {
        _name: 'testEntity',
        _kind: 'books',
        foo: 'bar',
      };

      const expectedEntity = new GenericEntity({
        _id: '123',
        _name: 'testEntity',
        _kind: 'book',
        foo: 'bar',
      });
      repository.create.resolves(expectedEntity);

      // Act
      const result = await controller.create(inputEntity);

      // Assert
      expect(result).to.eql(expectedEntity);
      sinon.assert.calledOnce(repository.create);
      sinon.assert.calledWithExactly(repository.create, inputEntity);
    });

    it('should throw 409 when entity name already exists', async () => {
      // Arrange
      const inputEntity = {
        _name: 'existingName',
        _kind: 'book',
      };
      repository.create.rejects({ statusCode: 409 });

      // Act & Assert
      try {
        await controller.create(inputEntity);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 409);
      }
    });

    it('should throw 429 when entity limit is exceeded', async () => {
      const inputEntity = {
        _name: 'newEntity',
        _kind: 'book',
      };
      repository.create.rejects({ statusCode: 429 });

      try {
        await controller.create(inputEntity);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 429);
      }
    });

    it('should throw 422 when trying to modify unmodifiable fields', async () => {
      const inputEntity = {
        _name: 'testEntity',
        _kind: 'book',
        _id: '123', // This should not be allowed
      };
      repository.create.rejects({ statusCode: 422 });

      try {
        await controller.create(inputEntity as DataObject<GenericEntity>);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.have.property('statusCode', 422);
      }
    });
  });

  describe('findById()', () => {
    it('should retrieve an entity by id', async () => {
      const expectedEntity = new GenericEntity({
        _id: '123',
        _name: 'testEntity',
        _kind: 'book',
        foo: 'bar',
      });
      repository.findById.resolves(expectedEntity);

      const result = await controller.findById('123');
      expect(result).to.eql(expectedEntity);
      sinon.assert.calledOnce(repository.findById);
      sinon.assert.calledWith(repository.findById, '123');
    });

    it('should retrieve an entity by id with filter', async () => {
      const expectedEntity = new GenericEntity({
        _id: '123',
        _name: 'testEntity',
        _kind: 'book',
        foo: 'bar',
      });
      const filter = { fields: ['_name', '_kind'] };
      repository.findById.resolves(expectedEntity);

      const result = await controller.findById('123', filter);
      expect(result).to.eql(expectedEntity);
      sinon.assert.calledWith(repository.findById, '123', filter);
    });

    it('should throw 404 when entity not found', async () => {
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
    it('should retrieve entities with no filter or set', async () => {
      const expectedEntities = [
        new GenericEntity({ _id: '123', _name: 'book1' }),
      ];
      repository.find.resolves(expectedEntities);

      const result = await controller.find();
      expect(result).to.eql(expectedEntities);
      sinon.assert.calledWith(repository.find, undefined);
    });

    it('should retrieve entities with only filter', async () => {
      const filter = { where: { _kind: 'book' } };
      const expectedEntities = [
        new GenericEntity({ _id: '123', _kind: 'book' }),
      ];
      repository.find.resolves(expectedEntities);

      const result = await controller.find(undefined, filter);
      expect(result).to.eql(expectedEntities);
      sinon.assert.calledWith(repository.find, filter);
    });

    it('should retrieve entities with only set', async () => {
      const set: Set = { actives: 'true' };
      const expectedEntities = [
        new GenericEntity({
          _id: '123',
          _validFromDateTime: new Date(Date.now() - 10000).toISOString(),
        }),
      ];
      repository.find.resolves(expectedEntities);

      const result = await controller.find(set);
      expect(result).to.eql(expectedEntities);
      sinon.assert.calledWithMatch(repository.find, sinon.match.has('where'));
    });

    it('should retrieve entities with both filter and set', async () => {
      // Arrange
      const set: Set = { actives: 'true' };
      const filter = { where: { _kind: 'book' }, limit: 10 };
      const expectedEntities = [
        new GenericEntity({
          _id: '123',
          _kind: 'book',
          _validFromDateTime: new Date(Date.now() - 10000).toISOString(),
        }),
      ];
      repository.find.resolves(expectedEntities);

      // Act
      const result = await controller.find(set, filter);

      // Assert
      expect(result).to.eql(expectedEntities);
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
            { _kind: 'book' },
            { or: [{ _name: 'test1' }, { _name: 'test2' }] },
          ],
        },
      };
      repository.find.resolves([]);

      // Act
      await controller.find(undefined, filter);

      // Assert
      sinon.assert.calledWithMatch(repository.find, filter);
    });
  });

  /**
   * Tests for update operations
   * Verifies both single-entity and bulk updates
   * Includes validation of unmodifiable fields and entity existence
   */
  describe('updateById()', () => {
    it('should update an entity by id', async () => {
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

    it('should throw 404 when entity not found', async () => {
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
      const updateData = { _id: 'newId' } as DataObject<GenericEntity>;
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
    it('should delete an entity by id', async () => {
      const id = '123';
      repository.deleteById.resolves();

      await controller.deleteById(id);
      sinon.assert.calledOnce(repository.deleteById);
      sinon.assert.calledWithExactly(repository.deleteById, id);
    });

    it('should throw 404 when entity not found', async () => {
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
    it('should count entities with no set or where clause', async () => {
      const expectedCount = { count: 5 };
      repository.count.resolves(expectedCount);

      const result = await controller.count();
      expect(result).to.eql(expectedCount);
      sinon.assert.calledWith(repository.count, undefined);
    });

    it('should count entities with where clause', async () => {
      const where = { _kind: 'book' };
      const expectedCount = { count: 3 };
      repository.count.resolves(expectedCount);

      const result = await controller.count(undefined, where);
      expect(result).to.eql(expectedCount);
      sinon.assert.calledWith(repository.count, where);
    });

    it('should count entities with set', async () => {
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
    it('should update all matching entities', async () => {
      const updateData = {
        _name: 'updatedName',
        foo: 'baz',
      };
      const where = { _kind: 'book' };
      const expectedCount = { count: 2 };
      repository.updateAll.resolves(expectedCount);

      const result = await controller.updateAll(updateData, undefined, where);
      expect(result).to.eql(expectedCount);
      sinon.assert.calledWith(repository.updateAll, updateData, where);
    });

    it('should update all matching entities with set', async () => {
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
      const updateData = { _id: 'newId' } as DataObject<GenericEntity>;
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
    it('should replace an entity by id', async () => {
      const id = '123';
      const replaceData = {
        _name: 'replacedName',
        _kind: 'book',
        foo: 'baz',
      };
      repository.replaceById.resolves();

      await controller.replaceById(id, replaceData);
      sinon.assert.calledOnce(repository.replaceById);
      sinon.assert.calledWithExactly(repository.replaceById, id, replaceData);
    });

    it('should throw 404 when entity to replace not found', async () => {
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
      const invalidData = { _id: 'invalid' } as DataObject<GenericEntity>;
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
      const incompleteData = {} as DataObject<GenericEntity>;
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
