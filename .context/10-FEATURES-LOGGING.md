# Logging Architecture

This document describes the logging approach, architecture, and configuration used in the entity-persistence-service.

## Overview

The service uses **Winston** as the logging library with a structured logging approach that provides comprehensive request/response tracing, error logging, and application event logging. Logs include contextual information such as timestamps, service name, environment details, and **request IDs automatically included in all logs** through request-scoped context.

## Architecture Components

### 1. Logging Configuration ([`src/config/logging.config.ts`](../src/config/logging.config.ts))

Central configuration for the Winston logger instance:

- **Logger Instance Creation**: Creates Winston logger with configured transports and formats
- **Format Configuration**: Supports both JSON and text formats
- **Environment-based Defaults**: Different log levels for test vs. production environments

### 2. Request Context Provider ([`src/providers/request-context.provider.ts`](../src/providers/request-context.provider.ts))

Provides request-scoped context that makes request-specific data (like request ID) available throughout the entire request lifecycle, including repositories and services.

**Key Features:**
- Bound with `REQUEST` scope - new instance per request
- Automatically extracts request ID from Request object
- Available via dependency injection in any component

**Usage in repositories/services:**
```typescript
constructor(
  @inject('request.context', { optional: true })
  private requestContext?: RequestContext,
) {}
```

### 3. Logging Service ([`src/services/logging.service.ts`](../src/services/logging.service.ts))

Injectable service providing logging methods with automatic context enrichment:

```typescript
@injectable()
export class LoggingService {
  error(message: string, meta?: Record<string, unknown>, request?: Request)
  warn(message: string, meta?: Record<string, unknown>, request?: Request)
  info(message: string, meta?: Record<string, unknown>, request?: Request)
  debug(message: string, meta?: Record<string, unknown>, request?: Request)
  logRequest(context: RequestLogContext)
}
```

**Key Features:**
- **Automatic request ID inclusion from request-scoped context** - works in repositories and services
- Fallback to Request object if context not available (for backward compatibility)
- Timestamp injection
- Metadata enrichment with service and environment info
- Status-code-based log level selection for requests

**Request ID Resolution Priority:**
1. Request-scoped context (available everywhere during request lifecycle)
2. Request object parameter (for explicit passing in controllers/middleware)

### 4. Request Logging Middleware ([`src/middleware/request-logging.middleware.ts`](../src/middleware/request-logging.middleware.ts))

Middleware that wraps every HTTP request to provide automatic logging:

**Request Phase:**
- Logs incoming request at `debug` level
- Captures: method, URL, query parameters, headers
- Includes request ID for correlation

**Response Phase:**
- Logs successful responses at `debug` level
- Captures: status code, response time (ms), record count (for arrays)
- Includes request ID for correlation

**Error Phase:**
- Logs failed requests at `error` level
- Captures: status code, response time, full error details
- **Includes stack trace** in log metadata
- Includes request ID for correlation

### 5. Request ID Middleware ([`src/middleware/request-id.middleware.ts`](../src/middleware/request-id.middleware.ts))

Generates and attaches a unique request ID to every incoming request. This ID flows through:
- **All log entries** for that request (via request-scoped context)
- **Error responses** (always included in HTTP responses)
- **Downstream service calls** (if the service makes outbound HTTP calls to other services, the request ID can be propagated via headers - currently not implemented but the infrastructure supports it)

### 6. Sequence Handler ([`src/sequence.ts`](../src/sequence.ts))

Orchestrates the request processing pipeline and performs error normalization:

**Error Normalization:**
- `ENTITY_NOT_FOUND` → 404 status code
- `VALIDATION_FAILED` → `VALIDATION-FAILED` (hyphenated)
- `INVALID_INCLUSION_FILTER` → `INVALID-INCLUSION-FILTER`
- `INVALID_PARAMETER_VALUE` → `MALFORMED-QUERY-FILTER`
- `OPERATOR_NOT_ALLOWED_IN_QUERY` → `MALFORMED-QUERY-FILTER`
- Generic query/filter errors → `MALFORMED-QUERY-FILTER`

**Error Sanitization:**
- Internal errors (5xx) are sanitized before being sent to clients
- Full error details (including stack traces) are logged
- Clients receive generic error message: "An internal error occurred."
- Request ID is preserved in sanitized response

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` (production), `error` (test) |
| `LOG_FORMAT` | Output format (`json` or `text`) | `json` |
| `LOG_TIMESTAMP` | Include timestamps (`true` or `false`) | `false` |
| `LOG_SERVICE` | Service name in logs | `entity-persistence-service` |
| `LOG_REQUEST_BODY` | Include request body in logs (`true` or `false`) | `false` |
| `NODE_ENV` | Environment name | `development` |

### Log Levels

The service uses standard Winston log levels:

1. **`error`**: Server errors (5xx status codes), exceptions, critical failures
2. **`warn`**: Client errors (4xx status codes), validation failures
3. **`info`**: Repository operations, business logic events, successful operations
4. **`debug`**: **Request/response tracing**, detailed information, headers, query params, and optionally request body

**Default Log Levels by Environment:**
- **Production**: `info` - Shows repository operations and errors, but NOT request/response traces
- **Development**: `debug` - Shows everything including request/response traces
- **Test**: `error` - Shows only errors

**To see request/response logs in production**, explicitly set: `LOG_LEVEL=debug`

**Request Body Logging:**
- Request bodies are NOT logged by default for security and performance reasons
- To enable: Set `LOG_REQUEST_BODY=true` (requires `LOG_LEVEL=debug`)
- ⚠️ **WARNING**: Request bodies may contain sensitive data (passwords, tokens, PII)
- Only enable in development/debugging scenarios, never in production

### Log Formats

#### JSON Format (Default)
```json
{
  "level": "info",
  "message": "Request completed GET /api/entities 200 45ms",
  "timestamp": "2026-06-17T07:20:00.000Z",
  "requestId": "req-abc123",
  "method": "GET",
  "url": "/api/entities",
  "statusCode": 200,
  "responseTime": 45,
  "service": "entity-persistence-service",
  "environment": "production"
}
```

#### Text Format
```
2026-06-17T07:20:00.000Z info: [req-abc123] Request completed GET /api/entities 200 45ms
```

### Log Examples by Type

#### 1. Incoming Request - GET (debug level)
```json
{
  "level": "debug",
  "message": "Incoming request GET /api/entities",
  "timestamp": "2026-06-17T10:00:00.123Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "url": "/api/entities",
  "query": {"limit": "10", "filter": "{\"where\":{\"_kind\":\"task\"}}"},
  "headers": {
    "host": "localhost:3000",
    "user-agent": "Mozilla/5.0...",
    "accept": "application/json",
    "content-type": "application/json"
  },
  "service": "entity-persistence-service",
  "environment": "development"
}
```

#### 1b. Incoming Request - POST without body (debug level, default)
```json
{
  "level": "debug",
  "message": "Incoming request POST /api/entities",
  "timestamp": "2026-06-17T10:00:00.123Z",
  "requestId": "990e8400-e29b-41d4-a716-446655440009",
  "method": "POST",
  "url": "/api/entities",
  "query": {},
  "headers": {
    "host": "localhost:3000",
    "user-agent": "Mozilla/5.0...",
    "accept": "application/json",
    "content-type": "application/json",
    "content-length": "156"
  },
  "service": "entity-persistence-service",
  "environment": "development"
}
```

#### 1c. Incoming Request - POST with body (debug level, LOG_REQUEST_BODY=true)
```json
{
  "level": "debug",
  "message": "Incoming request POST /api/entities",
  "timestamp": "2026-06-17T10:00:00.123Z",
  "requestId": "990e8400-e29b-41d4-a716-446655440009",
  "method": "POST",
  "url": "/api/entities",
  "query": {},
  "headers": {
    "host": "localhost:3000",
    "user-agent": "Mozilla/5.0...",
    "accept": "application/json",
    "content-type": "application/json",
    "content-length": "156"
  },
  "body": {
    "_kind": "task",
    "name": "Complete documentation",
    "description": "Update logging documentation",
    "_visibility": "private"
  },
  "service": "entity-persistence-service",
  "environment": "development"
}
```
**⚠️ Security Warning**: Request body logging is disabled by default. Only enable with `LOG_REQUEST_BODY=true` in development/debugging. Never enable in production as bodies may contain sensitive data (passwords, tokens, PII).

#### 2. Successful Response (debug level)
```json
{
  "level": "debug",
  "message": "Request completed GET /api/entities 200 45ms",
  "timestamp": "2026-06-17T10:00:00.168Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "url": "/api/entities",
  "statusCode": 200,
  "responseTime": 45,
  "recordCount": 5,
  "service": "entity-persistence-service",
  "environment": "development"
}
```

#### 3. Repository Operation (info level)
```json
{
  "level": "info",
  "message": "EntityRepository.find - Modified filter:",
  "timestamp": "2026-06-17T10:00:00.145Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "filter": {
    "where": {"_kind": "task"},
    "limit": 10
  },
  "service": "entity-persistence-service",
  "environment": "development"
}
```

#### 4. Client Error - 4xx (warn level)
```json
{
  "level": "warn",
  "message": "Request failed GET /api/entities/invalid-id 404 12ms",
  "timestamp": "2026-06-17T10:00:01.234Z",
  "requestId": "660e8400-e29b-41d4-a716-446655440001",
  "method": "GET",
  "url": "/api/entities/invalid-id",
  "statusCode": 404,
  "responseTime": 12,
  "error": {
    "name": "EntityNotFoundError",
    "message": "Entity with id 'invalid-id' not found",
    "stack": "EntityNotFoundError: Entity with id 'invalid-id' not found\n    at EntityRepository.findById..."
  },
  "service": "entity-persistence-service",
  "environment": "development"
}
```

#### 5. Server Error - 5xx (error level)
```json
{
  "level": "error",
  "message": "Request failed POST /api/entities 500 89ms",
  "timestamp": "2026-06-17T10:00:02.456Z",
  "requestId": "770e8400-e29b-41d4-a716-446655440002",
  "method": "POST",
  "url": "/api/entities",
  "statusCode": 500,
  "responseTime": 89,
  "error": {
    "name": "MongoError",
    "message": "Connection timeout",
    "stack": "MongoError: Connection timeout\n    at Connection.onTimeout..."
  },
  "service": "entity-persistence-service",
  "environment": "production"
}
```

**Note**: In production, the client receives a sanitized error response without the stack trace:
```json
{
  "statusCode": 500,
  "name": "InternalServerError",
  "message": "An internal error occurred.",
  "code": "INTERNAL-SERVER-ERROR",
  "requestId": "770e8400-e29b-41d4-a716-446655440002"
}
```

#### 6. Business Logic Event (info level)
```json
{
  "level": "info",
  "message": "Entity created successfully",
  "timestamp": "2026-06-17T10:00:03.789Z",
  "requestId": "880e8400-e29b-41d4-a716-446655440003",
  "entityId": "507f1f77bcf86cd799439011",
  "entityType": "task",
  "service": "entity-persistence-service",
  "environment": "production"
}
```

#### 7. Configuration Warning (warn level, no request ID)
```json
{
  "level": "warn",
  "message": "Failed to parse ENTITY_LOOKUP_CONSTRAINT environment variable",
  "timestamp": "2026-06-17T10:00:04.123Z",
  "error": {
    "name": "SyntaxError",
    "message": "Unexpected token in JSON at position 15"
  },
  "service": "entity-persistence-service",
  "environment": "production"
}
```
**Note**: No `requestId` field because this log is from application startup/configuration, not an HTTP request.

#### 8. Debug Log with Details (debug level)
```json
{
  "level": "debug",
  "message": "RecordLimitCheckerService.count - about to count records",
  "timestamp": "2026-06-17T10:00:00.150Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "scope": "user:123:entities",
  "filter": {
    "where": {
      "_createdBy": "123",
      "_kind": "task"
    }
  },
  "service": "entity-persistence-service",
  "environment": "development"
}
```

## What Gets Logged

### 1. Request Tracing (Middleware Level)

**Request/response logging is implemented but only visible at `debug` log level.**

The request logging middleware ([`src/middleware/request-logging.middleware.ts`](../src/middleware/request-logging.middleware.ts)) logs:

**Incoming requests** at `debug` level:
- HTTP method
- URL path
- Query parameters
- Request headers
- **Request ID** (always present in middleware)

**Responses** at `debug` level:
- HTTP method
- URL path
- Status code
- Response time (milliseconds)
- Record count (for array responses)
- **Request ID** (always present in middleware)

**⚠️ Important**: These logs are **NOT visible** unless `LOG_LEVEL=debug` is set. By default:
- Production: `LOG_LEVEL=info` (request/response logs hidden)
- Development: `LOG_LEVEL=debug` (request/response logs visible)
- Test: `LOG_LEVEL=error` (request/response logs hidden)

To see request/response logs, set environment variable: `LOG_LEVEL=debug`

### 2. Error Logging (Middleware Level)

**All errors** are logged at `error` level with:
- HTTP method
- URL path
- Status code (derived from error)
- Response time
- Error name
- Error message
- **Full stack trace** (in metadata)
- **Request ID** (always present in middleware)

### 3. Application Events (Repository/Service Level)

Application code can use the `LoggingService` to log business logic events. **Request IDs are automatically included** via request-scoped context:

```typescript
// Example in a controller
this.loggingService.info('Entity created successfully', {
  entityId: entity.id,
  entityType: entity.type
});  // ✅ Request ID automatically included from context

// Example in a repository
this.loggingService.info('EntityRepository.find - Modified filter:', {
  filter: modifiedFilter
});  // ✅ Request ID automatically included from context
```

**Request ID Availability:**
- ✅ **All components**: Request ID automatically included via request-scoped context
- ✅ **Controllers**: Can optionally pass Request object for backward compatibility
- ✅ **Middleware**: Request ID available from context
- ✅ **Repositories**: Request ID automatically included from context
- ✅ **Services**: Request ID automatically included from context

## Security Considerations

### Stack Trace Protection

- **Logged**: Full stack traces are logged for all errors for debugging purposes
- **Not Exposed**: Stack traces are **never** sent to clients in error responses
- **Sanitization**: Internal errors (5xx) are replaced with generic messages before client response

### Sensitive Data

- Request headers are logged at `debug` level
- Ensure sensitive headers (Authorization, API keys) are not logged in production by setting `LOG_LEVEL=info` or higher
- Query parameters are logged - avoid passing sensitive data in URLs

## Request Flow Example

```
1. Request arrives → Request ID Middleware assigns unique ID and stores in Request object
2. Request Context Provider makes request ID available in request scope
3. Request Logging Middleware logs incoming request (debug) with request ID
4. Application processes request:
   - Controllers, repositories, services all have access to request ID via context
   - All logs automatically include request ID
5. On success:
   - Request Logging Middleware logs response (debug) with request ID
6. On error:
   - Request Logging Middleware logs error with stack trace (error) and request ID
   - Sequence Handler normalizes error code
   - Sequence Handler sanitizes 5xx errors
   - Client receives sanitized error (no stack trace) with request ID
```

## Log Correlation

**All logs within a request lifecycle** share the same `requestId`, enabling:
- Tracing a request through the entire HTTP request/response lifecycle
- Correlating errors with their originating requests
- Debugging issues by filtering logs by request ID
- Monitoring request performance and patterns
- Following the execution flow from controller → repository → service

**Request ID Propagation:**
- Request ID is set by Request ID Middleware
- Made available via request-scoped context (RequestContextProvider)
- Automatically included in all logs by LoggingService
- Works in controllers, repositories, services, and middleware
- **Always included in error responses** during HTTP request processing

**Note**: Request IDs are only unavailable for operations outside HTTP request context (e.g., background jobs, migrations, startup tasks).

## Best Practices

1. **Use appropriate log levels**:
   - `debug`: Detailed diagnostic information (request/response traces)
   - `info`: General informational messages (repository operations, business events)
   - `warn`: Warning messages for recoverable issues
   - `error`: Error messages for failures

2. **Include context**: Request IDs are automatically included - no need to pass Request object

3. **Structured metadata**: Use the `meta` parameter for structured data rather than string concatenation

4. **Production log level**:
   - Use `LOG_LEVEL=info` in production for normal operations (hides request/response traces)
   - Use `LOG_LEVEL=debug` only for troubleshooting (shows all request/response details)
   - Request/response middleware logs are at `debug` level and won't appear at `info` level

7. **Understanding what you see**: If you only see repository logs (like "EntityRepository.find - Modified filter"), it means:
   - Your log level is set to `info` or higher
   - Request/response traces are being logged but filtered out
   - Set `LOG_LEVEL=debug` to see the full request/response lifecycle

## Monitoring and Observability

The structured logging approach enables:
- **Log aggregation**: JSON format works well with log aggregation tools (ELK, Splunk, CloudWatch)
- **Request tracing**: Request IDs enable distributed tracing
- **Performance monitoring**: Response times logged for every request
- **Error tracking**: Full error details with stack traces for debugging
- **Audit trails**: Complete record of all API interactions

## Related Files

- [`src/config/logging.config.ts`](../src/config/logging.config.ts) - Logger configuration
- [`src/services/logging.service.ts`](../src/services/logging.service.ts) - Logging service with request-scoped context support
- [`src/providers/request-context.provider.ts`](../src/providers/request-context.provider.ts) - Request context provider
- [`src/types/logging.types.ts`](../src/types/logging.types.ts) - Type definitions
- [`src/middleware/request-logging.middleware.ts`](../src/middleware/request-logging.middleware.ts) - Request logging
- [`src/middleware/request-id.middleware.ts`](../src/middleware/request-id.middleware.ts) - Request ID generation
- [`src/sequence.ts`](../src/sequence.ts) - Request sequence and error handling
- [`src/application.ts`](../src/application.ts) - Application setup with request context binding
