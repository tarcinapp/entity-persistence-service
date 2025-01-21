import { Getter } from '@loopback/core';
import { expect, sinon } from '@loopback/testlab';
import {
  setupRepositoryTest,
  teardownRepositoryTest,
} from './test-helper.repository';
import type { EntityPersistenceApplication } from '../../..';
import { HttpErrorResponse } from '../../../models';
import {
  GenericListEntityRelationRepository,
  ReactionsRepository,
  RelationRepository,
  TagEntityRelationRepository,
  TagRepository,
} from '../../../repositories';
import { GenericEntityRepository } from '../../../repositories/generic-entity.repository';

describe('GenericEntityRepository', () => {
  let app: EntityPersistenceApplication;
  let repository: GenericEntityRepository;

  before(async () => {
    // Set up test environment
    const testSetup = await setupRepositoryTest();
    app = testSetup.app;

    // Create stubs for related repositories
    const relationRepoStub = sinon.createStubInstance(RelationRepository);
    const reactionsRepoStub = sinon.createStubInstance(ReactionsRepository);
    const tagEntityRelationRepoStub = sinon.createStubInstance(
      TagEntityRelationRepository,
    );
    const tagRepoStub = sinon.createStubInstance(TagRepository);
    const listEntityRelationRepoStub = sinon.createStubInstance(
      GenericListEntityRelationRepository,
    );

    // Create main repository instance with stubbed dependencies
    repository = new GenericEntityRepository(
      testSetup.dataSource,
      Getter.fromValue(relationRepoStub),
      Getter.fromValue(reactionsRepoStub),
      Getter.fromValue(tagEntityRelationRepoStub),
      Getter.fromValue(tagRepoStub),
      Getter.fromValue(listEntityRelationRepoStub),
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
    expect(repository).to.be.instanceOf(GenericEntityRepository);
  });

  it('should have all required relations configured', () => {
    expect(repository.children).to.not.be.undefined();
    expect(repository.reactions).to.not.be.undefined();
    expect(repository.tags).to.not.be.undefined();
  });

  describe('find', () => {
    let superFindStub: sinon.SinonStub;
    const configuredLimit = 50;

    beforeEach(() => {
      // Stub the parent class's find method instead of the repository's find method
      superFindStub = sinon
        .stub(Object.getPrototypeOf(Object.getPrototypeOf(repository)), 'find')
        .callsFake(async (_filter, _options) => {
          return [];
        });

      // Stub the responseLimitConfigReader
      sinon
        .stub(repository['responseLimitConfigReader'], 'getEntityResponseLimit')
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
      it('should return existing entity when idempotent entity exists', async () => {
        const existingEntity = { _id: '123', _name: 'test' };
        const idempotencyFields = ['_name'];

        // Setup stubs
        sinon
          .stub(
            repository['idempotencyConfigReader'],
            'getIdempotencyForEntities',
          )
          .returns(idempotencyFields);
        superFindOneStub.resolves(existingEntity);

        const result = await repository.create({ _name: 'test' });

        expect(result).to.deepEqual(existingEntity);
        expect(superCreateStub.called).to.be.false();
      });

      it('should proceed with creation when no idempotent entity exists', async () => {
        const idempotencyFields = ['_name'];
        const inputData = { _name: 'test', _kind: 'test-kind' };

        // Setup stubs
        sinon
          .stub(
            repository['idempotencyConfigReader'],
            'getIdempotencyForEntities',
          )
          .returns(idempotencyFields);
        sinon
          .stub(
            repository['kindLimitConfigReader'],
            'isKindAcceptableForEntity',
          )
          .returns(true);
        sinon
          .stub(
            repository['visibilityConfigReader'],
            'getVisibilityForEntities',
          )
          .returns('public');
        sinon
          .stub(repository['validfromConfigReader'], 'getValidFromForEntities')
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
          .stub(
            repository['idempotencyConfigReader'],
            'getIdempotencyForEntities',
          )
          .returns([]);
        sinon
          .stub(
            repository['kindLimitConfigReader'],
            'isKindAcceptableForEntity',
          )
          .returns(true);
        sinon
          .stub(
            repository['visibilityConfigReader'],
            'getVisibilityForEntities',
          )
          .returns('public');
        sinon
          .stub(repository['validfromConfigReader'], 'getValidFromForEntities')
          .returns(true);

        await repository.create(inputData);

        expect(superFindOneStub.called).to.be.false();
        expect(superCreateStub.calledOnce).to.be.true();
      });
    });

    describe('validation and enrichment', () => {
      let kindLimitStub: sinon.SinonStub;
      let uniquenessStub: sinon.SinonStub;
      let recordLimitStub: sinon.SinonStub;

      beforeEach(() => {
        // Common stubs for validation tests
        sinon
          .stub(
            repository['idempotencyConfigReader'],
            'getIdempotencyForEntities',
          )
          .returns([]);
        kindLimitStub = sinon
          .stub(
            repository['kindLimitConfigReader'],
            'isKindAcceptableForEntity',
          )
          .returns(true);
        sinon
          .stub(
            repository['visibilityConfigReader'],
            'getVisibilityForEntities',
          )
          .returns('public');
        sinon
          .stub(repository['validfromConfigReader'], 'getValidFromForEntities')
          .returns(true);
        uniquenessStub = sinon
          .stub(
            repository['uniquenessConfigReader'],
            'isUniquenessConfiguredForEntities',
          )
          .returns(false);
        recordLimitStub = sinon
          .stub(
            repository['recordLimitConfigReader'],
            'isRecordLimitsConfiguredForEntities',
          )
          .returns(false);
      });

      it('should enrich entity with managed fields', async () => {
        const inputData = {
          _name: 'Test Entity',
          _kind: 'test-kind',
          _ownerUsers: [],
          _ownerGroups: [],
          _viewerUsers: [],
          _viewerGroups: [],
        };

        const result = await repository.create(inputData);

        expect(result).to.containDeep({
          _name: 'Test Entity',
          _kind: 'test-kind',
          _slug: 'test-entity',
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

      it('should enrich entity with managed fields for empty arrays', async () => {
        const inputData = {
          _name: 'Test Entity',
          _kind: 'test-kind',
          _ownerUsers: [],
          _ownerGroups: [],
          _viewerUsers: [],
          _viewerGroups: [],
        };

        const result = await repository.create(inputData);

        expect(result).to.containDeep({
          _name: 'Test Entity',
          _kind: 'test-kind',
          _slug: 'test-entity',
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

      it('should enrich entity with managed fields for non-empty arrays', async () => {
        const inputData = {
          _name: 'Test Entity',
          _kind: 'test-kind',
          _ownerUsers: ['user1', 'user2'],
          _ownerGroups: ['group1'],
          _viewerUsers: ['user3'],
          _viewerGroups: ['group2', 'group3', 'group4'],
        };

        const result = await repository.create(inputData);

        expect(result).to.containDeep({
          _name: 'Test Entity',
          _kind: 'test-kind',
          _slug: 'test-entity',
          _version: 1,
          _visibility: 'public',
          _createdDateTime: now,
          _lastUpdatedDateTime: now,
          _validFromDateTime: now,
          _ownerUsers: ['user1', 'user2'],
          _ownerGroups: ['group1'],
          _viewerUsers: ['user3'],
          _viewerGroups: ['group2', 'group3', 'group4'],
          _ownerUsersCount: 2,
          _ownerGroupsCount: 1,
          _viewerUsersCount: 1,
          _viewerGroupsCount: 3,
        });
      });

      it('should throw error for invalid kind format', async () => {
        const inputData = { _name: 'test', _kind: 'Test Kind!' };

        try {
          await repository.create(inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /Entity kind cannot contain special or uppercase characters/,
          );
        }
      });

      it('should throw error when kind is not in allowed values', async () => {
        const inputData = { _name: 'test', _kind: 'invalid-kind' };

        // Override the default stub
        kindLimitStub.returns(false);
        sinon
          .stub(repository['kindLimitConfigReader'], 'allowedKindsForEntities')
          .get(() => ['allowed-kind']);

        try {
          await repository.create(inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /Entity kind 'invalid-kind' is not valid/,
          );
        }
      });

      it('should throw error when record limit is exceeded', async () => {
        const inputData = { _name: 'test', _kind: 'test-kind' };

        // Override the default stubs
        recordLimitStub.returns(true);
        sinon
          .stub(
            repository['recordLimitConfigReader'],
            'getRecordLimitsCountForEntities',
          )
          .returns(5);
        sinon
          .stub(
            repository['recordLimitConfigReader'],
            'isLimitConfiguredForKindForEntities',
          )
          .returns(true);
        sinon
          .stub(
            Object.getPrototypeOf(Object.getPrototypeOf(repository)),
            'count',
          )
          .resolves({ count: 5 });

        try {
          await repository.create(inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(/Entity limit is exceeded/);
        }
      });

      it('should throw error when uniqueness is violated', async () => {
        const inputData = { _name: 'test', _kind: 'test-kind' };
        const existingEntity = { _id: 'existing', _name: 'test' }; // Same _name as inputData

        // Override the default stub
        uniquenessStub.returns(true);
        sinon
          .stub(repository['uniquenessConfigReader'], 'getFieldsForEntities')
          .returns(['_name']);
        superFindOneStub.resolves(existingEntity);

        try {
          await repository.create(inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(/Entity already exists/);
        }
      });

      it('should use default entity kind when _kind is missing', async () => {
        const inputData = { _name: 'test' };
        const defaultKind = 'default-kind';

        // Setup stubs for default kind
        sinon
          .stub(repository['kindLimitConfigReader'], 'defaultEntityKind')
          .get(() => defaultKind);
        kindLimitStub.returns(true);

        const result = await repository.create(inputData);

        expect(result._kind).to.equal(defaultKind);
        expect(superCreateStub.calledOnce).to.be.true();
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
        .callsFake(async (id, data) => data);

      // Stub super.findById for fetching existing entity
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
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('validation and enrichment', () => {
      let kindLimitStub: sinon.SinonStub;
      let uniquenessStub: sinon.SinonStub;

      beforeEach(() => {
        // Common stubs for validation tests
        kindLimitStub = sinon
          .stub(
            repository['kindLimitConfigReader'],
            'isKindAcceptableForEntity',
          )
          .returns(true);
        uniquenessStub = sinon
          .stub(
            repository['uniquenessConfigReader'],
            'isUniquenessConfiguredForEntities',
          )
          .returns(false);
      });

      it('should throw error when entity does not exist', async () => {
        superFindByIdStub.resolves(null);

        try {
          await repository.replaceById('non-existent-id', { _name: 'test' });
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /Entity with id 'non-existent-id' could not be found/,
          );
        }

        expect(superReplaceByIdStub.called).to.be.false();
      });

      it('should enrich entity with managed fields', async () => {
        const inputData = {
          _name: 'Updated Entity',
          _kind: 'test-kind',
          _ownerUsers: ['user1'],
          _ownerGroups: ['group1', 'group2'],
          _viewerUsers: ['user2', 'user3'],
          _viewerGroups: ['group3'],
        };

        const result = await repository.replaceById(existingId, inputData);

        expect(result).to.containDeep({
          _name: 'Updated Entity',
          _kind: 'test-kind',
          _slug: 'updated-entity',
          _version: 2,
          _ownerUsers: ['user1'],
          _ownerGroups: ['group1', 'group2'],
          _viewerUsers: ['user2', 'user3'],
          _viewerGroups: ['group3'],
          _ownerUsersCount: 1,
          _ownerGroupsCount: 2,
          _viewerUsersCount: 2,
          _viewerGroupsCount: 1,
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
            /Entity kind cannot contain special or uppercase characters/,
          );
        }

        expect(superReplaceByIdStub.called).to.be.false();
      });

      it('should throw error when kind is not in allowed values', async () => {
        const inputData = { _name: 'test', _kind: 'invalid-kind' };

        kindLimitStub.returns(false);
        sinon
          .stub(repository['kindLimitConfigReader'], 'allowedKindsForEntities')
          .get(() => ['allowed-kind']);

        try {
          await repository.replaceById(existingId, inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /Entity kind 'invalid-kind' is not valid/,
          );
        }

        expect(superReplaceByIdStub.called).to.be.false();
      });

      it('should throw error when uniqueness is violated', async () => {
        const inputData = { _name: 'existing-name', _kind: 'test-kind' };
        const existingEntity = { _id: 'another-id', _name: 'existing-name' };

        // Setup uniqueness check to find a conflicting entity
        uniquenessStub.returns(true);
        sinon
          .stub(repository['uniquenessConfigReader'], 'getFieldsForEntities')
          .returns(['_name']);
        sinon
          .stub(
            Object.getPrototypeOf(Object.getPrototypeOf(repository)),
            'findOne',
          )
          .resolves(existingEntity);

        try {
          await repository.replaceById(existingId, inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(/Entity already exists/);
        }

        expect(superReplaceByIdStub.called).to.be.false();
      });

      it('should calculate idempotency key', async () => {
        const inputData = { _name: 'test', _kind: 'test-kind' };
        const idempotencyFields = ['_name'];

        sinon
          .stub(
            repository['idempotencyConfigReader'],
            'getIdempotencyForEntities',
          )
          .returns(idempotencyFields);

        const result = (await repository.replaceById(
          existingId,
          inputData,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        )) as any;

        expect(typeof result._idempotencyKey).to.equal('string');
      });

      it('should skip idempotency key calculation when not configured', async () => {
        const inputData = { _name: 'test', _kind: 'test-kind' };

        sinon
          .stub(
            repository['idempotencyConfigReader'],
            'getIdempotencyForEntities',
          )
          .returns([]);

        const result = (await repository.replaceById(
          existingId,
          inputData,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        )) as any;

        expect(result._idempotencyKey).to.equal(undefined);
      });
    });
  });

  describe('updateById', () => {
    let superUpdateByIdStub: sinon.SinonStub;
    let superFindByIdStub: sinon.SinonStub;
    const now = '2024-01-01T00:00:00.000Z';
    const existingId = 'test-id';
    const existingEntity = {
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

      // Stub super.updateById to merge data with existing entity
      superUpdateByIdStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'updateById',
        )
        .callsFake(async (...args) => {
          const data = args[1] as Record<string, unknown>;
          const merged = {
            ...existingEntity,
            ...data,
            _lastUpdatedDateTime: now,
            _version: (existingEntity._version ?? 1) + 1,
            _createdDateTime: existingEntity._createdDateTime,
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

      // Stub super.findById for fetching existing entity
      superFindByIdStub = sinon
        .stub(
          Object.getPrototypeOf(Object.getPrototypeOf(repository)),
          'findById',
        )
        .resolves(existingEntity);
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('validation and enrichment', () => {
      let kindLimitStub: sinon.SinonStub;
      let uniquenessStub: sinon.SinonStub;

      beforeEach(() => {
        // Common stubs for validation tests
        kindLimitStub = sinon
          .stub(
            repository['kindLimitConfigReader'],
            'isKindAcceptableForEntity',
          )
          .returns(true);
        uniquenessStub = sinon
          .stub(
            repository['uniquenessConfigReader'],
            'isUniquenessConfiguredForEntities',
          )
          .returns(false);
      });

      it('should throw error when entity does not exist', async () => {
        superFindByIdStub.resolves(null);

        try {
          await repository.updateById('non-existent-id', { _name: 'test' });
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /Entity with id 'non-existent-id' could not be found/,
          );
        }

        expect(superUpdateByIdStub.called).to.be.false();
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

      it('should throw error for invalid kind format', async () => {
        const updateData = { _kind: 'Test Kind!' };

        try {
          await repository.updateById(existingId, updateData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /Entity kind cannot contain special or uppercase characters/,
          );
        }

        expect(superUpdateByIdStub.called).to.be.false();
      });

      it('should throw error when kind is not in allowed values', async () => {
        const updateData = { _kind: 'invalid-kind' };

        kindLimitStub.returns(false);
        sinon
          .stub(repository['kindLimitConfigReader'], 'allowedKindsForEntities')
          .get(() => ['allowed-kind']);

        try {
          await repository.updateById(existingId, updateData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /Entity kind 'invalid-kind' is not valid/,
          );
        }

        expect(superUpdateByIdStub.called).to.be.false();
      });

      it('should throw error when uniqueness is violated', async () => {
        const updateData = { _name: 'existing-name' };
        const conflictingEntity = { _id: 'another-id', _name: 'existing-name' };

        uniquenessStub.returns(true);
        sinon
          .stub(repository['uniquenessConfigReader'], 'getFieldsForEntities')
          .returns(['_name']);
        sinon
          .stub(
            Object.getPrototypeOf(Object.getPrototypeOf(repository)),
            'findOne',
          )
          .resolves(conflictingEntity);

        try {
          await repository.updateById(existingId, updateData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(/Entity already exists/);
        }

        expect(superUpdateByIdStub.called).to.be.false();
      });

      it('should calculate idempotency key based on merged data', async () => {
        const updateData = { _name: 'test' };
        const idempotencyFields = ['_name', '_kind']; // Both fields for idempotency

        sinon
          .stub(
            repository['idempotencyConfigReader'],
            'getIdempotencyForEntities',
          )
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
          .stub(
            repository['idempotencyConfigReader'],
            'getIdempotencyForEntities',
          )
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
        expect(calledData).to.deepEqual({
          _name: 'Updated Name',
          _slug: 'updated-name',
          _version: 2,
          _lastUpdatedDateTime: now,
        });
      });
    });
  });

  describe('deleteById', () => {
    let superDeleteByIdStub: sinon.SinonStub;
    let relationRepoStub: sinon.SinonStubbedInstance<RelationRepository>;
    let reactionsRepoStub: sinon.SinonStubbedInstance<ReactionsRepository>;
    let tagEntityRelationRepoStub: sinon.SinonStubbedInstance<TagEntityRelationRepository>;
    let tagRepoStub: sinon.SinonStubbedInstance<TagRepository>;
    let listEntityRelationRepoStub: sinon.SinonStubbedInstance<GenericListEntityRelationRepository>;

    beforeEach(() => {
      // Create stubs for all related repositories
      relationRepoStub = sinon.createStubInstance(RelationRepository);
      reactionsRepoStub = sinon.createStubInstance(ReactionsRepository);
      tagEntityRelationRepoStub = sinon.createStubInstance(
        TagEntityRelationRepository,
      );
      tagRepoStub = sinon.createStubInstance(TagRepository);
      listEntityRelationRepoStub = sinon.createStubInstance(
        GenericListEntityRelationRepository,
      );

      // Stub the repository getters
      (repository as any).relationRepositoryGetter = () =>
        Promise.resolve(relationRepoStub);
      (repository as any).reactionsRepositoryGetter = () =>
        Promise.resolve(reactionsRepoStub);
      (repository as any).tagEntityRelationRepositoryGetter = () =>
        Promise.resolve(tagEntityRelationRepoStub);
      (repository as any).tagRepositoryGetter = () =>
        Promise.resolve(tagRepoStub);
      (repository as any).listEntityRelationRepositoryGetter = () =>
        Promise.resolve(listEntityRelationRepoStub);

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

    it('should delete entity and its relations', async () => {
      const entityId = 'test-id';

      await repository.deleteById(entityId);

      // Verify relations are deleted
      expect(listEntityRelationRepoStub.deleteAll.calledOnce).to.be.true();

      // Verify entity is deleted
      expect(superDeleteByIdStub.calledOnce).to.be.true();
      expect(superDeleteByIdStub.firstCall.args[0]).to.equal(entityId);
    });

    it('should pass options to super.deleteById', async () => {
      const entityId = 'test-id';
      const options = { transaction: true };

      await repository.deleteById(entityId, options);

      expect(superDeleteByIdStub.calledOnce).to.be.true();
      expect(superDeleteByIdStub.firstCall.args[1]).to.deepEqual(options);
    });

    it('should handle errors from entity deletion', async () => {
      const entityId = 'test-id';
      const error = new Error('Failed to delete entity');
      superDeleteByIdStub.rejects(error);

      try {
        await repository.deleteById(entityId);
        throw new Error('Expected error was not thrown');
      } catch (e) {
        expect(e).to.equal(error);
      }

      // Verify relations were still deleted
      expect(listEntityRelationRepoStub.deleteAll.calledOnce).to.be.true();
    });
  });
});
