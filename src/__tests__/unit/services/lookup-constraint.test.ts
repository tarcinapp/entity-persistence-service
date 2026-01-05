import { Getter } from '@loopback/core';
import { expect, sinon } from '@loopback/testlab';
import { EnvConfigHelper } from '../../../extensions/config-helpers/env-config-helper';
import { GenericEntity } from '../../../models/entity.model';
import { HttpErrorResponse } from '../../../models/http-error-response.model';
import { List } from '../../../models/list.model';
import { EntityReactionsRepository } from '../../../repositories/core/entity-reactions.repository';
import { EntityRepository } from '../../../repositories/core/entity.repository';
import { ListReactionsRepository } from '../../../repositories/core/list-reactions.repository';
import { ListRepository } from '../../../repositories/core/list.repository';
import type { LoggingService } from '../../../services/logging.service';
import { LookupConstraintService } from '../../../services/lookup-constraint.service';

describe('Utilities: LookupConstraint', () => {
  let service: LookupConstraintService;
  let mockLoggingService: Partial<LoggingService>;
  let mockEntityRepository: sinon.SinonStubbedInstance<EntityRepository>;
  let mockListRepository: sinon.SinonStubbedInstance<ListRepository>;
  let mockEntityReactionsRepository: sinon.SinonStubbedInstance<EntityReactionsRepository>;
  let mockListReactionsRepository: sinon.SinonStubbedInstance<ListReactionsRepository>;
  let processEnvBackup: NodeJS.ProcessEnv;

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
    mockEntityReactionsRepository = sinon.createStubInstance(
      EntityReactionsRepository,
    );
    mockListReactionsRepository = sinon.createStubInstance(
      ListReactionsRepository,
    );

    // Create service instance with repository getters
    service = new LookupConstraintService(
      mockLoggingService as LoggingService,
      Getter.fromValue(mockEntityRepository),
      Getter.fromValue(mockListRepository),
      Getter.fromValue(mockEntityReactionsRepository),
      Getter.fromValue(mockListReactionsRepository),
    );
  });

  afterEach(() => {
    // Restore process.env
    process.env = processEnvBackup;
    // Clear any references to prevent memory leaks
    service = null as any;
    mockEntityRepository = null as any;
    mockListRepository = null as any;
    mockEntityReactionsRepository = null as any;
    mockListReactionsRepository = null as any;
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
      EnvConfigHelper.reset();

      // Create a new service instance after setting the environment variable
      service = new LookupConstraintService(
        mockLoggingService as LoggingService,
        Getter.fromValue(mockEntityRepository),
        Getter.fromValue(mockListRepository),
        Getter.fromValue(mockEntityReactionsRepository),
        Getter.fromValue(mockListReactionsRepository),
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
      EnvConfigHelper.reset();

      // Create a new service instance after setting the environment variable
      service = new LookupConstraintService(
        mockLoggingService as LoggingService,
        Getter.fromValue(mockEntityRepository),
        Getter.fromValue(mockListRepository),
        Getter.fromValue(mockEntityReactionsRepository),
        Getter.fromValue(mockListReactionsRepository),
      );

      // Verify the constraints were loaded
      expect(service).to.not.be.null();
    });

    it('should handle invalid JSON in environment variables', () => {
      process.env.ENTITY_LOOKUP_CONSTRAINT = 'invalid json';
      EnvConfigHelper.reset();

      // Should not throw, just log warning
      expect(() => {
        new LookupConstraintService(
          mockLoggingService as LoggingService,
          Getter.fromValue(mockEntityRepository),
          Getter.fromValue(mockListRepository),
          Getter.fromValue(mockEntityReactionsRepository),
          Getter.fromValue(mockListReactionsRepository),
        );
      }).to.not.throw();
    });
  });

  describe('constraint validation', () => {
    describe('invalid references', () => {
      it('should reject invalid reference format', async () => {
        process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity',
          },
        ]);
        EnvConfigHelper.reset();

        // Create new service instance after setting environment variables
        service = new LookupConstraintService(
          mockLoggingService as LoggingService,
          Getter.fromValue(mockEntityRepository),
          Getter.fromValue(mockListRepository),
          Getter.fromValue(mockEntityReactionsRepository),
          Getter.fromValue(mockListReactionsRepository),
        );

        const entity = new GenericEntity({
          _kind: 'test',
          _name: 'Test Entity',
          _slug: 'test-entity',
          references: ['invalid-reference'],
        });

        await expect(
          service.validateLookupConstraints(entity, GenericEntity),
        ).to.be.rejectedWith(HttpErrorResponse);
      });

      it('should reject non-string reference', async () => {
        process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity',
          },
        ]);
        EnvConfigHelper.reset();

        // Create new service instance after setting environment variables
        service = new LookupConstraintService(
          mockLoggingService as LoggingService,
          Getter.fromValue(mockEntityRepository),
          Getter.fromValue(mockListRepository),
          Getter.fromValue(mockEntityReactionsRepository),
          Getter.fromValue(mockListReactionsRepository),
        );

        const entity = new GenericEntity({
          _kind: 'test',
          _name: 'Test Entity',
          _slug: 'test-entity',
          references: [123], // non-string reference
        });

        await expect(
          service.validateLookupConstraints(entity, GenericEntity),
        ).to.be.rejectedWith(HttpErrorResponse);
      });
    });

    describe('entity to entity validation', () => {
      describe('array case', () => {
        it('should validate multiple entity references', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'entity',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: [
              'tapp://localhost/entities/1',
              'tapp://localhost/entities/2',
            ],
          });

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.not.be.rejected();
        });

        it('should reject when referenced entity kind does not match targetKind', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: 'tapp://localhost/entities/1',
          });

          // Mock repository to return entity with incorrect kind
          mockEntityRepository.find.resolves([
            new GenericEntity({
              _kind: 'wrong',
              _name: 'Wrong Entity',
              _slug: 'wrong-entity',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.be.rejectedWith(HttpErrorResponse);
        });

        it('should reject when any referenced entity kind in array does not match targetKind', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: [
              'tapp://localhost/entities/1',
              'tapp://localhost/entities/2',
              'tapp://localhost/entities/3',
            ],
          });

          // Mock repository to return entities with mixed kinds
          mockEntityRepository.find.resolves([
            new GenericEntity({
              _kind: 'target', // This one is correct
              _name: 'Target Entity 1',
              _slug: 'target-entity-1',
            }),
            new GenericEntity({
              _kind: 'wrong', // This one is incorrect
              _name: 'Wrong Entity',
              _slug: 'wrong-entity',
            }),
            new GenericEntity({
              _kind: 'target', // This one is correct
              _name: 'Target Entity 2',
              _slug: 'target-entity-2',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });

      describe('single string case', () => {
        it('should validate single entity reference', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'entity',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: 'tapp://localhost/entities/1',
          });

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.not.be.rejected();
        });
      });

      describe('without sourceKind and targetKind', () => {
        it('should succeed when references match format', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'entity',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: 'tapp://localhost/entities/1',
          });

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.not.be.rejected();
        });

        it('should reject when references do not match format', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'entity',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: 'invalid-reference',
          });

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });

      describe('with sourceKind and targetKind', () => {
        it('should succeed when referenced entity kind matches targetKind', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test', // This is the source kind, doesn't need to match target
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: 'tapp://localhost/entities/1',
          });

          // Mock repository to return referenced entity with correct target kind
          mockEntityRepository.find.resolves([
            new GenericEntity({
              _kind: 'target', // This must match the targetKind in constraint
              _name: 'Target Entity',
              _slug: 'target-entity',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.not.be.rejected();
        });

        it('should reject when referenced entity kind does not match targetKind', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test', // This is the source kind, doesn't need to match target
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: 'tapp://localhost/entities/1',
          });

          // Mock repository to return referenced entity with incorrect target kind
          mockEntityRepository.find.resolves([
            new GenericEntity({
              _kind: 'wrong', // This doesn't match the targetKind in constraint
              _name: 'Wrong Entity',
              _slug: 'wrong-entity',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });

      describe('mix of multiple constraints', () => {
        it('should succeed when all constraints are satisfied', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references1',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target1',
            },
            {
              propertyPath: 'references2',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target2',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references1: 'tapp://localhost/entities/1',
            references2: 'tapp://localhost/entities/2',
          });

          // Mock repository to return entities with correct kinds
          mockEntityRepository.find
            .onFirstCall()
            .resolves([
              new GenericEntity({
                _kind: 'target1',
                _name: 'Target1 Entity',
                _slug: 'target1-entity',
              }),
            ])
            .onSecondCall()
            .resolves([
              new GenericEntity({
                _kind: 'target2',
                _name: 'Target2 Entity',
                _slug: 'target2-entity',
              }),
            ]);

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.not.be.rejected();
        });

        it('should reject when any constraint is not satisfied', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references1',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target1',
            },
            {
              propertyPath: 'references2',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target2',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references1: 'tapp://localhost/entities/1',
            references2: 'tapp://localhost/entities/2',
          });

          // Mock repository to return entities with incorrect kind for second reference
          mockEntityRepository.find
            .onFirstCall()
            .resolves([
              new GenericEntity({
                _kind: 'target1',
                _name: 'Target1 Entity',
                _slug: 'target1-entity',
              }),
            ])
            .onSecondCall()
            .resolves([
              new GenericEntity({
                _kind: 'wrong',
                _name: 'Wrong Entity',
                _slug: 'wrong-entity',
              }),
            ]);

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });

      it('should reject entity reference when only list references are allowed', async () => {
        process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
          {
            propertyPath: 'references',
            record: 'list', // Only list references are allowed
          },
        ]);
        EnvConfigHelper.reset();

        // Create new service instance after setting environment variables
        service = new LookupConstraintService(
          mockLoggingService as LoggingService,
          Getter.fromValue(mockEntityRepository),
          Getter.fromValue(mockListRepository),
          Getter.fromValue(mockEntityReactionsRepository),
          Getter.fromValue(mockListReactionsRepository),
        );

        const entity = new GenericEntity({
          _kind: 'test',
          _name: 'Test Entity',
          _slug: 'test-entity',
          references: 'tapp://localhost/entities/1', // Entity reference when only lists are allowed
        });

        await expect(
          service.validateLookupConstraints(entity, GenericEntity),
        ).to.be.rejectedWith(HttpErrorResponse);
      });
    });

    describe('entity to list validation', () => {
      describe('array case', () => {
        it('should validate multiple list references', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'list',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: [
              'tapp://localhost/lists/1',
              'tapp://localhost/lists/2',
            ],
          });

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.not.be.rejected();
        });
      });

      describe('single string case', () => {
        it('should validate single list reference', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'list',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: 'tapp://localhost/lists/1',
          });

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.not.be.rejected();
        });
      });

      describe('without sourceKind and targetKind', () => {
        it('should succeed when references match format', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'list',
            },
          ]);

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: 'tapp://localhost/lists/1',
          });

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.not.be.rejected();
        });

        it('should reject when references do not match format', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'list',
            },
          ]);

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: 'invalid-reference',
          });

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });

      describe('with sourceKind and targetKind', () => {
        it('should succeed when referenced list kind matches targetKind', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test', // This is the source kind, doesn't need to match target
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: 'tapp://localhost/lists/1',
          });

          // Mock repository to return referenced list with correct target kind
          mockListRepository.find.resolves([
            new List({
              _kind: 'target', // This must match the targetKind in constraint
              _name: 'Target List',
              _slug: 'target-list',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.not.be.rejected();
        });

        it('should reject when referenced list kind does not match targetKind', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test', // This is the source kind, doesn't need to match target
            _name: 'Test Entity',
            _slug: 'test-entity',
            references: 'tapp://localhost/lists/1',
          });

          // Mock repository to return referenced list with incorrect target kind
          mockListRepository.find.resolves([
            new List({
              _kind: 'wrong', // This doesn't match the targetKind in constraint
              _name: 'Wrong List',
              _slug: 'wrong-list',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });

      describe('mix of multiple constraints', () => {
        it('should succeed when all constraints are satisfied', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references1',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target1',
            },
            {
              propertyPath: 'references2',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target2',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references1: 'tapp://localhost/lists/1',
            references2: 'tapp://localhost/lists/2',
          });

          // Mock repository to return lists with correct kinds
          mockListRepository.find
            .onFirstCall()
            .resolves([
              new List({
                _kind: 'target1',
                _name: 'Target1 List',
                _slug: 'target1-list',
              }),
            ])
            .onSecondCall()
            .resolves([
              new List({
                _kind: 'target2',
                _name: 'Target2 List',
                _slug: 'target2-list',
              }),
            ]);

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.not.be.rejected();
        });

        it('should reject when any constraint is not satisfied', async () => {
          process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'references1',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target1',
            },
            {
              propertyPath: 'references2',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target2',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const entity = new GenericEntity({
            _kind: 'test',
            _name: 'Test Entity',
            _slug: 'test-entity',
            references1: 'tapp://localhost/lists/1',
            references2: 'tapp://localhost/lists/2',
          });

          // Mock repository to return lists with incorrect kind for second reference
          mockListRepository.find
            .onFirstCall()
            .resolves([
              new List({
                _kind: 'target1',
                _name: 'Target1 List',
                _slug: 'target1-list',
              }),
            ])
            .onSecondCall()
            .resolves([
              new List({
                _kind: 'wrong',
                _name: 'Wrong List',
                _slug: 'wrong-list',
              }),
            ]);

          await expect(
            service.validateLookupConstraints(entity, GenericEntity),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });

      it('should reject list reference when only entity references are allowed', async () => {
        process.env.ENTITY_LOOKUP_CONSTRAINT = JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity', // Only entity references are allowed
          },
        ]);

        EnvConfigHelper.reset();

        // Create new service instance after setting environment variables
        service = new LookupConstraintService(
          mockLoggingService as LoggingService,
          Getter.fromValue(mockEntityRepository),
          Getter.fromValue(mockListRepository),
          Getter.fromValue(mockEntityReactionsRepository),
          Getter.fromValue(mockListReactionsRepository),
        );

        const entity = new GenericEntity({
          _kind: 'test',
          _name: 'Test Entity',
          _slug: 'test-entity',
          references: 'tapp://localhost/lists/1', // List reference when only entities are allowed
        });

        await expect(
          service.validateLookupConstraints(entity, GenericEntity),
        ).to.be.rejectedWith(HttpErrorResponse);
      });
    });

    describe('list to entity validation', () => {
      describe('array case', () => {
        it('should validate multiple entity references from list', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'entity',
            },
          ]);

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: [
              'tapp://localhost/entities/1',
              'tapp://localhost/entities/2',
            ],
          });

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.not.be.rejected();
        });
      });

      describe('single string case', () => {
        it('should validate single entity reference from list', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'entity',
            },
          ]);

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: 'tapp://localhost/entities/1',
          });

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.not.be.rejected();
        });
      });

      describe('without sourceKind and targetKind', () => {
        it('should succeed when references match format', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'entity',
            },
          ]);

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: 'tapp://localhost/entities/1',
          });

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.not.be.rejected();
        });

        it('should reject when references do not match format', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'entity',
            },
          ]);

          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: 'invalid-reference',
          });

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });

      describe('with sourceKind and targetKind', () => {
        it('should succeed when referenced entity kind matches targetKind', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: 'tapp://localhost/entities/1',
          });

          // Mock repository to return entity with correct kind
          mockEntityRepository.find.resolves([
            new GenericEntity({
              _kind: 'target',
              _name: 'Target Entity',
              _slug: 'target-entity',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.not.be.rejected();
        });

        it('should reject when referenced entity kind does not match targetKind', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);

          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: 'tapp://localhost/entities/1',
          });

          // Mock repository to return entity with incorrect kind
          mockEntityRepository.find.resolves([
            new GenericEntity({
              _kind: 'wrong',
              _name: 'Wrong Entity',
              _slug: 'wrong-entity',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.be.rejectedWith(HttpErrorResponse);
        });

        it('should reject when any referenced entity kind in array does not match targetKind', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);

          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: [
              'tapp://localhost/entities/1',
              'tapp://localhost/entities/2',
              'tapp://localhost/entities/3',
            ],
          });

          // Mock repository to return entities with mixed kinds
          mockEntityRepository.find.resolves([
            new GenericEntity({
              _kind: 'target', // This one is correct
              _name: 'Target Entity 1',
              _slug: 'target-entity-1',
            }),
            new GenericEntity({
              _kind: 'wrong', // This one is incorrect
              _name: 'Wrong Entity',
              _slug: 'wrong-entity',
            }),
            new GenericEntity({
              _kind: 'target', // This one is correct
              _name: 'Target Entity 2',
              _slug: 'target-entity-2',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });

      describe('mix of multiple constraints', () => {
        it('should succeed when all constraints are satisfied', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items1',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target1',
            },
            {
              propertyPath: 'items2',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target2',
            },
          ]);

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items1: 'tapp://localhost/entities/1',
            items2: 'tapp://localhost/entities/2',
          });

          // Mock repository to return entities with correct kinds
          mockEntityRepository.find
            .onFirstCall()
            .resolves([
              new GenericEntity({
                _kind: 'target1',
                _name: 'Target1 Entity',
                _slug: 'target1-entity',
              }),
            ])
            .onSecondCall()
            .resolves([
              new GenericEntity({
                _kind: 'target2',
                _name: 'Target2 Entity',
                _slug: 'target2-entity',
              }),
            ]);

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.not.be.rejected();
        });

        it('should reject when any constraint is not satisfied', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items1',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target1',
            },
            {
              propertyPath: 'items2',
              record: 'entity',
              sourceKind: 'test',
              targetKind: 'target2',
            },
          ]);

          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items1: 'tapp://localhost/entities/1',
            items2: 'tapp://localhost/entities/2',
          });

          // Mock repository to return entities with incorrect kind for second reference
          mockEntityRepository.find
            .onFirstCall()
            .resolves([
              new GenericEntity({
                _kind: 'target1',
                _name: 'Target1 Entity',
                _slug: 'target1-entity',
              }),
            ])
            .onSecondCall()
            .resolves([
              new GenericEntity({
                _kind: 'wrong',
                _name: 'Wrong Entity',
                _slug: 'wrong-entity',
              }),
            ]);

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });
    });

    describe('list to list validation', () => {
      describe('array case', () => {
        it('should validate multiple list references from list', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'list',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: ['tapp://localhost/lists/1', 'tapp://localhost/lists/2'],
          });

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.not.be.rejected();
        });
      });

      describe('single string case', () => {
        it('should validate single list reference from list', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'list',
            },
          ]);
          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: 'tapp://localhost/lists/1',
          });

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.not.be.rejected();
        });
      });

      describe('without sourceKind and targetKind', () => {
        it('should succeed when references match format', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'list',
            },
          ]);

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: 'tapp://localhost/lists/1',
          });

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.not.be.rejected();
        });

        it('should reject when references do not match format', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'list',
            },
          ]);

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: 'invalid-reference',
          });

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });

      describe('with sourceKind and targetKind', () => {
        it('should succeed when referenced list kind matches targetKind', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: 'tapp://localhost/lists/1',
          });

          // Mock repository to return list with correct kind
          mockListRepository.find.resolves([
            new List({
              _kind: 'target',
              _name: 'Target List',
              _slug: 'target-list',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.not.be.rejected();
        });

        it('should reject when referenced list kind does not match targetKind', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);

          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: 'tapp://localhost/lists/1',
          });

          // Mock repository to return list with incorrect kind
          mockListRepository.find.resolves([
            new List({
              _kind: 'wrong',
              _name: 'Wrong List',
              _slug: 'wrong-list',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.be.rejectedWith(HttpErrorResponse);
        });

        it('should reject when any referenced list kind in array does not match targetKind', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target',
            },
          ]);

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items: [
              'tapp://localhost/lists/1',
              'tapp://localhost/lists/2',
              'tapp://localhost/lists/3',
            ],
          });

          // Mock repository to return lists with mixed kinds
          mockListRepository.find.resolves([
            new List({
              _kind: 'target', // This one is correct
              _name: 'Target List 1',
              _slug: 'target-list-1',
            }),
            new List({
              _kind: 'wrong', // This one is incorrect
              _name: 'Wrong List',
              _slug: 'wrong-list',
            }),
            new List({
              _kind: 'target', // This one is correct
              _name: 'Target List 2',
              _slug: 'target-list-2',
            }),
          ]);

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });

      describe('mix of multiple constraints', () => {
        it('should succeed when all constraints are satisfied', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items1',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target1',
            },
            {
              propertyPath: 'items2',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target2',
            },
          ]);

          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items1: 'tapp://localhost/lists/1',
            items2: 'tapp://localhost/lists/2',
          });

          // Mock repository to return lists with correct kinds
          mockListRepository.find
            .onFirstCall()
            .resolves([
              new List({
                _kind: 'target1',
                _name: 'Target1 List',
                _slug: 'target1-list',
              }),
            ])
            .onSecondCall()
            .resolves([
              new List({
                _kind: 'target2',
                _name: 'Target2 List',
                _slug: 'target2-list',
              }),
            ]);

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.not.be.rejected();
        });

        it('should reject when any constraint is not satisfied', async () => {
          process.env.LIST_LOOKUP_CONSTRAINT = JSON.stringify([
            {
              propertyPath: 'items1',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target1',
            },
            {
              propertyPath: 'items2',
              record: 'list',
              sourceKind: 'test',
              targetKind: 'target2',
            },
          ]);

          EnvConfigHelper.reset();

          // Create new service instance after setting environment variables
          service = new LookupConstraintService(
            mockLoggingService as LoggingService,
            Getter.fromValue(mockEntityRepository),
            Getter.fromValue(mockListRepository),
            Getter.fromValue(mockEntityReactionsRepository),
            Getter.fromValue(mockListReactionsRepository),
          );

          const list = new List({
            _kind: 'test',
            _name: 'Test List',
            _slug: 'test-list',
            items1: 'tapp://localhost/lists/1',
            items2: 'tapp://localhost/lists/2',
          });

          // Mock repository to return lists with incorrect kind for second reference
          mockListRepository.find
            .onFirstCall()
            .resolves([
              new List({
                _kind: 'target1',
                _name: 'Target1 List',
                _slug: 'target1-list',
              }),
            ])
            .onSecondCall()
            .resolves([
              new List({
                _kind: 'wrong',
                _name: 'Wrong List',
                _slug: 'wrong-list',
              }),
            ]);

          await expect(
            service.validateLookupConstraints(list, List),
          ).to.be.rejectedWith(HttpErrorResponse);
        });
      });
    });
  });
});
