import { repository } from '@loopback/repository';
import { get, ResponseObject } from '@loopback/rest';
import {
  SystemInfoRepository,
  SystemInfo,
} from '../repositories/core/system-info.repository';

/**
 * OpenAPI response schema for system info endpoint
 */
const SYSTEM_INFO_RESPONSE: ResponseObject = {
  description: 'System Info Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'SystemInfoResponse',
        properties: {
          uptime: {
            type: 'object',
            properties: {
              seconds: { type: 'number', description: 'Uptime in seconds' },
              formatted: {
                type: 'string',
                description: 'Human-readable uptime',
              },
            },
          },
          startedAt: {
            type: 'string',
            format: 'date-time',
            description: 'ISO timestamp when the application started',
          },
          currentTime: {
            type: 'string',
            format: 'date-time',
            description: 'Current server time as ISO timestamp',
          },
          configuration: {
            type: 'object',
            description: 'All application configuration from environment variables',
            properties: {
              nodeEnv: { type: 'string' },
              logging: {
                type: 'object',
                properties: {
                  level: { type: 'string' },
                  format: { type: 'string' },
                  timestamp: { type: 'string' },
                  service: { type: 'string' },
                  requestIdHeader: { type: 'string' },
                },
              },
              server: {
                type: 'object',
                properties: {
                  host: { type: 'string' },
                  port: { type: 'number' },
                },
              },
              database: {
                type: 'object',
                properties: {
                  url: { type: 'string', description: 'Masked MongoDB URL' },
                  database: { type: 'string' },
                  host: { type: 'string' },
                  port: { type: 'string' },
                  user: { type: 'string' },
                },
              },
              collections: {
                type: 'object',
                properties: {
                  entity: { type: 'string' },
                  list: { type: 'string' },
                  entityReactions: { type: 'string' },
                  listReactions: { type: 'string' },
                  listEntityRel: { type: 'string' },
                },
              },
              lookupConstraints: {
                type: 'object',
                properties: {
                  entity: { type: 'string' },
                  list: { type: 'string' },
                  entityReaction: { type: 'string' },
                  listReaction: { type: 'string' },
                },
              },
              allowedKinds: {
                type: 'object',
                properties: {
                  entity: { type: 'array', items: { type: 'string' } },
                  list: { type: 'array', items: { type: 'string' } },
                  listEntityRel: { type: 'array', items: { type: 'string' } },
                  entityReaction: { type: 'array', items: { type: 'string' } },
                  listReaction: { type: 'array', items: { type: 'string' } },
                },
              },
              defaultKinds: {
                type: 'object',
                properties: {
                  entity: { type: 'string' },
                  list: { type: 'string' },
                  relation: { type: 'string' },
                  entityReaction: { type: 'string' },
                  listReaction: { type: 'string' },
                },
              },
              uniqueness: {
                type: 'object',
                properties: {
                  entity: { type: 'string' },
                  list: { type: 'string' },
                  relation: { type: 'string' },
                  entityReaction: { type: 'string' },
                  listReaction: { type: 'string' },
                },
              },
              autoApprove: {
                type: 'object',
                properties: {
                  entity: { type: 'boolean' },
                  list: { type: 'boolean' },
                  entityReaction: { type: 'boolean' },
                  listReaction: { type: 'boolean' },
                  listEntityRelations: { type: 'boolean' },
                },
              },
              visibility: {
                type: 'object',
                properties: {
                  entity: { type: 'string' },
                  list: { type: 'string' },
                  entityReaction: { type: 'string' },
                  listReaction: { type: 'string' },
                },
              },
              responseLimits: {
                type: 'object',
                properties: {
                  entity: { type: 'number' },
                  list: { type: 'number' },
                  listEntityRel: { type: 'number' },
                  entityReaction: { type: 'number' },
                  listReaction: { type: 'number' },
                },
              },
              recordLimits: {
                type: 'object',
                properties: {
                  entity: { type: 'string' },
                  list: { type: 'string' },
                  relation: { type: 'string' },
                  entityReaction: { type: 'string' },
                  listReaction: { type: 'string' },
                },
              },
              idempotency: {
                type: 'object',
                properties: {
                  entity: { type: 'string' },
                  list: { type: 'string' },
                  entityReaction: { type: 'string' },
                  listReaction: { type: 'string' },
                  listEntityRel: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
};

/**
 * SystemInfoController - Provides system information and configuration endpoint.
 *
 * This controller exposes an endpoint that returns:
 * - System uptime (in seconds and human-readable format)
 * - Application start time
 * - Current server time
 * - All environment-based configuration settings
 *
 * Sensitive information like database passwords are masked or excluded.
 */
export class SystemInfoController {
  constructor(
    @repository(SystemInfoRepository)
    public systemInfoRepository: SystemInfoRepository,
  ) {}

  /**
   * Get system information including uptime and all configuration.
   *
   * @returns System info with uptime and configuration
   */
  @get('/system-info', {
    responses: {
      '200': SYSTEM_INFO_RESPONSE,
    },
    tags: ['SystemInfoController'],
    summary: 'Get system uptime and configuration',
    description:
      'Returns system uptime, application start time, current server time, and all environment-based configuration settings. Sensitive values like database passwords are masked.',
  })
  async getSystemInfo(): Promise<SystemInfo> {
    return this.systemInfoRepository.getSystemInfo();
  }
}
