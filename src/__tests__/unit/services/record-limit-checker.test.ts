import type { DefaultCrudRepository } from '@loopback/repository';
import { Entity } from '@loopback/repository';
import { expect } from '@loopback/testlab';
import type { LoggingService } from '../../../services/logging.service';
import { RecordLimitCheckerService } from '../../../services/record-limit-checker.service';

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

      expect(() => {
        new RecordLimitCheckerService(mockLoggingService as LoggingService);
      }).to.throw('Invalid configuration');
    });
  });

  describe('scope interpolation', () => {
    it('should interpolate simple values', async () => {
      const limits = [{ scope: 'where[_kind]=${_kind}', limit: 10 }];

      process.env.ENTITY_RECORD_LIMITS = JSON.stringify(limits);
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
      service = new RecordLimitCheckerService(
        mockLoggingService as LoggingService,
      );

      let capturedFilter: any;
      mockRepository.count = async (filter) => {
        capturedFilter = filter;

        return { count: 0 };
      };

      const validFromDateTime = new Date().toISOString();

      await service.checkLimits(
        GenericEntity,
        {
          _ownerUsers: ['user1', 'user2'],
          _validFromDateTime: validFromDateTime,
          _validUntilDateTime: null,
        },
        mockRepository as DefaultCrudRepository<any, any, any>,
      );

      // Small delay to prevent race condition with filter capture
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(capturedFilter).to.Object();
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
  });
});
