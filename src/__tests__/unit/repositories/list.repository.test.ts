import { Getter } from '@loopback/core';
import type { Filter } from '@loopback/repository';
import { expect, sinon } from '@loopback/testlab';
import {
  setupRepositoryTest,
  teardownRepositoryTest,
} from './test-helper.repository';
import type { EntityPersistenceApplication } from '../../..';
import { LookupHelper } from '../../../extensions/utils/lookup-helper';
import { HttpErrorResponse } from '../../../models';
import type {
  GenericEntity,
  GenericEntityRelations,
  List,
  ListRelations,
} from '../../../models';
import {
  CustomEntityThroughListRepository,
  EntityRepository,
  ListEntityRelationRepository,
  ListReactionsRepository,
} from '../../../repositories';
import { ListRepository } from '../../../repositories/list.repository';

describe('ListRepository', () => {
  let app: EntityPersistenceApplication;
  let repository: ListRepository;

  before(async () => {
    // Set up test environment
    const testSetup = await setupRepositoryTest();
    app = testSetup.app;

    // Create stubs for related repositories
    const listEntityRelationRepoStub = sinon.createStubInstance(
      ListEntityRelationRepository,
    );
    const entityRepoStub = sinon.createStubInstance(EntityRepository);
    const listReactionsRepoStub = sinon.createStubInstance(
      ListReactionsRepository,
    );
    const customListEntityRelRepoStub = sinon.createStubInstance(
      CustomEntityThroughListRepository,
    );

    // Create a mock lookup helper
    const mockLookupHelper = sinon.createStubInstance(LookupHelper);
    (mockLookupHelper.processLookupForArray as sinon.SinonStub).callsFake(
      async (
        items: ((GenericEntity | List) &
          (GenericEntityRelations | ListRelations))[],
        _filter?: Filter<GenericEntity | List>,
      ) => items,
    );
    (mockLookupHelper.processLookupForOne as sinon.SinonStub).callsFake(
      async (
        item: (GenericEntity | List) & (GenericEntityRelations | ListRelations),
        _filter?: Filter<GenericEntity | List>,
      ) => item,
    );

    // Create main repository instance with stubbed dependencies
    repository = new ListRepository(
      testSetup.dataSource,
      Getter.fromValue(listEntityRelationRepoStub),
      Getter.fromValue(entityRepoStub),
      Getter.fromValue(listReactionsRepoStub),
      Getter.fromValue(customListEntityRelRepoStub),
      testSetup.configReaders.uniquenessConfigReader,
      testSetup.configReaders.recordLimitConfigReader,
      testSetup.configReaders.kindConfigReader,
      testSetup.configReaders.visibilityConfigReader,
      testSetup.configReaders.validfromConfigReader,
      testSetup.configReaders.idempotencyConfigReader,
      testSetup.configReaders.responseLimitConfigReader,
      mockLookupHelper,
    );
  });

  after(async () => {
    await teardownRepositoryTest(app);
  });

  it('should be properly instantiated', () => {
    expect(repository).to.be.instanceOf(ListRepository);
  });

  it('should have all required relations configured', () => {
    expect(repository.reactions).to.not.be.undefined();
    expect(repository.entities).to.not.be.undefined();
  });

  describe('find', () => {
    let superFindStub: sinon.SinonStub;
    const configuredLimit = 50;

    beforeEach(() => {
      // Stub the parent class's find method
      superFindStub = sinon
        .stub(Object.getPrototypeOf(Object.getPrototypeOf(repository)), 'find')
        .callsFake(async (_filter, _options) => {
          return [];
        });

      // Stub the responseLimitConfigReader
      sinon
        .stub(repository['responseLimitConfigReader'], 'getListResponseLimit')
        .returns(configuredLimit);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should use configured response limit when no limit is provided in filter', async () => {
      await repository.find({});

      expect(superFindStub.calledOnce).to.be.true();
      const calledFilter = superFindStub.firstCall.args[0];
      expect(calledFilter.limit).to.equal(configuredLimit);
    });

    it('should use user provided limit when it is smaller than configured limit', async () => {
      const userLimit = 30;
      await repository.find({ limit: userLimit });

      expect(superFindStub.calledOnce).to.be.true();
      const calledFilter = superFindStub.firstCall.args[0];
      expect(calledFilter.limit).to.equal(userLimit);
    });

    it('should use configured limit when user provided limit is larger', async () => {
      const userLimit = 100;
      await repository.find({ limit: userLimit });

      expect(superFindStub.calledOnce).to.be.true();
      const calledFilter = superFindStub.firstCall.args[0];
      expect(calledFilter.limit).to.equal(configuredLimit);
    });

    it('should pass other filter properties and options to super.find', async () => {
      const filter = {
        where: { _kind: 'test' },
        order: ['_createdDateTime DESC'],
      };
      const options = { transaction: true };

      await repository.find(filter, options);

      expect(superFindStub.calledOnce).to.be.true();
      const [calledFilter, calledOptions] = superFindStub.firstCall.args;
      expect(calledFilter.where).to.deepEqual(filter.where);
      expect(calledFilter.order).to.deepEqual(filter.order);
      expect(calledOptions).to.deepEqual(options);
    });
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
          .stub(repository['kindConfigReader'], 'isKindAcceptableForList')
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
          .stub(repository['kindConfigReader'], 'isKindAcceptableForList')
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

    describe('validation and enrichment', () => {
      let kindStub: sinon.SinonStub;
      let uniquenessStub: sinon.SinonStub;
      let recordLimitStub: sinon.SinonStub;

      beforeEach(() => {
        // Common stubs for validation tests
        sinon
          .stub(repository['idempotencyConfigReader'], 'getIdempotencyForLists')
          .returns([]);
        kindStub = sinon
          .stub(repository['kindConfigReader'], 'isKindAcceptableForList')
          .returns(true);
        sinon
          .stub(repository['visibilityConfigReader'], 'getVisibilityForLists')
          .returns('public');
        sinon
          .stub(repository['validfromConfigReader'], 'getValidFromForLists')
          .returns(true);
        uniquenessStub = sinon
          .stub(
            repository['uniquenessConfigReader'],
            'isUniquenessConfiguredForLists',
          )
          .returns(false);
        recordLimitStub = sinon
          .stub(
            repository['recordLimitConfigReader'],
            'isRecordLimitsConfiguredForLists',
          )
          .returns(false);
      });

      it('should enrich list with managed fields', async () => {
        const inputData = {
          _name: 'Test List',
          _kind: 'test-kind',
          _ownerUsers: [],
          _ownerGroups: [],
          _viewerUsers: [],
          _viewerGroups: [],
        };

        const result = await repository.create(inputData);

        expect(result).to.containDeep({
          _name: 'Test List',
          _kind: 'test-kind',
          _slug: 'test-list',
          _version: 1,
          _visibility: 'public',
          _createdDateTime: now,
          _lastUpdatedDateTime: now,
          _validFromDateTime: now,
          _ownerUsers: [],
          _ownerGroups: [],
          _viewerUsers: [],
          _viewerGroups: [],
          _ownerUsersCount: 0,
          _ownerGroupsCount: 0,
          _viewerUsersCount: 0,
          _viewerGroupsCount: 0,
        });
      });

      it('should throw error for invalid kind format', async () => {
        const inputData = { _kind: 'Test Kind!', _name: 'test' };

        try {
          await repository.create(inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /List kind cannot contain special or uppercase characters/,
          );
        }

        expect(superCreateStub.called).to.be.false();
      });

      it('should throw error when kind is not in allowed values', async () => {
        const inputData = { _kind: 'invalid-kind', _name: 'test' };

        kindStub.returns(false);
        sinon
          .stub(repository['kindConfigReader'], 'allowedKindsForLists')
          .get(() => ['allowed-kind']);

        try {
          await repository.create(inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /List kind 'invalid-kind' is not valid/,
          );
        }

        expect(superCreateStub.called).to.be.false();
      });

      it('should throw error when uniqueness is violated', async () => {
        const inputData = { _kind: 'test-kind', _name: 'existing-name' };
        const existingList = { _id: 'existing-id', _name: 'existing-name' };

        uniquenessStub.returns(true);
        sinon
          .stub(repository['uniquenessConfigReader'], 'getFieldsForLists')
          .returns(['_name']);
        superFindOneStub.resolves(existingList);

        try {
          await repository.create(inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(/List already exists/);
        }

        expect(superCreateStub.called).to.be.false();
      });

      it('should throw error when record limit is exceeded', async () => {
        const inputData = { _kind: 'test-kind', _name: 'test' };
        const limit = 5;

        recordLimitStub.returns(true);
        sinon
          .stub(
            repository['recordLimitConfigReader'],
            'getRecordLimitsCountForLists',
          )
          .returns(limit);
        sinon
          .stub(
            Object.getPrototypeOf(Object.getPrototypeOf(repository)),
            'count',
          )
          .resolves({ count: limit });

        try {
          await repository.create(inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(/List limit is exceeded/);
          expect(error.details?.[0].info.limit).to.equal(limit);
        }

        expect(superCreateStub.called).to.be.false();
      });

      it('should generate slug from name if not provided', async () => {
        const inputData = {
          _name: 'Test List Name',
          _kind: 'test-kind',
        };

        const result = await repository.create(inputData);

        expect(result._slug).to.equal('test-list-name');
      });

      it('should use provided slug if available', async () => {
        const inputData = {
          _name: 'Test List Name',
          _kind: 'test-kind',
          _slug: 'custom-slug',
        };

        const result = await repository.create(inputData);

        expect(result._slug).to.equal('custom-slug');
      });

      it('should calculate owner and viewer counts', async () => {
        const inputData = {
          _name: 'Test List',
          _kind: 'test-kind',
          _ownerUsers: ['user1', 'user2'],
          _ownerGroups: ['group1'],
          _viewerUsers: ['user3', 'user4', 'user5'],
          _viewerGroups: ['group2', 'group3'],
        };

        const result = await repository.create(inputData);

        expect(result._ownerUsersCount).to.equal(2);
        expect(result._ownerGroupsCount).to.equal(1);
        expect(result._viewerUsersCount).to.equal(3);
        expect(result._viewerGroupsCount).to.equal(2);
      });
    });
  });

  describe('replaceById', () => {
    let superReplaceByIdStub: sinon.SinonStub;
    let superFindByIdStub: sinon.SinonStub;
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
        .resolves();

      // Stub super.findById for existing data lookup
      superFindByIdStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'findById',
        )
        .resolves({
          _id: existingId,
          _version: 1,
          _kind: 'test-kind',
          _name: 'Original Name',
          _createdDateTime: '2023-01-01T00:00:00.000Z',
          _lastUpdatedDateTime: '2023-01-01T00:00:00.000Z',
        });
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('validation and enrichment', () => {
      let uniquenessStub: sinon.SinonStub;

      beforeEach(() => {
        // Common stubs for validation tests
        uniquenessStub = sinon
          .stub(
            repository['uniquenessConfigReader'],
            'isUniquenessConfiguredForLists',
          )
          .returns(false);
        sinon
          .stub(repository['visibilityConfigReader'], 'getVisibilityForLists')
          .returns('public');
        sinon
          .stub(repository['validfromConfigReader'], 'getValidFromForLists')
          .returns(true);
      });

      it('should throw error when trying to change kind field', async () => {
        const updateData = { _kind: 'different-kind' };

        try {
          await repository.replaceById(existingId, updateData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /List kind cannot be changed after creation/,
          );
          expect(error.code).to.equal('IMMUTABLE-LIST-KIND');
        }

        expect(superReplaceByIdStub.called).to.be.false();
      });

      it('should throw error with consistent message when list does not exist', async () => {
        superFindByIdStub.resolves(null);

        try {
          await repository.replaceById(existingId, { _name: 'New Name' });
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /List with id 'test-id' could not be found/,
          );
        }

        expect(superReplaceByIdStub.called).to.be.false();
      });

      it('should throw error when uniqueness is violated', async () => {
        const updateData = { _name: 'existing-name', _kind: 'test-kind' };
        const existingList = { _id: 'another-id', _name: 'existing-name' };

        uniquenessStub.returns(true);
        sinon
          .stub(repository['uniquenessConfigReader'], 'getFieldsForLists')
          .returns(['_name']);
        sinon
          .stub(
            Object.getPrototypeOf(Object.getPrototypeOf(repository)),
            'findOne',
          )
          .resolves(existingList);

        try {
          await repository.replaceById(existingId, updateData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(/List already exists/);
        }

        expect(superReplaceByIdStub.called).to.be.false();
      });

      it('should update version and timestamps', async () => {
        const updateData = {
          _name: 'Updated Name',
          _kind: 'test-kind',
        };

        await repository.replaceById(existingId, updateData);

        expect(superReplaceByIdStub.calledOnce).to.be.true();
        const replacedData = superReplaceByIdStub.firstCall.args[1];
        expect(replacedData._version).to.equal(2);
        expect(replacedData._lastUpdatedDateTime).to.equal(now);
      });

      it('should generate new slug when name is updated', async () => {
        const updateData = {
          _name: 'Updated List Name',
          _kind: 'test-kind',
        };

        await repository.replaceById(existingId, updateData);

        expect(superReplaceByIdStub.calledOnce).to.be.true();
        const replacedData = superReplaceByIdStub.firstCall.args[1];
        expect(replacedData._slug).to.equal('updated-list-name');
      });

      it('should preserve existing slug when name is not updated', async () => {
        const existingData = {
          _id: existingId,
          _version: 1,
          _kind: 'test-kind',
          _name: 'Test Name',
          _slug: 'custom-slug',
          _createdDateTime: '2023-01-01T00:00:00.000Z',
          _lastUpdatedDateTime: '2023-01-01T00:00:00.000Z',
        };
        superFindByIdStub.resolves(existingData);

        const updateData = {
          _kind: 'test-kind',
          _name: 'Test Name',
        };

        await repository.replaceById(existingId, updateData);

        expect(superReplaceByIdStub.calledOnce).to.be.true();
        const replacedData = superReplaceByIdStub.firstCall.args[1];
        expect(replacedData._slug).to.equal('test-name');
      });

      it('should calculate owner and viewer counts', async () => {
        const updateData = {
          _name: 'Test List',
          _kind: 'test-kind',
          _ownerUsers: ['user1', 'user2'],
          _ownerGroups: ['group1'],
          _viewerUsers: ['user3', 'user4', 'user5'],
          _viewerGroups: ['group2', 'group3'],
        };

        await repository.replaceById(existingId, updateData);

        expect(superReplaceByIdStub.calledOnce).to.be.true();
        const replacedData = superReplaceByIdStub.firstCall.args[1];
        expect(replacedData._ownerUsersCount).to.equal(2);
        expect(replacedData._ownerGroupsCount).to.equal(1);
        expect(replacedData._viewerUsersCount).to.equal(3);
        expect(replacedData._viewerGroupsCount).to.equal(2);
      });

      it('should preserve existing fields not included in update', async () => {
        const existingData = {
          _id: existingId,
          _version: 1,
          _kind: 'test-kind',
          _name: 'Original Name',
          _slug: 'original-name',
          _createdDateTime: '2023-01-01T00:00:00.000Z',
          _lastUpdatedDateTime: '2023-01-01T00:00:00.000Z',
          _validFromDateTime: '2023-01-01T00:00:00.000Z',
          _validUntilDateTime: null,
          _visibility: 'public',
          _ownerUsers: ['user1'],
          _ownerGroups: ['group1'],
          _viewerUsers: ['user2'],
          _viewerGroups: ['group2'],
        };
        superFindByIdStub.resolves(existingData);

        const updateData = {
          _name: 'Updated Name',
          _kind: 'test-kind',
        };

        await repository.replaceById(existingId, updateData);

        expect(superReplaceByIdStub.calledOnce).to.be.true();
        const replacedData = superReplaceByIdStub.firstCall.args[1];
        expect(replacedData).to.containDeep({
          _name: 'Updated Name',
          _kind: 'test-kind',
          _slug: 'updated-name',
          _version: 2,
          _lastUpdatedDateTime: now,
        });
      });

      // New tests for idempotency handling
      it('should generate new idempotency key when idempotent fields are updated', async () => {
        const existingIdempotencyKey =
          '63ea389183badf7004ee26e06f5ecf13995d26b088d9fcb8a7fe17502eb218a4';
        const existingData = {
          _id: existingId,
          _name: 'Original Name',
          _kind: 'test-kind',
          _version: 1,
          _createdDateTime: '2023-01-01T00:00:00.000Z',
          _lastUpdatedDateTime: '2023-01-01T00:00:00.000Z',
          _idempotencyKey: existingIdempotencyKey,
        };
        superFindByIdStub.resolves(existingData);

        // Setup idempotency configuration
        sinon
          .stub(repository['idempotencyConfigReader'], 'getIdempotencyForLists')
          .returns(['_name']);

        const updateData = {
          _name: 'Updated Name',
          _kind: 'test-kind',
        };

        await repository.replaceById(existingId, updateData);

        expect(superReplaceByIdStub.calledOnce).to.be.true();
        const replacedData = superReplaceByIdStub.firstCall.args[1];
        expect(replacedData._idempotencyKey).to.not.equal(
          existingIdempotencyKey,
        );
        expect(typeof replacedData._idempotencyKey).to.equal('string');
      });
    });
  });

  describe('updateById', () => {
    let superUpdateByIdStub: sinon.SinonStub;
    let superFindByIdStub: sinon.SinonStub;
    const now = '2024-01-01T00:00:00.000Z';
    const existingId = 'test-id';
    const existingList = {
      _id: existingId,
      _name: 'Original Name',
      _kind: 'test-kind',
      _version: 1,
      _createdDateTime: '2023-01-01T00:00:00.000Z',
      _lastUpdatedDateTime: '2023-01-01T00:00:00.000Z',
      _ownerUsers: ['user1'],
      _ownerGroups: ['group1'],
      _viewerUsers: ['user2'],
      _viewerGroups: ['group2'],
    };

    beforeEach(() => {
      // Stub Date.now
      sinon.useFakeTimers(new Date(now));

      // Stub super.updateById to merge data with existing list
      superUpdateByIdStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'updateById',
        )
        .callsFake(async (...args) => {
          const data = args[1] as Record<string, unknown>;
          const merged = {
            ...existingList,
            ...data,
            _lastUpdatedDateTime: now,
            _version: (existingList._version ?? 1) + 1,
            _createdDateTime: existingList._createdDateTime,
          } as Record<string, unknown>;

          // Calculate counts
          if (Array.isArray(merged._ownerUsers)) {
            merged._ownerUsersCount = merged._ownerUsers.length;
          }

          if (Array.isArray(merged._ownerGroups)) {
            merged._ownerGroupsCount = merged._ownerGroups.length;
          }

          if (Array.isArray(merged._viewerUsers)) {
            merged._viewerUsersCount = merged._viewerUsers.length;
          }

          if (Array.isArray(merged._viewerGroups)) {
            merged._viewerGroupsCount = merged._viewerGroups.length;
          }

          return merged;
        });

      // Stub super.findById for fetching existing list
      superFindByIdStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'findById',
        )
        .resolves(existingList);
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('validation and enrichment', () => {
      let uniquenessStub: sinon.SinonStub;

      beforeEach(() => {
        // Common stubs for validation tests
        uniquenessStub = sinon
          .stub(
            repository['uniquenessConfigReader'],
            'isUniquenessConfiguredForLists',
          )
          .returns(false);
        sinon
          .stub(repository['visibilityConfigReader'], 'getVisibilityForLists')
          .returns('public');
        sinon
          .stub(repository['validfromConfigReader'], 'getValidFromForLists')
          .returns(true);
      });

      it('should merge update data with existing data', async () => {
        const updateData = {
          _name: 'Updated Name',
          _ownerUsers: ['user3'],
        };

        const result = await repository.updateById(existingId, updateData);

        expect(result).to.containDeep({
          _name: 'Updated Name',
          _kind: 'test-kind', // Preserved from existing
          _ownerUsers: ['user3'],
          _ownerGroups: ['group1'], // Preserved from existing
          _viewerUsers: ['user2'], // Preserved from existing
          _viewerGroups: ['group2'], // Preserved from existing
          _version: 2,
          _ownerUsersCount: 1,
        });
      });

      it('should enrich entity with managed fields', async () => {
        const updateData = {
          _name: 'Updated Entity',
          _ownerUsers: ['user1', 'user2'],
          _ownerGroups: ['group1', 'group2'],
          _viewerUsers: ['user3'],
          _viewerGroups: ['group3', 'group4'],
        };

        const result = await repository.updateById(existingId, updateData);

        expect(result).to.containDeep({
          _name: 'Updated Entity',
          _slug: 'updated-entity',
          _version: 2,
          _lastUpdatedDateTime: now,
          _ownerUsers: ['user1', 'user2'],
          _ownerGroups: ['group1', 'group2'],
          _viewerUsers: ['user3'],
          _viewerGroups: ['group3', 'group4'],
          _ownerUsersCount: 2,
          _ownerGroupsCount: 2,
          _viewerUsersCount: 1,
          _viewerGroupsCount: 2,
        });
      });

      it('should throw error when uniqueness is violated', async () => {
        const updateData = { _name: 'existing-name' };
        const conflictingList = { _id: 'another-id', _name: 'existing-name' };

        uniquenessStub.returns(true);
        sinon
          .stub(repository['uniquenessConfigReader'], 'getFieldsForLists')
          .returns(['_name']);
        sinon
          .stub(
            Object.getPrototypeOf(Object.getPrototypeOf(repository)),
            'findOne',
          )
          .resolves(conflictingList);

        try {
          await repository.updateById(existingId, updateData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(/List already exists/);
        }

        expect(superUpdateByIdStub.called).to.be.false();
      });

      it('should calculate idempotency key based on merged data', async () => {
        const updateData = { _name: 'test', _kind: 'test-kind' };
        const idempotencyFields = ['_name', '_kind']; // Both fields for idempotency

        sinon
          .stub(repository['idempotencyConfigReader'], 'getIdempotencyForLists')
          .returns(idempotencyFields);

        const result = (await repository.updateById(
          existingId,
          updateData,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        )) as any;

        expect(typeof result._idempotencyKey).to.equal('string');
      });

      it('should skip idempotency key calculation when not configured', async () => {
        const updateData = { _name: 'test' };

        sinon
          .stub(repository['idempotencyConfigReader'], 'getIdempotencyForLists')
          .returns([]);

        const result = (await repository.updateById(
          existingId,
          updateData,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        )) as any;

        expect(result._idempotencyKey).to.equal(undefined);
      });

      it('should preserve existing fields when doing partial update', async () => {
        const existingData = {
          _id: existingId,
          _name: 'Original Name',
          _kind: 'test-kind',
          _version: 1,
          _createdDateTime: '2023-01-01T00:00:00.000Z',
          _lastUpdatedDateTime: '2023-01-01T00:00:00.000Z',
          _validFromDateTime: null,
          _validUntilDateTime: null,
          _ownerUsers: ['user1'],
          _ownerGroups: ['group1'],
          _viewerUsers: ['user2'],
          _viewerGroups: ['group2'],
          _idempotencyKey: 'test-idempotency-key',
        };
        superFindByIdStub.resolves(existingData);

        const updateData = {
          _name: 'Updated Name',
        };

        await repository.updateById(existingId, updateData);

        expect(superUpdateByIdStub.calledOnce).to.be.true();
        const [calledId, calledData] = superUpdateByIdStub.firstCall.args;
        expect(calledId).to.equal(existingId);

        // version, lastUpdatedDateTime, slug and name must be updated
        expect(calledData._name).to.equal('Updated Name');
        expect(calledData._slug).to.equal('updated-name');
        expect(calledData._version).to.equal(2);
        expect(calledData._lastUpdatedDateTime).to.equal(now);
      });

      it('should preserve existing idempotency key when updating with same values', async () => {
        const existingIdempotencyKey =
          'af22eeac96b104f4cb95921a35bed984c7903b57378a771520aa85c4d3baf408';
        const existingData = {
          _id: existingId,
          _name: 'Test List',
          _kind: 'test-kind',
          _version: 1,
          _createdDateTime: '2023-01-01T00:00:00.000Z',
          _lastUpdatedDateTime: '2023-01-01T00:00:00.000Z',
          _validFromDateTime: null,
          _validUntilDateTime: null,
          _ownerUsers: ['user1'],
          _ownerGroups: ['group1'],
          _viewerUsers: ['user2'],
          _viewerGroups: ['group2'],
          _idempotencyKey: existingIdempotencyKey,
          foo: null,
          bar: undefined,
        };
        superFindByIdStub.resolves(existingData);

        // Setup idempotency configuration
        sinon
          .stub(repository['idempotencyConfigReader'], 'getIdempotencyForLists')
          .returns(['_name', '_kind', 'foo', 'bar']);

        // Update with same values
        const updateData = {
          _name: 'Test List',
          _kind: 'test-kind',
        };

        await repository.updateById(existingId, updateData);

        expect(superUpdateByIdStub.calledOnce).to.be.true();
        const [calledId, calledData] = superUpdateByIdStub.firstCall.args;
        expect(calledId).to.equal(existingId);
        expect(calledData._idempotencyKey).to.equal(existingIdempotencyKey);
      });
    });
  });

  describe('deleteById', () => {
    let superDeleteByIdStub: sinon.SinonStub;
    let listEntityRelationRepoStub: sinon.SinonStubbedInstance<ListEntityRelationRepository>;
    let listReactionsRepoStub: sinon.SinonStubbedInstance<ListReactionsRepository>;
    let customListEntityRelRepoStub: sinon.SinonStubbedInstance<CustomEntityThroughListRepository>;

    beforeEach(() => {
      // Create stubs for all related repositories
      listEntityRelationRepoStub = sinon.createStubInstance(
        ListEntityRelationRepository,
      );
      listReactionsRepoStub = sinon.createStubInstance(ListReactionsRepository);
      customListEntityRelRepoStub = sinon.createStubInstance(
        CustomEntityThroughListRepository,
      );

      // Stub the repository getters
      (repository as any).listEntityRelationRepositoryGetter = () =>
        Promise.resolve(listEntityRelationRepoStub);
      (repository as any).listReactionsRepositoryGetter = () =>
        Promise.resolve(listReactionsRepoStub);
      (repository as any).customEntityThroughListRepositoryGetter = () =>
        Promise.resolve(customListEntityRelRepoStub);

      // Stub super.deleteById
      superDeleteByIdStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'deleteById',
        )
        .resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should delete list and its relations', async () => {
      const listId = 'test-id';

      await repository.deleteById(listId);

      // Verify relations are deleted
      expect(listEntityRelationRepoStub.deleteAll.calledOnce).to.be.true();

      // Verify list is deleted
      expect(superDeleteByIdStub.calledOnce).to.be.true();
      expect(superDeleteByIdStub.firstCall.args[0]).to.equal(listId);
    });

    it('should pass options to super.deleteById', async () => {
      const listId = 'test-id';
      const options = { transaction: true };

      await repository.deleteById(listId, options);

      expect(superDeleteByIdStub.calledOnce).to.be.true();
      expect(superDeleteByIdStub.firstCall.args[1]).to.deepEqual(options);
    });

    it('should handle errors from list deletion', async () => {
      const listId = 'test-id';
      const error = new Error('Failed to delete list');
      superDeleteByIdStub.rejects(error);

      try {
        await repository.deleteById(listId);
        throw new Error('Expected error was not thrown');
      } catch (e) {
        expect(e).to.equal(error);
      }

      // Verify relations were still deleted
      expect(listEntityRelationRepoStub.deleteAll.calledOnce).to.be.true();
    });
  });

  describe('updateAll', () => {
    let superUpdateAllStub: sinon.SinonStub;
    const now = '2024-01-01T00:00:00.000Z';

    beforeEach(() => {
      // Stub Date.now
      sinon.useFakeTimers(new Date(now));

      // Stub super.updateAll
      superUpdateAllStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'updateAll',
        )
        .resolves({ count: 2 });
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should update matching lists with provided data', async () => {
      const where = { _kind: 'test-kind' };
      const updateData = { _name: 'Updated Name' };

      const result = await repository.updateAll(updateData, where);

      expect(superUpdateAllStub.calledOnce).to.be.true();
      const [calledData, calledWhere] = superUpdateAllStub.firstCall.args;
      expect(calledData).to.containDeep({
        _name: 'Updated Name',
        _lastUpdatedDateTime: now,
      });
      expect(calledWhere).to.deepEqual(where);
      expect(result.count).to.equal(2);
    });

    it('should throw error when trying to change kind field', async () => {
      const where = { _kind: 'test-kind' };
      const updateData = { _kind: 'different-kind' };

      try {
        await repository.updateAll(updateData, where);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HttpErrorResponse);
        expect(error.message).to.match(
          /List kind cannot be changed after creation/,
        );
        expect(error.code).to.equal('IMMUTABLE-LIST-KIND');
      }

      expect(superUpdateAllStub.called).to.be.false();
    });

    it('should pass options to super.updateAll', async () => {
      const where = { _kind: 'test-kind' };
      const updateData = { _name: 'Updated Name' };
      const options = { transaction: true };

      await repository.updateAll(updateData, where, options);

      expect(superUpdateAllStub.calledOnce).to.be.true();
      const [, , calledOptions] = superUpdateAllStub.firstCall.args;
      expect(calledOptions).to.deepEqual(options);
    });
  });

  describe('deleteAll', () => {
    let superDeleteAllStub: sinon.SinonStub;
    let listEntityRelationRepoStub: sinon.SinonStubbedInstance<ListEntityRelationRepository>;
    let listReactionsRepoStub: sinon.SinonStubbedInstance<ListReactionsRepository>;
    let customListEntityRelRepoStub: sinon.SinonStubbedInstance<CustomEntityThroughListRepository>;

    beforeEach(() => {
      // Create stubs for all related repositories
      listEntityRelationRepoStub = sinon.createStubInstance(
        ListEntityRelationRepository,
      );
      listReactionsRepoStub = sinon.createStubInstance(ListReactionsRepository);
      customListEntityRelRepoStub = sinon.createStubInstance(
        CustomEntityThroughListRepository,
      );

      // Stub the repository getters
      (repository as any).listEntityRelationRepositoryGetter = () =>
        Promise.resolve(listEntityRelationRepoStub);
      (repository as any).listReactionsRepositoryGetter = () =>
        Promise.resolve(listReactionsRepoStub);
      (repository as any).customEntityThroughListRepositoryGetter = () =>
        Promise.resolve(customListEntityRelRepoStub);

      // Stub super.deleteAll
      superDeleteAllStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'deleteAll',
        )
        .resolves({ count: 2 });
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should delete matching lists and their relations', async () => {
      const where = { _kind: 'test-kind' };

      const result = await repository.deleteAll(where);

      // Verify relations are deleted
      expect(listEntityRelationRepoStub.deleteAll.calledOnce).to.be.true();

      // Verify lists are deleted
      expect(superDeleteAllStub.calledOnce).to.be.true();
      expect(superDeleteAllStub.firstCall.args[0]).to.deepEqual(where);
      expect(result.count).to.equal(2);
    });

    it('should pass options to super.deleteAll', async () => {
      const where = { _kind: 'test-kind' };
      const options = { transaction: true };

      await repository.deleteAll(where, options);

      expect(superDeleteAllStub.calledOnce).to.be.true();
      expect(superDeleteAllStub.firstCall.args[1]).to.deepEqual(options);
    });

    it('should handle errors from list deletion', async () => {
      const where = { _kind: 'test-kind' };
      const error = new Error('Failed to delete lists');
      superDeleteAllStub.rejects(error);

      try {
        await repository.deleteAll(where);
        throw new Error('Expected error was not thrown');
      } catch (e) {
        expect(e).to.equal(error);
      }

      // Verify relations were still deleted
      expect(listEntityRelationRepoStub.deleteAll.calledOnce).to.be.true();
    });

    it('should delete all lists when no where condition is provided', async () => {
      const result = await repository.deleteAll();

      // Verify relations are deleted
      expect(listEntityRelationRepoStub.deleteAll.calledOnce).to.be.true();

      // Verify all lists are deleted
      expect(superDeleteAllStub.calledOnce).to.be.true();
      expect(superDeleteAllStub.firstCall.args[0]).to.be.undefined();
      expect(result.count).to.equal(2);
    });
  });
});
