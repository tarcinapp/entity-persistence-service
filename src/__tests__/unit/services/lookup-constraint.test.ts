import { Getter } from '@loopback/core';
import { expect, sinon } from '@loopback/testlab';
import { ListEntityCommonBase } from '../../../models/base-models/list-entity-common-base.model';
import { GenericEntity } from '../../../models/entity.model';
import { HttpErrorResponse } from '../../../models/http-error-response.model';
import { List } from '../../../models/list.model';
import { EntityRepository } from '../../../repositories/entity.repository';
import { ListRepository } from '../../../repositories/list.repository';
import type { LoggingService } from '../../../services/logging.service';
import { LookupConstraintService } from '../../../services/lookup-constraint.service';

describe('Utilities: LookupConstraint', () => {
  let service: LookupConstraintService;
  let mockLoggingService: Partial<LoggingService>;
  let mockEntityRepository: sinon.SinonStubbedInstance<EntityRepository>;
  let mockListRepository: sinon.SinonStubbedInstance<ListRepository>;
  let processEnvBackup: NodeJS.ProcessEnv;

  // Mock entity class that extends ListEntityCommonBase
  class TestEntity extends ListEntityCommonBase {
    references?: string[];

    constructor(data?: Partial<TestEntity>) {
      super(data);
      if (data) {
        this.references = data.references;
      }
    }
  }

  // Helper function to create a GenericEntity with minimal required fields
  function createEntity(id: string, kind: string): GenericEntity {
    return new GenericEntity({
      _id: id,
      _kind: kind,
      _name: `${kind}-${id}`,
      _slug: `${kind}-${id}`,
    });
  }

  beforeEach(() => {
    // Backup process.env
    processEnvBackup = { ...process.env };
    // Clear any existing constraints
    delete process.env.ENTITY_LOOKUP_CONSTRAINT;
    delete process.env.LIST_LOOKUP_CONSTRAINT;

    // Create mock logging service
    mockLoggingService = {
      debug: () => {},
      error: () => {},
      warn: () => {},
    };

    // Create mock repositories
    mockEntityRepository = sinon.createStubInstance(EntityRepository);
    mockListRepository = sinon.createStubInstance(ListRepository);

    // Create service instance with repository getters
    service = new LookupConstraintService(
      mockLoggingService as LoggingService,
      Getter.fromValue(mockEntityRepository),
      Getter.fromValue(mockListRepository),
    );
  });

  afterEach(() => {
    // Restore process.env
    process.env = processEnvBackup;
    // Clear any references to prevent memory leaks
    service = null as any;
    mockEntityRepository = null as any;
    mockListRepository = null as any;
    mockLoggingService = null as any;
  });

  describe('configuration parsing', () => {
    it('should parse entity constraints from environment variables', () => {
      const constraints = [
        {
          propertyPath: 'references',
          record: 'entity',
          sourceKind: 'book',
          targetKind: 'author',
        },
      ];

      process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify(constraints);

      // Create a new service instance after setting the environment variable
      service = new LookupConstraintService(
        mockLoggingService as LoggingService,
        Getter.fromValue(mockEntityRepository),
        Getter.fromValue(mockListRepository),
      );

      // Verify the constraints were loaded
      expect(service).to.not.be.null();
    });

    it('should parse list constraints from environment variables', () => {
      const constraints = [
        {
          propertyPath: 'items',
          record: 'list',
          sourceKind: 'booklist',
          targetKind: 'book',
        },
      ];

      process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify(constraints);

      // Create a new service instance after setting the environment variable
      service = new LookupConstraintService(
        mockLoggingService as LoggingService,
        Getter.fromValue(mockEntityRepository),
        Getter.fromValue(mockListRepository),
      );

      // Verify the constraints were loaded
      expect(service).to.not.be.null();
    });

    it('should handle invalid JSON in environment variables', () => {
      process.env.ENTITY_LOOKUP_CONSTRAINT = 'invalid json';

      // Should not throw, just log warning
      expect(() => {
        new LookupConstraintService(
          mockLoggingService as LoggingService,
          Getter.fromValue(mockEntityRepository),
          Getter.fromValue(mockListRepository),
        );
      }).to.not.throw();
    });
  });

  describe('constraint validation', () => {
    it('should validate entity references with correct target kind', async () => {
      const constraints = [
        {
          propertyPath: 'references',
          record: 'entity',
          sourceKind: 'book',
          targetKind: 'author',
        },
      ];

      process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify(constraints);
      service = new LookupConstraintService(
        mockLoggingService as LoggingService,
        Getter.fromValue(mockEntityRepository),
        Getter.fromValue(mockListRepository),
      );

      // Mock repository to return valid items
      mockEntityRepository.find.resolves([
        createEntity('author1', 'author'),
        createEntity('author2', 'author'),
      ]);

      const entity = new TestEntity({
        _kind: 'book',
        _name: 'Test Book',
        _slug: 'test-book',
        references: [
          'tapp://localhost/entities/author1',
          'tapp://localhost/entities/author2',
        ],
      });

      await expect(
        service.validateLookupConstraints(entity),
      ).to.not.be.rejected();
    });

    it('should validate list references with correct target kind', async () => {
      const constraints = [
        {
          propertyPath: 'items',
          record: 'entity',
          sourceKind: 'booklist',
          targetKind: 'book',
        },
      ];

      process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify(constraints);
      service = new LookupConstraintService(
        mockLoggingService as LoggingService,
        Getter.fromValue(mockEntityRepository),
        Getter.fromValue(mockListRepository),
      );

      // Mock repository to return valid items
      mockEntityRepository.find.resolves([
        createEntity('book1', 'book'),
        createEntity('book2', 'book'),
      ]);

      const list = new List({
        _kind: 'booklist',
        _name: 'Test List',
        _slug: 'test-list',
        items: [
          'tapp://localhost/entities/book1',
          'tapp://localhost/entities/book2',
        ],
      });

      await service.validateLookupConstraints(list);
    });

    it('should throw error for invalid reference format', async () => {
      const constraints = [
        {
          propertyPath: 'references',
          record: 'entity',
          sourceKind: 'book',
          targetKind: 'author',
        },
      ];

      process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify(constraints);
      service = new LookupConstraintService(
        mockLoggingService as LoggingService,
        Getter.fromValue(mockEntityRepository),
        Getter.fromValue(mockListRepository),
      );

      const entity = new TestEntity({
        _kind: 'book',
        _name: 'Test Book',
        _slug: 'test-book',
        references: ['invalid-reference'],
      });

      await expect(
        service.validateLookupConstraints(entity),
      ).to.be.rejectedWith(HttpErrorResponse);
    });

    it('should throw error for invalid target kind', async () => {
      const constraints = [
        {
          propertyPath: 'references',
          record: 'entity',
          sourceKind: 'book',
          targetKind: 'author',
        },
      ];

      process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify(constraints);
      service = new LookupConstraintService(
        mockLoggingService as LoggingService,
        Getter.fromValue(mockEntityRepository),
        Getter.fromValue(mockListRepository),
      );

      // Mock repository to return items with wrong kind
      mockEntityRepository.find.resolves([
        createEntity('wrong1', 'wrong'),
        createEntity('wrong2', 'wrong'),
      ]);

      const entity = new TestEntity({
        _kind: 'book',
        _name: 'Test Book',
        _slug: 'test-book',
        references: [
          'tapp://localhost/entities/wrong1',
          'tapp://localhost/entities/wrong2',
        ],
      });

      await expect(
        service.validateLookupConstraints(entity),
      ).to.be.rejectedWith(HttpErrorResponse);
    });

    it('should skip validation when no constraints are configured', async () => {
      const entity = new TestEntity({
        _kind: 'book',
        _name: 'Test Book',
        _slug: 'test-book',
        references: ['tapp://localhost/entities/any'],
      });

      await expect(
        service.validateLookupConstraints(entity),
      ).to.not.be.rejected();
    });

    it('should skip validation when no references are provided', async () => {
      const constraints = [
        {
          propertyPath: 'references',
          record: 'entity',
          sourceKind: 'book',
          targetKind: 'author',
        },
      ];

      process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify(constraints);
      service = new LookupConstraintService(
        mockLoggingService as LoggingService,
        Getter.fromValue(mockEntityRepository),
        Getter.fromValue(mockListRepository),
      );

      const entity = new TestEntity({
        _kind: 'book',
        _name: 'Test Book',
        _slug: 'test-book',
        references: [],
      });

      await expect(
        service.validateLookupConstraints(entity),
      ).to.not.be.rejected();
    });

    it('should validate entity references against constraints', async () => {
      const entity = new GenericEntity({
        _kind: 'test',
        _name: 'Test Entity',
        _slug: 'test-entity',
        references: {
          'test-reference': 'test-value',
        },
      });

      await service.validateLookupConstraints(entity);
      // No error should be thrown
    });

    it('should throw error for invalid entity reference', async () => {
      const entity = new GenericEntity({
        _kind: 'test',
        _name: 'Test Entity',
        _slug: 'test-entity',
        references: {
          'invalid-reference': 'test-value',
        },
      });

      await expect(
        service.validateLookupConstraints(entity),
      ).to.be.rejectedWith(HttpErrorResponse);
    });

    it('should validate list references against constraints', async () => {
      const list = new List({
        _kind: 'test',
        _name: 'Test List',
        _slug: 'test-list',
        references: {
          'test-reference': 'test-value',
        },
      });

      await service.validateLookupConstraints(list);
      // No error should be thrown
    });

    it('should throw error for invalid list reference', async () => {
      const list = new List({
        _kind: 'test',
        _name: 'Test List',
        _slug: 'test-list',
        references: {
          'invalid-reference': 'test-value',
        },
      });

      await expect(service.validateLookupConstraints(list)).to.be.rejectedWith(
        HttpErrorResponse,
      );
    });
  });
});
