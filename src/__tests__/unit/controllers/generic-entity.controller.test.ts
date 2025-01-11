import type { DataObject } from '@loopback/repository';
import { expect, sinon } from '@loopback/testlab';
import { GenericEntityController } from '../../../controllers';
import type { Set } from '../../../extensions/set';
import { GenericEntity } from '../../../models';
import { GenericEntityRepository } from '../../../repositories';

describe('GenericEntityController', () => {
  let controller: GenericEntityController;
  let repository: sinon.SinonStubbedInstance<GenericEntityRepository>;
  let originalEntityKinds: string | undefined;

  beforeEach(() => {
    // Save original env value
    originalEntityKinds = process.env.entity_kinds;
    process.env.entity_kinds = 'book';

    repository = sinon.createStubInstance(GenericEntityRepository);
    controller = new GenericEntityController(repository);
  });

  afterEach(() => {
    // Restore original env value
    process.env.entity_kinds = originalEntityKinds;
  });

  describe('create()', () => {
    it('should successfully call GenericEntityRepository.create() with correct data', async () => {
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
  });

  describe('findById()', () => {
    it('should retrieve an entity by id', async () => {
      // Arrange
      const expectedEntity = new GenericEntity({
        _id: '123',
        _name: 'testEntity',
        _kind: 'book',
        foo: 'bar',
      });
      repository.findById.resolves(expectedEntity);

      // Act
      const result = await controller.findById('123');

      // Assert
      expect(result).to.eql(expectedEntity);
      sinon.assert.calledOnce(repository.findById);
      sinon.assert.calledWithExactly(repository.findById, '123');
    });
  });

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
      // Verify that SetFilterBuilder was used correctly
      sinon.assert.calledWithMatch(repository.find, sinon.match.has('where'));
    });

    it('should retrieve entities with both filter and set', async () => {
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

      const result = await controller.find(set, filter);

      expect(result).to.eql(expectedEntities);
      // Verify combined filter contains both set and filter conditions
      sinon.assert.calledWithMatch(
        repository.find,
        sinon.match.has('where').and(sinon.match.has('limit')),
      );
    });
  });

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
  });

  describe('deleteById()', () => {
    it('should delete an entity by id', async () => {
      // Arrange
      const id = '123';
      repository.deleteById.resolves();

      // Act
      await controller.deleteById(id);

      // Assert
      sinon.assert.calledOnce(repository.deleteById);
      sinon.assert.calledWithExactly(repository.deleteById, id);
    });
  });
});
