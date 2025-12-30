# Error Payloads

Errors are returned under `error` following `HttpErrorResponse`. When a request ID is present (middleware adds one from the configured header or generates a UUID), it is included as `requestId` and echoed back in the same header.


## Common Shape

```json
{
  "error": {
    "statusCode": 422,
    "name": "UnprocessableEntityError",
    "message": "Human-readable description",
    "code": "ERROR-CODE",
    "details": [
      {
        "code": "ERROR-CODE",
        "message": "Specific cause",
        "info": {"context": "Optional structured info"}
      }
    ],
    "requestId": "8e1c4b4a-9d7f-4a6a-8f1f-df5e3c2a1b9c"
  }
}
```

Notes:
- `statusCode` matches the HTTP status.
- `details` may be omitted.
- `requestId` is present when the middleware captures a request id (header name defaults to `x-request-id` and is configurable via `REQUEST_ID_HEADER`).

## Examples

### Validation (422)
```json
{"error":{"statusCode":422,"name":"UnprocessableEntityError","message":"The request body is invalid. See error object `details` property for more info.","code":"VALIDATION-FAILED"}}
```

### Not Found (404)
```json
{"error":{"statusCode":404,"name":"NotFoundError","message":"Entity with id '123' could not be found.","code":"ENTITY-NOT-FOUND"}}
```

### Uniqueness (409)
```json
{"error":{"statusCode":409,"name":"UniquenessViolationError","message":"List already exists","code":"LIST-UNIQUENESS-VIOLATION","details":[{"code":"LIST-UNIQUENESS-VIOLATION","message":"List already exists","info":{"scope":"where[_kind]=bookshelf&where[_slug]=bir-wall-street-hikayesi"}}]}}
```

### Record Limits (429)
```json
{"error":{"statusCode":429,"name":"LimitExceededError","message":"Record limit exceeded for list","code":"LIST-LIMIT-EXCEEDED","details":[{"code":"LIST-LIMIT-EXCEEDED","message":"Record limit exceeded for list","info":{"limit":2,"scope":""}}]}}
```

### Immutable Fields (422)
```json
{"error":{"statusCode":422,"name":"ImmutableKindError","message":"Entity kind cannot be changed after creation.","code":"IMMUTABLE-ENTITY-KIND"}}
```

### Invalid Kind (422)
```json
{"error":{"statusCode":422,"name":"InvalidKindError","message":"List kind cannot contain special or uppercase characters. Use 'book-list' instead.","code":"INVALID-LIST-KIND"}}
```

### Lookup Constraints (422)
```json
{"error":{"statusCode":422,"name":"InvalidLookupConstraintError","message":"Invalid lookup target kind: journal","code":"ENTITY-INVALID-LOOKUP-KIND"}}
```

### Source Record Mismatch (422)
```json
{"error":{"statusCode":422,"name":"SourceRecordNotMatchError","message":"Source record _listId does not match parent. Parent _listId: 'list-1', child _listId: 'list-2'.","code":"SOURCE-RECORD-NOT-MATCH"}}
```

### Relation Requirements (400)
```json
{"error":{"statusCode":400,"name":"BadRequestError","message":"Entity id and list id are required.","code":"RELATION-MISSING-IDS"}}
```

## Quick Reference
- Not found: `ENTITY-NOT-FOUND`, `LIST-NOT-FOUND`, `RELATION-NOT-FOUND`, `ENTITY-REACTION-NOT-FOUND`, `LIST-REACTION-NOT-FOUND`
- Uniqueness: `ENTITY-UNIQUENESS-VIOLATION`, `LIST-UNIQUENESS-VIOLATION`, `RELATION-UNIQUENESS-VIOLATION`, `ENTITYREACTION-UNIQUENESS-VIOLATION`, `LISTREACTION-UNIQUENESS-VIOLATION`
- Limits: `ENTITY-LIMIT-EXCEEDED`, `LIST-LIMIT-EXCEEDED`, `RELATION-LIMIT-EXCEEDED`, `ENTITYREACTION-LIMIT-EXCEEDED`, `LISTREACTION-LIMIT-EXCEEDED`
- Immutable: `IMMUTABLE-ENTITY-KIND`, `IMMUTABLE-LIST-KIND`, `IMMUTABLE-RELATION-KIND`, `IMMUTABLE-ENTITY-REACTION-KIND`, `IMMUTABLE-LIST-REACTION-KIND`, `IMMUTABLE-ENTITY-ID`, `IMMUTABLE-LIST-ID`
- Kind invalid: `INVALID-ENTITY-KIND`, `INVALID-LIST-KIND`, `INVALID-RELATION-KIND`, `INVALID-ENTITY-REACTION-KIND`, `INVALID-LIST-REACTION-KIND`
- Lookup invalid: `*-INVALID-LOOKUP-REFERENCE`, `*-INVALID-LOOKUP-KIND`, `ENTITY-REACTION-INVALID-PARENT-ENTITY-ID`, `LIST-REACTION-INVALID-PARENT-LIST-ID`
- Other: `SOURCE-RECORD-NOT-MATCH`, `RELATION-MISSING-IDS`, `VALIDATION-FAILED`
