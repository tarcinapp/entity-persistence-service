import { Getter } from '@loopback/core';
import { expect, sinon } from '@loopback/testlab';
import {
  setupRepositoryTest,
  teardownRepositoryTest,
} from './test-helper.repository';
import type { EntityPersistenceApplication } from '../../..';
import { HttpErrorResponse } from '../../../models';
import {
  CustomEntityThroughListRepository,
  GenericEntityRepository,
  GenericListEntityRelationRepository,
  GenericListRepository,
  ListReactionsRepository,
  ListRelationRepository,
  TagListRelationRepository,
  TagRepository,
} from '../../../repositories';

describe('GenericListRepository', () => {
  let app: EntityPersistenceApplication;
  let repository: GenericListRepository;

  before(async () => {
    // Set up test environment
    const testSetup = await setupRepositoryTest();
    app = testSetup.app;

    // Create stubs for related repositories
    const listEntityRelationRepoStub = sinon.createStubInstance(
      GenericListEntityRelationRepository,
    );
    const genericEntityRepoStub = sinon.createStubInstance(
      GenericEntityRepository,
    );
    const listRelationRepoStub = sinon.createStubInstance(
      ListRelationRepository,
    );
    const listReactionsRepoStub = sinon.createStubInstance(
      ListReactionsRepository,
    );
    const tagListRelationRepoStub = sinon.createStubInstance(
      TagListRelationRepository,
    );
    const tagRepoStub = sinon.createStubInstance(TagRepository);
    const customListEntityRelRepoStub = sinon.createStubInstance(
      CustomEntityThroughListRepository,
    );

    // Create main repository instance with stubbed dependencies
    repository = new GenericListRepository(
      testSetup.dataSource,
      Getter.fromValue(listEntityRelationRepoStub),
      Getter.fromValue(genericEntityRepoStub),
      Getter.fromValue(listRelationRepoStub),
      Getter.fromValue(listReactionsRepoStub),
      Getter.fromValue(tagListRelationRepoStub),
      Getter.fromValue(tagRepoStub),
      Getter.fromValue(customListEntityRelRepoStub),
      testSetup.configReaders.uniquenessConfigReader,
      testSetup.configReaders.recordLimitConfigReader,
      testSetup.configReaders.kindLimitConfigReader,
      testSetup.configReaders.visibilityConfigReader,
      testSetup.configReaders.validfromConfigReader,
      testSetup.configReaders.idempotencyConfigReader,
      testSetup.configReaders.responseLimitConfigReader,
    );
  });

  after(async () => {
    await teardownRepositoryTest(app);
  });

  it('should be properly instantiated', () => {
    expect(repository).to.be.instanceOf(GenericListRepository);
  });

  it('should have all required relations configured', () => {
    expect(repository.children).to.not.be.undefined();
    expect(repository.reactions).to.not.be.undefined();
    expect(repository.tags).to.not.be.undefined();
    expect(repository.genericEntities).to.be.a.Function();
  });

  describe('find', () => {
    // TODO: Implement find tests
  });

  describe('create', () => {
    let superCreateStub: sinon.SinonStub;
    let superFindOneStub: sinon.SinonStub;
    const now = '2024-01-01T00:00:00.000Z';

    beforeEach(() => {
      // Stub Date.now
      sinon.useFakeTimers(new Date(now));

      // Stub super.create
      superCreateStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'create',
        )
        .callsFake(async (data) => data);

      // Stub super.findOne for idempotency checks
      superFindOneStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'findOne',
        )
        .resolves(null);
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('idempotency', () => {
      it('should return existing list when idempotent list exists', async () => {
        const existingList = { _id: '123', _name: 'test' };
        const idempotencyFields = ['_name'];

        // Setup stubs
        sinon
          .stub(repository['idempotencyConfigReader'], 'getIdempotencyForLists')
          .returns(idempotencyFields);
        superFindOneStub.resolves(existingList);

        const result = await repository.create({ _name: 'test' });

        expect(result).to.deepEqual(existingList);
        expect(superCreateStub.called).to.be.false();
      });

      it('should proceed with creation when no idempotent list exists', async () => {
        const idempotencyFields = ['_name'];
        const inputData = { _name: 'test', _kind: 'test-kind' };

        // Setup stubs
        sinon
          .stub(repository['idempotencyConfigReader'], 'getIdempotencyForLists')
          .returns(idempotencyFields);
        sinon
          .stub(repository['kindLimitConfigReader'], 'isKindAcceptableForList')
          .returns(true);
        sinon
          .stub(repository['visibilityConfigReader'], 'getVisibilityForLists')
          .returns('public');
        sinon
          .stub(repository['validfromConfigReader'], 'getValidFromForLists')
          .returns(true);

        await repository.create(inputData);

        expect(superCreateStub.calledOnce).to.be.true();
        const createdData = superCreateStub.firstCall.args[0];
        expect(typeof createdData._idempotencyKey).to.equal('string');
      });

      it('should skip idempotency check when not configured', async () => {
        const inputData = { _name: 'test', _kind: 'test-kind' };

        // Setup stubs
        sinon
          .stub(repository['idempotencyConfigReader'], 'getIdempotencyForLists')
          .returns([]);
        sinon
          .stub(repository['kindLimitConfigReader'], 'isKindAcceptableForList')
          .returns(true);
        sinon
          .stub(repository['visibilityConfigReader'], 'getVisibilityForLists')
          .returns('public');
        sinon
          .stub(repository['validfromConfigReader'], 'getValidFromForLists')
          .returns(true);

        await repository.create(inputData);

        expect(superFindOneStub.called).to.be.false();
        expect(superCreateStub.calledOnce).to.be.true();
      });
    });
  });

  describe('replaceById', () => {
    let superReplaceByIdStub: sinon.SinonStub;
    let superFindByIdStub: sinon.SinonStub;
    let kindLimitStub: sinon.SinonStub;
    let uniquenessStub: sinon.SinonStub;
    const now = '2024-01-01T00:00:00.000Z';
    const existingId = 'test-id';

    beforeEach(() => {
      // Stub Date.now
      sinon.useFakeTimers(new Date(now));

      // Stub super.replaceById
      superReplaceByIdStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'replaceById',
        )
        .callsFake(async (id, data) => data);

      // Stub super.findById for fetching existing list
      superFindByIdStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'findById',
        )
        .resolves({
          _id: existingId,
          _name: 'Original Name',
          _kind: 'test-kind',
          _version: 1,
        });

      // Common stubs for validation
      kindLimitStub = sinon
        .stub(repository['kindLimitConfigReader'], 'isKindAcceptableForList')
        .returns(true);
      uniquenessStub = sinon
        .stub(
          repository['uniquenessConfigReader'],
          'isUniquenessConfiguredForLists',
        )
        .returns(false);
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('validation and enrichment', () => {
      it('should throw error when list does not exist', async () => {
        superFindByIdStub.resolves(null);

        try {
          await repository.replaceById('non-existent-id', { _name: 'test' });
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /List with id 'non-existent-id' could not be found/,
          );
        }

        expect(superReplaceByIdStub.called).to.be.false();
      });

      it('should enrich list with managed fields', async () => {
        const inputData = {
          _name: 'Updated List',
          _kind: 'test-kind',
          _ownerUsers: ['user1'],
          _ownerGroups: ['group1', 'group2'],
          _viewerUsers: ['user2', 'user3'],
          _viewerGroups: ['group3'],
        };

        const result = await repository.replaceById(existingId, inputData);

        expect(result).to.containDeep({
          _name: 'Updated List',
          _kind: 'test-kind',
          _slug: 'updated-list',
          _version: 2,
          _ownerUsers: ['user1'],
          _ownerGroups: ['group1', 'group2'],
          _viewerUsers: ['user2', 'user3'],
          _viewerGroups: ['group3'],
          _ownerUsersCount: 1,
          _ownerGroupsCount: 2,
          _viewerUsersCount: 2,
          _viewerGroupsCount: 1,
          _lastUpdatedDateTime: now,
        });
      });

      it('should throw error for invalid kind format', async () => {
        const inputData = { _name: 'test', _kind: 'Test Kind!' };

        try {
          await repository.replaceById(existingId, inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /List kind cannot contain special or uppercase characters/,
          );
        }

        expect(superReplaceByIdStub.called).to.be.false();
      });

      it('should throw error when kind is not in allowed values', async () => {
        const inputData = { _name: 'test', _kind: 'invalid-kind' };

        kindLimitStub.returns(false);
        sinon
          .stub(repository['kindLimitConfigReader'], 'allowedKindsForLists')
          .get(() => ['allowed-kind']);

        try {
          await repository.replaceById(existingId, inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /List kind 'invalid-kind' is not valid/,
          );
        }

        expect(superReplaceByIdStub.called).to.be.false();
      });
    });
  });

  describe('updateById', () => {
    // TODO: Implement updateById tests
  });

  describe('updateAll', () => {
    // TODO: Implement updateAll tests
  });

  describe('deleteById', () => {
    // TODO: Implement deleteById tests
  });

  describe('deleteAll', () => {
    // TODO: Implement deleteAll tests
  });

  describe('createEntitiesInclusionResolver', () => {
    // TODO: Implement createEntitiesInclusionResolver tests
  });
});
