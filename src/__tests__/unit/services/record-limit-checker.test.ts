import type { DefaultCrudRepository } from '@loopback/repository';
import { Entity } from '@loopback/repository';
import { expect, sinon } from '@loopback/testlab';
import type { LoggingService } from '../../../services/logging.service';
import { RecordLimitCheckerService } from '../../../services/record-limit-checker.service';
import { EnvConfigHelper } from '../../../extensions/config-helpers/env-config-helper';

describe('Utilities: RecordLimitChecker', () => {
  let service: RecordLimitCheckerService;
  let mockLoggingService: Partial<LoggingService>;
  let mockRepository: Partial<DefaultCrudRepository<any, any, any>>;
  let processEnvBackup: NodeJS.ProcessEnv;

  // Mock entity class
  class GenericEntity extends Entity {}

  beforeEach(() => {
    // Backup process.env
    processEnvBackup = { ...process.env };
    // Clear any existing limits and ensure we start with a clean state
    delete process.env.ENTITY_RECORD_LIMITS;

    // Create mock logging service
    mockLoggingService = {
      debug: () => {},
      error: () => {},
      warn: () => {},
    };

    // Create mock repository with a fresh instance for each test
    mockRepository = {
      count: async () => ({ count: 0 }),
    };

    // Reset EnvConfigHelper singleton to ensure fresh env values
    EnvConfigHelper.reset();
    // Create service instance
    service = new RecordLimitCheckerService(
      mockLoggingService as LoggingService,
    );
  });

  afterEach(() => {
    // Restore process.env
    process.env = processEnvBackup;
    // Clear any references to prevent memory leaks
    service = null as any;
    mockRepository = null as any;
    mockLoggingService = null as any;
  });

  describe('configuration parsing', () => {
    it('should parse entity limits from environment variables', async () => {
      const limits = [
        { scope: 'where[_kind]=book', limit: 10 },
        { scope: 'set[actives]', limit: 20 },
      ];

      process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);

      // Reset EnvConfigHelper singleton to ensure fresh env values
      EnvConfigHelper.reset();
      // Create a new service instance after setting the environment variable
      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      // Create a test entity that would match both limits
      const now = new Date();
      const testData = {
        _kind: 'book',
        _validFromDateTime: now.getTime() - 1000, // Ensure it's in the past
        _validUntilDateTime: null,
      };

      // Track the filters used in count calls
      const capturedFilters: any[] = [];
      let callCount = 0;
      const countPromises: Promise<{ count: number }>[] = [];
      let errorThrown = false;
      let error: any;

      mockRepository.count = async (filter) => {
        capturedFilters.push(filter);
        callCount++;
        // Add a small delay to prevent race conditions
        await new Promise((resolve) => setTimeout(resolve, 1));
        const promise = Promise.resolve({ count: callCount === 1 ? 5 : 20 });
        countPromises.push(promise);

        return promise;
      };

      // Wrap the checkLimits call in a try-catch and ensure we wait for all operations
      const checkLimitsPromise = service
        .checkLimits(
          GenericEntity,
          testData,
          mockRepository as DefaultCrudRepository<any, any, any>,
        )
        .catch((e) => {
          errorThrown = true;
          error = e;
        });

      // Wait for all operations to complete
      await Promise.all([checkLimitsPromise, ...countPromises]);

      // Verify the error was thrown
      expect(errorThrown).to.be.true();
      expect(error).to.not.be.undefined();
      expect(error.statusCode).to.equal(429);
      expect(error.code).to.equal('ENTITY-LIMIT-EXCEEDED');

      // Should call count twice since the record matches both limits
      expect(capturedFilters).to.have.length(2);

      // Verify the filters used in the count calls
      expect(capturedFilters[0]).to.deepEqual({
        _kind: 'book',
      });

      // The second filter should be from set[actives]
      expect(capturedFilters[1]).to.deepEqual({
        and: [
          {
            or: [
              {
                _validUntilDateTime: null,
              },
              {
                _validUntilDateTime: {
                  gt: capturedFilters[1].and[0].or[1]._validUntilDateTime.gt,
                },
              },
            ],
          },
          {
            _validFromDateTime: {
              neq: null,
            },
          },
          {
            _validFromDateTime: {
              lt: capturedFilters[1].and[2]._validFromDateTime.lt,
            },
          },
        ],
      });
    });

    it('should handle invalid JSON in environment variables', () => {
      process.env.ENTITY_RECORD_LIMITS = 'invalid json';
      EnvConfigHelper.reset();
      expect(() => {
        new RecordLimitCheckerService(mockLoggingService as LoggingService);
      }).to.throw('Invalid configuration');
    });

    it('should warn and ignore invalid duration strings in env config', () => {
      process.env.ENTITY_RECORD_LIMITS = JSON.stringify([
        { scope: 'where[_kind]=book', limit: 10, duration: 'not-a-duration' },
      ]);

      EnvConfigHelper.reset();

      let warned = false;
      mockLoggingService.warn = () => {
        warned = true;
      };

      expect(() => {
        new RecordLimitCheckerService(mockLoggingService as LoggingService);
      }).to.not.throw();

      expect(warned).to.be.true();
    });
  });

  describe('scope interpolation', () => {
    it('should interpolate simple values', async () => {
      const limits = [{ scope: 'where[_kind]=${_kind}', limit: 10 }];

      process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);
      EnvConfigHelper.reset();
      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      // Track the filter used in count call
      let capturedFilter: any;
      mockRepository.count = async (filter) => {
        capturedFilter = filter;

        return { count: 0 };
      };

      // Call the service and wait for it to complete
      await service.checkLimits(
        GenericEntity,
        { _kind: 'book' },
        mockRepository as DefaultCrudRepository<any, any, any>,
      );

      // Now we can safely check the captured filter
      expect(capturedFilter).to.not.be.undefined();
      expect(capturedFilter).to.deepEqual({
        _kind: 'book',
      });
    });

    it('should interpolate array values', async () => {
      const limits = [
        {
          scope: 'where[_ownerUsers][inq][0]=${_ownerUsers[0]}',
          limit: 10,
        },
      ];

      process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);
      EnvConfigHelper.reset();
      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      let capturedFilter: any;
      mockRepository.count = async (filter) => {
        capturedFilter = filter;

        return { count: 0 };
      };

      await service.checkLimits(
        GenericEntity,
        { _ownerUsers: ['user1', 'user2'] },
        mockRepository as DefaultCrudRepository<any, any, any>,
      );

      expect(capturedFilter).to.deepEqual({
        _ownerUsers: { inq: ['user1'] },
      });
    });

    it('should handle missing properties gracefully', async () => {
      const limits = [{ scope: 'where[missing]=${nonexistent}', limit: 10 }];

      process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);
      EnvConfigHelper.reset();
      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      let warningLogged = false;
      mockLoggingService.warn = () => {
        warningLogged = true;
      };

      await service.checkLimits(
        GenericEntity,
        { _kind: 'book' },
        mockRepository as DefaultCrudRepository<any, any, any>,
      );

      expect(warningLogged).to.be.true();
    });

    it('should handle set[audience] with userIds parameter', async () => {
      const limits = [
        { scope: 'set[audience][userIds]=${_ownerUsers}', limit: 10 },
      ];

      process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);
      EnvConfigHelper.reset();
      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      // Track all filters used in count calls
      const capturedFilters: any[] = [];

      mockRepository.count = async (filter) => {
        capturedFilters.push(filter);
        // Add a small delay to prevent race conditions
        await new Promise((resolve) => setTimeout(resolve, 1));

        return { count: 0 };
      };

      const now = new Date();
      const testData = {
        _ownerUsers: ['user1', 'user2'],
        _validFromDateTime: now.getTime() - 1000, // Ensure it's in the past
        _validUntilDateTime: null,
      };

      await service.checkLimits(
        GenericEntity,
        testData,
        mockRepository as DefaultCrudRepository<any, any, any>,
      );

      // Verify we captured at least one filter
      expect(capturedFilters.length).to.be.greaterThan(0);
      // The last captured filter should be the one we're interested in
      expect(capturedFilters[capturedFilters.length - 1]).to.Object();
    });

    it('should use dot notation to access nested values', async () => {
      const limits = [
        {
          // Use dot notation only in interpolation values, not in filter structure
          scope:
            'where[and][0][metadata.key]=${metadata.key}&where[and][1][metadata.nested.value]=${metadata.nested.value}',
          limit: 10,
        },
      ];

      process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);
      EnvConfigHelper.reset();
      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      let capturedFilter: any;
      mockRepository.count = async (filter) => {
        capturedFilter = filter;

        return { count: 0 };
      };

      const testData = {
        metadata: {
          key: 'value1',
          nested: {
            value: 'value2',
          },
        },
      };

      await service.checkLimits(
        GenericEntity,
        testData,
        mockRepository as DefaultCrudRepository<any, any, any>,
      );

      // Filter should have proper nested structure
      expect(capturedFilter).to.deepEqual({
        and: [
          {
            'metadata.key': 'value1',
          },
          {
            'metadata.nested.value': 'value2',
          },
        ],
      });
    });
  });

  describe('limit checking', () => {
    it('should not throw when count is below limit', async () => {
      const limits = [{ scope: 'where[_kind]=book', limit: 10 }];

      process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);
      EnvConfigHelper.reset();
      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      mockRepository.count = async () => ({ count: 5 });

      await expect(
        service.checkLimits(
          GenericEntity,
          { _kind: 'book' },
          mockRepository as DefaultCrudRepository<any, any, any>,
        ),
      ).to.not.be.rejected();
    });

    it('should throw when count equals limit', async () => {
      const limits = [{ scope: 'where[_kind]=book', limit: 10 }];

      process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);

      EnvConfigHelper.reset();

      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      mockRepository.count = async () => ({ count: 10 });

      await expect(
        service.checkLimits(
          GenericEntity,
          { _kind: 'book' },
          mockRepository as DefaultCrudRepository<any, any, any>,
        ),
      ).to.be.rejectedWith('Record limit exceeded for entity');
    });

    it('should skip limits that dont match the record', async () => {
      const limits = [
        { scope: 'where[_kind]=book', limit: 10 },
        { scope: 'where[_kind]=article', limit: 5 },
      ];

      process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);

      EnvConfigHelper.reset();

      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      let checkCount = 0;
      mockRepository.count = async () => {
        checkCount++;

        return { count: 0 };
      };

      await service.checkLimits(
        GenericEntity,
        { _kind: 'book' },
        mockRepository as DefaultCrudRepository<any, any, any>,
      );

      // Should only check the matching limit
      expect(checkCount).to.equal(1);
    });

    it('should not throw when updating and only the existing record matches the limit (self-exclusion)', async () => {
      const limits = [{ scope: 'where[_kind]=book', limit: 10 }];

      process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);
      EnvConfigHelper.reset();
      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      let capturedWhere: any;
      mockRepository.count = async (where) => {
        capturedWhere = where;
        // Simulate count after excluding the existing record
        return { count: 9 };
      };

      await expect(
        service.checkLimits(
          GenericEntity,
          { _id: 'existing-id', _kind: 'book' },
          mockRepository as DefaultCrudRepository<any, any, any>,
        ),
      ).to.not.be.rejected();

      // Ensure exclusion clause was injected
      expect(capturedWhere).to.not.be.undefined();
      expect(capturedWhere).to.have.property('and');
      expect(capturedWhere.and).to.be.Array();
      // The last clause should be the exclusion on _id
      const lastClause = capturedWhere.and[capturedWhere.and.length - 1];
      expect(lastClause).to.deepEqual({ _id: { neq: 'existing-id' } });
    });

    it('should honor duration in record limit by restricting to created date window', async () => {
      // Set system time to a known fixed point
      const systemTime = new Date('2024-01-14T21:00:00.000Z').getTime();
      const clock = sinon.useFakeTimers(systemTime);

      try {
        const limits = [
          { scope: 'where[_kind]=book', limit: 10, duration: '1d' },
        ];

        process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);
        EnvConfigHelper.reset();
        service = new RecordLimitCheckerService(
          mockLoggingService as LoggingService,
        );

        let capturedWhere: any;
        mockRepository.count = async (where) => {
          capturedWhere = where;
          return { count: 0 };
        };

        await expect(
          service.checkLimits(
            GenericEntity,
            { _kind: 'book' },
            mockRepository as DefaultCrudRepository<any, any, any>,
          ),
        ).to.not.be.rejected();

        // Ensure creation restriction was injected in the where clause
        expect(capturedWhere).to.not.be.undefined();
        expect(capturedWhere).to.have.property('and');
        const createdClause = capturedWhere.and[capturedWhere.and.length - 1];
        expect(createdClause).to.have.property('_createdDateTime');
        // Start date should be approximately now - 1 day
        const startIso = new Date(systemTime - 24 * 60 * 60 * 1000).toISOString();
        expect(createdClause._createdDateTime.gt).to.equal(startIso);
      } finally {
        clock.restore();
      }
    });

    it('should skip counting when incoming record _createdDateTime is older than duration window', async () => {
      // Freeze time for determinism
      const systemTime = new Date('2025-10-19T00:00:00.000Z').getTime();
      const clock = sinon.useFakeTimers(systemTime);

      try {
        const limits = [
          { scope: 'where[_kind]=book', limit: 10, duration: '30d' },
        ];

        process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);
        EnvConfigHelper.reset();
        service = new RecordLimitCheckerService(
          mockLoggingService as LoggingService,
        );

        let called = false;
        mockRepository.count = async () => {
          called = true;
          return { count: 0 };
        };

        // Create a record whose created date is 40 days ago (outside 30d window)
        const oldDate = new Date(systemTime - 40 * 24 * 60 * 60 * 1000).toISOString();

        await expect(
          service.checkLimits(
            GenericEntity,
            { _kind: 'book', _createdDateTime: oldDate },
            mockRepository as DefaultCrudRepository<any, any, any>,
          ),
        ).to.not.be.rejected();

        // Since the incoming record is outside the duration window, count
        // should not be invoked for this limit.
        expect(called).to.be.false();
      } finally {
        clock.restore();
      }
    });
  });

  describe('uniqueness checking', () => {
    it('should not flag uniqueness violation when updating the same record (self-exclusion)', async () => {
      process.env.ENTITY_UNIQUENESS = 'where[_name]=${_name}';
      EnvConfigHelper.reset();
      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      let capturedWhere: any;
      mockRepository.count = async (where) => {
        capturedWhere = where;
        // If exclusion was applied, simulate zero matches
        const hasExclusion = !!(where && (where as any).and && (where as any).and.some((w: any) => w && w._id && w._id.neq === 'existing-id'));
        return { count: hasExclusion ? 0 : 1 };
      };

      await expect(
        service.checkUniqueness(
          GenericEntity,
          { _id: 'existing-id', _name: 'duplicate' },
          mockRepository as DefaultCrudRepository<any, any, any>,
        ),
      ).to.not.be.rejected();

      expect(capturedWhere).to.not.be.undefined();
      expect(capturedWhere).to.have.property('and');
      const lastClause = capturedWhere.and[capturedWhere.and.length - 1];
      expect(lastClause).to.deepEqual({ _id: { neq: 'existing-id' } });
    });
  });
});
