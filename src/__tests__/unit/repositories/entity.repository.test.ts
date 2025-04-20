import { Getter } from '@loopback/core';
import { expect, sinon } from '@loopback/testlab';
import {
  setupRepositoryTest,
  teardownRepositoryTest,
} from './test-helper.repository';
import type { EntityPersistenceApplication } from '../../..';
import { LookupHelper } from '../../../extensions/utils/lookup-helper';
import type {
  GenericEntity,
  GenericEntityRelations,
  List,
  ListRelations,
} from '../../../models';
import { HttpErrorResponse, SingleError } from '../../../models';
import {
  ListEntityRelationRepository,
  ListRepository,
  EntityReactionsRepository,
} from '../../../repositories';
import { EntityRepository } from '../../../repositories/entity.repository';
import { LoggingService } from '../../../services/logging.service';
import { LookupConstraintService } from '../../../services/lookup-constraint.service';
import { RecordLimitCheckerService } from '../../../services/record-limit-checker.service';

describe('EntityRepository', () => {
  let app: EntityPersistenceApplication;
  let repository: EntityRepository;

  before(async () => {
    // Set up test environment
    const testSetup = await setupRepositoryTest();
    app = testSetup.app;

    // Create stubs for related repositories
    const reactionsRepoStub = sinon.createStubInstance(
      EntityReactionsRepository,
    );
    const listEntityRelationRepoStub = sinon.createStubInstance(
      ListEntityRelationRepository,
    );
    const listRepoStub = sinon.createStubInstance(ListRepository);
    const loggingServiceStub = sinon.createStubInstance(LoggingService);
    const recordLimitCheckerStub = sinon.createStubInstance(
      RecordLimitCheckerService,
    );
    const lookupConstraintServiceStub = sinon.createStubInstance(
      LookupConstraintService,
    );

    // Create a mock lookup helper
    const mockLookupHelper = sinon.createStubInstance(LookupHelper);
    mockLookupHelper.processLookupForArray.callsFake(
      async (
        items: ((List | GenericEntity) &
          (ListRelations | GenericEntityRelations))[],
      ) => Promise.resolve(items),
    );
    mockLookupHelper.processLookupForOne.callsFake(
      async (
        item: (List | GenericEntity) & (ListRelations | GenericEntityRelations),
      ) => Promise.resolve(item),
    );

    // Create main repository instance with stubbed dependencies
    repository = new EntityRepository(
      testSetup.dataSource,
      Getter.fromValue(listRepoStub),
      Getter.fromValue(reactionsRepoStub),
      Getter.fromValue(listEntityRelationRepoStub),
      testSetup.configReaders.uniquenessConfigReader,
      testSetup.configReaders.kindConfigReader,
      testSetup.configReaders.visibilityConfigReader,
      testSetup.configReaders.validfromConfigReader,
      testSetup.configReaders.idempotencyConfigReader,
      testSetup.configReaders.responseLimitConfigReader,
      mockLookupHelper,
      loggingServiceStub,
      recordLimitCheckerStub,
      lookupConstraintServiceStub,
    );
  });

  after(async () => {
    await teardownRepositoryTest(app);
  });

  it('should be properly instantiated', () => {
    expect(repository).to.be.instanceOf(EntityRepository);
  });

  it('should have all required relations configured', () => {
    expect(repository.reactions).to.not.be.undefined();
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
          .stub(repository['kindConfigReader'], 'isKindAcceptableForEntity')
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
          .stub(repository['kindConfigReader'], 'isKindAcceptableForEntity')
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let kindStub: sinon.SinonStub;

      beforeEach(() => {
        // Common stubs for validation tests
        sinon
          .stub(
            repository['idempotencyConfigReader'],
            'getIdempotencyForEntities',
          )
          .returns([]);
        kindStub = sinon
          .stub(repository['kindConfigReader'], 'isKindAcceptableForEntity')
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
        kindStub.returns(false);
        sinon
          .stub(repository['kindConfigReader'], 'allowedKindsForEntities')
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

        // Create a stub for the record limit checker
        const recordLimitCheckerStub = sinon.createStubInstance(
          RecordLimitCheckerService,
        );
        recordLimitCheckerStub.checkLimits.rejects(
          new HttpErrorResponse({
            statusCode: 429,
            name: 'LimitExceededError',
            message: 'Record limit exceeded for entity',
            code: 'ENTITY-LIMIT-EXCEEDED',
            status: 429,
            details: [
              new SingleError({
                code: 'ENTITY-LIMIT-EXCEEDED',
                message: 'Record limit exceeded for entity',
                info: {
                  limit: 2,
                  scope: 'where[_kind]=test-kind',
                },
              }),
            ],
          }),
        );
        recordLimitCheckerStub.checkUniqueness.resolves();

        // Replace the repository's record limit checker with our stub
        repository['recordLimitChecker'] = recordLimitCheckerStub;

        try {
          await repository.create(inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.equal('Record limit exceeded for entity');
          expect(error.code).to.equal('ENTITY-LIMIT-EXCEEDED');
          expect(error.details[0].info.limit).to.equal(2);
          expect(error.details[0].info.scope).to.equal(
            'where[_kind]=test-kind',
          );
        }

        // Verify the record limit checker was called with correct parameters
        expect(recordLimitCheckerStub.checkLimits.calledOnce).to.be.true();
        const [modelClass, data, repo] =
          recordLimitCheckerStub.checkLimits.firstCall.args;
        expect(modelClass.modelName).to.equal('GenericEntity');
        expect(data).to.deepEqual(inputData);
        expect(repo).to.equal(repository);
      });

      it('should throw error when uniqueness is violated', async () => {
        const inputData = { _name: 'test', _kind: 'test-kind' };

        // Create a stub for the record limit checker
        const recordLimitCheckerStub = sinon.createStubInstance(
          RecordLimitCheckerService,
        );
        recordLimitCheckerStub.checkUniqueness.rejects(
          new HttpErrorResponse({
            statusCode: 409,
            name: 'UniquenessViolationError',
            message: 'Entity already exists',
            code: 'ENTITY-UNIQUENESS-VIOLATION',
            status: 409,
            details: [
              new SingleError({
                code: 'ENTITY-UNIQUENESS-VIOLATION',
                message: 'Entity already exists',
                info: {
                  scope: 'where[_name]=test&where[_kind]=test-kind',
                },
              }),
            ],
          }),
        );
        recordLimitCheckerStub.checkLimits.resolves();

        // Replace the repository's record limit checker with our stub
        repository['recordLimitChecker'] = recordLimitCheckerStub;

        try {
          await repository.create(inputData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.equal('Entity already exists');
          expect(error.code).to.equal('ENTITY-UNIQUENESS-VIOLATION');
          expect(error.details[0].info.scope).to.equal(
            'where[_name]=test&where[_kind]=test-kind',
          );
        }

        // Verify the record limit checker was called with correct parameters
        expect(recordLimitCheckerStub.checkUniqueness.calledOnce).to.be.true();
        const [modelClass, data, repo] =
          recordLimitCheckerStub.checkUniqueness.firstCall.args;
        expect(modelClass.modelName).to.equal('GenericEntity');
        expect(data).to.deepEqual(inputData);
        expect(repo).to.equal(repository);
      });

      it('should use default entity kind when _kind is missing', async () => {
        const inputData = { _name: 'test' };
        const defaultKind = 'default-kind';

        // Setup stubs for default kind
        sinon
          .stub(repository['kindConfigReader'], 'defaultEntityKind')
          .get(() => defaultKind);
        kindStub.returns(true);

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let kindStub: sinon.SinonStub;

      beforeEach(() => {
        // Common stubs for validation tests
        kindStub = sinon
          .stub(repository['kindConfigReader'], 'isKindAcceptableForEntity')
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
      });

      it('should throw error with consistent message when entity does not exist', async () => {
        superFindByIdStub.resolves(null);

        try {
          await repository.replaceById(existingId, { _name: 'New Name' });
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /Entity with id 'test-id' could not be found/,
          );
        }

        expect(superReplaceByIdStub.called).to.be.false();
      });

      it('should throw error when uniqueness is violated', async () => {
        const updateData = { _name: 'updated-name' };

        // Create a stub for the record limit checker
        const recordLimitCheckerStub = sinon.createStubInstance(
          RecordLimitCheckerService,
        );
        recordLimitCheckerStub.checkUniqueness.rejects(
          new HttpErrorResponse({
            statusCode: 409,
            name: 'UniquenessViolationError',
            message: 'Entity already exists',
            code: 'ENTITY-UNIQUENESS-VIOLATION',
            status: 409,
            details: [
              new SingleError({
                code: 'ENTITY-UNIQUENESS-VIOLATION',
                message: 'Entity already exists',
                info: {
                  scope: 'where[_name]=updated-name&where[_kind]=test-kind',
                },
              }),
            ],
          }),
        );
        recordLimitCheckerStub.checkLimits.resolves();

        // Replace the repository's record limit checker with our stub
        repository['recordLimitChecker'] = recordLimitCheckerStub;

        try {
          await repository.replaceById(existingId, updateData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.equal('Entity already exists');
          expect(error.code).to.equal('ENTITY-UNIQUENESS-VIOLATION');
          expect(error.details[0].info.scope).to.equal(
            'where[_name]=updated-name&where[_kind]=test-kind',
          );
        }

        // Verify the record limit checker was called with correct parameters
        expect(recordLimitCheckerStub.checkUniqueness.calledOnce).to.be.true();
        const [modelClass, data, repo] =
          recordLimitCheckerStub.checkUniqueness.firstCall.args;
        expect(modelClass.modelName).to.equal('GenericEntity');
        expect(data).to.containDeep(updateData);
        expect(repo).to.equal(repository);

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
          _name: 'Updated Entity Name',
          _kind: 'test-kind',
        };

        await repository.replaceById(existingId, updateData);

        expect(superReplaceByIdStub.calledOnce).to.be.true();
        const replacedData = superReplaceByIdStub.firstCall.args[1];
        expect(replacedData._slug).to.equal('updated-entity-name');
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
          _name: 'Test Entity',
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
          .stub(
            repository['idempotencyConfigReader'],
            'getIdempotencyForEntities',
          )
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

      it('should throw error when trying to change kind field', async () => {
        const updateData = { _kind: 'different-kind' };

        try {
          await repository.replaceById(existingId, updateData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.match(
            /Entity kind cannot be changed after creation/,
          );
          expect(error.code).to.equal('IMMUTABLE-ENTITY-KIND');
        }

        expect(superReplaceByIdStub.called).to.be.false();
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let kindStub: sinon.SinonStub;

      beforeEach(() => {
        // Common stubs for validation tests
        kindStub = sinon
          .stub(repository['kindConfigReader'], 'isKindAcceptableForEntity')
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

      it('should throw error when uniqueness is violated', async () => {
        const updateData = { _name: 'updated-name' };

        // Create a stub for the record limit checker
        const recordLimitCheckerStub = sinon.createStubInstance(
          RecordLimitCheckerService,
        );
        recordLimitCheckerStub.checkUniqueness.rejects(
          new HttpErrorResponse({
            statusCode: 409,
            name: 'UniquenessViolationError',
            message: 'Entity already exists',
            code: 'ENTITY-UNIQUENESS-VIOLATION',
            status: 409,
            details: [
              new SingleError({
                code: 'ENTITY-UNIQUENESS-VIOLATION',
                message: 'Entity already exists',
                info: {
                  scope: 'where[_name]=updated-name&where[_kind]=test-kind',
                },
              }),
            ],
          }),
        );
        recordLimitCheckerStub.checkLimits.resolves();

        // Replace the repository's record limit checker with our stub
        repository['recordLimitChecker'] = recordLimitCheckerStub;

        try {
          await repository.updateById(existingId, updateData);
          throw new Error('Expected error was not thrown');
        } catch (error) {
          expect(error).to.be.instanceOf(HttpErrorResponse);
          expect(error.message).to.equal('Entity already exists');
          expect(error.code).to.equal('ENTITY-UNIQUENESS-VIOLATION');
          expect(error.details[0].info.scope).to.equal(
            'where[_name]=updated-name&where[_kind]=test-kind',
          );
        }

        // Verify the record limit checker was called with correct parameters
        expect(recordLimitCheckerStub.checkUniqueness.calledOnce).to.be.true();
        const [modelClass, data, repo] =
          recordLimitCheckerStub.checkUniqueness.firstCall.args;
        expect(modelClass.modelName).to.equal('GenericEntity');
        expect(data).to.containDeep(updateData);
        expect(repo).to.equal(repository);

        expect(superUpdateByIdStub.called).to.be.false();
      });

      it('should calculate idempotency key based on merged data', async () => {
        const updateData = { _name: 'test', _kind: 'test-kind' };
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
        expect(calledData._name).to.equal('Updated Name');
        expect(calledData._slug).to.equal('updated-name');
        expect(calledData._version).to.equal(2);
        expect(calledData._lastUpdatedDateTime).to.equal(now);
      });

      it('should preserve existing idempotency key when updating with same values', async () => {
        const existingIdempotencyKey =
          '63ea389183badf7004ee26e06f5ecf13995d26b088d9fcb8a7fe17502eb218a4';
        const existingData = {
          _id: existingId,
          _name: 'Test Entity',
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
          .stub(
            repository['idempotencyConfigReader'],
            'getIdempotencyForEntities',
          )
          .returns(['_name', '_kind', 'foo', 'bar']);

        // Update with same values
        const updateData = {
          _name: 'Test Entity',
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
    let reactionsRepoStub: sinon.SinonStubbedInstance<EntityReactionsRepository>;
    let listEntityRelationRepoStub: sinon.SinonStubbedInstance<ListEntityRelationRepository>;

    beforeEach(() => {
      // Create stubs for all related repositories
      reactionsRepoStub = sinon.createStubInstance(EntityReactionsRepository);
      listEntityRelationRepoStub = sinon.createStubInstance(
        ListEntityRelationRepository,
      );

      // Stub the repository getters
      (repository as any).reactionsRepositoryGetter = () =>
        Promise.resolve(reactionsRepoStub);
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

    it('should update matching entities with provided data', async () => {
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

    it('should pass options to super.updateAll', async () => {
      const where = { _kind: 'test-kind' };
      const updateData = { _name: 'Updated Name' };
      const options = { transaction: true };

      await repository.updateAll(updateData, where, options);

      expect(superUpdateAllStub.calledOnce).to.be.true();
      const [, , calledOptions] = superUpdateAllStub.firstCall.args;
      expect(calledOptions).to.deepEqual(options);
    });

    it('should throw error when trying to update kind field', async () => {
      const where = { _kind: 'test-kind' };
      const updateData = { _kind: 'new-kind' };

      try {
        await repository.updateAll(updateData, where);
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HttpErrorResponse);
        expect(error.message).to.match(
          /Entity kind cannot be changed after creation/,
        );
        expect(error.code).to.equal('IMMUTABLE-ENTITY-KIND');
      }

      expect(superUpdateAllStub.called).to.be.false();
    });
  });

  describe('deleteAll', () => {
    let superDeleteAllStub: sinon.SinonStub;
    let reactionsRepoStub: sinon.SinonStubbedInstance<EntityReactionsRepository>;
    let listEntityRelationRepoStub: sinon.SinonStubbedInstance<ListEntityRelationRepository>;

    beforeEach(() => {
      // Create stubs for all related repositories
      reactionsRepoStub = sinon.createStubInstance(EntityReactionsRepository);
      listEntityRelationRepoStub = sinon.createStubInstance(
        ListEntityRelationRepository,
      );

      // Stub the repository getters
      (repository as any).reactionsRepositoryGetter = () =>
        Promise.resolve(reactionsRepoStub);
      (repository as any).listEntityRelationRepositoryGetter = () =>
        Promise.resolve(listEntityRelationRepoStub);

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

    it('should delete matching entities and their relations', async () => {
      const where = { _kind: 'test-kind' };

      const result = await repository.deleteAll(where);

      // Verify relations are deleted
      expect(listEntityRelationRepoStub.deleteAll.calledOnce).to.be.true();

      // Verify entities are deleted
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

    it('should handle errors from entity deletion', async () => {
      const where = { _kind: 'test-kind' };
      const error = new Error('Failed to delete entities');
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

    it('should delete all entities when no where condition is provided', async () => {
      const result = await repository.deleteAll();

      // Verify relations are deleted
      expect(listEntityRelationRepoStub.deleteAll.calledOnce).to.be.true();

      // Verify all entities are deleted
      expect(superDeleteAllStub.calledOnce).to.be.true();
      expect(superDeleteAllStub.firstCall.args[0]).to.be.undefined();
      expect(result.count).to.equal(2);
    });
  });
});
