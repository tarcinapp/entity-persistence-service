# REASONING LOG: @transactional() Interceptor Implementation

## Executive Summary

This document explains the **reasoning** behind how the `@transactional()` interceptor handles MongoDB transactions and ensures proper session propagation across nested repository calls.

---

## Core Problem

### Challenge 1: No Built-in Declarative Transactions in LoopBack 4

LoopBack 4's `DefaultTransactionalRepository` provides **imperative** transaction methods:

```typescript
// Manual approach (old pattern)
const transaction = await repo.beginTransaction();
try {
  await repo.create(data, { transaction });
  await repo.create(data2, { transaction });
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
}
```

**Problems**:
- Boilerplate code in every multi-step operation
- Error-prone rollback logic
- No automatic session propagation
- Tight coupling between coordinator and transaction management

### Challenge 2: Session Propagation Through Nested Calls

When repository A calls repository B (both operations in a transaction):

```
A.create(data)
  └─> B.create(relData)
      └─> MongoDB operation
```

How does B know it's in a transaction started by A?

**Answer**: Through the `options.session` parameter passed down the call chain.

---

## Solution Architecture

### Component 1: Global Interceptor

```typescript
@globalInterceptor('transactional')
export class TransactionalInterceptor {
  intercept(invocationCtx, next) {
    // 1. Check if method is @transactional()
    // 2. Find/create options parameter
    // 3. Check for existing session
    // 4. If no session: start transaction
    // 5. Execute method with session
    // 6. Commit/Rollback on complete
    // 7. Always end session
  }
}
```

**Why Global?**: 
- Applied to ALL methods automatically
- No manual configuration per repository
- Checks decorator at runtime (fast path for non-transactional methods)

### Component 2: Method Decorator

```typescript
export function transactional() {
  return function(target, propertyKey, descriptor) {
    // Store metadata flag on method
    Object.defineProperty(descriptor.value, TRANSACTIONAL_KEY, {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    return descriptor;
  };
}
```

**Why Metadata?**:
- Zero runtime overhead for non-decorated methods
- Fast detection: single hasOwnProperty check
- No reflection/scanning needed
- Works with ANY method signature

---

## How Session Propagation Works

### Key Insight: Options Parameter as Context Carrier

Repository methods follow this signature pattern:

```typescript
async create(data: DataObject<E>, options?: Options): Promise<E>
async find(filter?: Filter<E>, options?: Options): Promise<E[]>
async updateById(id: Id, data: DataObject<E>, options?: Options): Promise<void>
```

The `options` parameter is designed to carry execution context through nested calls.

### Step-by-Step Flow

#### Step 1: Method Invocation Detection

```
Caller: customRepo.create(data)
                        ↓
Interceptor receives InvocationContext {
  target: CustomEntityThroughListRepository instance
  methodName: 'create'
  args: [DataObject<GenericEntity>]  // No options yet!
}
```

#### Step 2: Options Parameter Handling

The interceptor must handle three cases:

```typescript
// Case 1: Options provided
create(data, { notifyRecipients: true })
args[1] = options object

// Case 2: No options provided
create(data)
args.length = 1
// Must create and push options

// Case 3: Options is not last parameter (rare)
find(filter, options?, nestedObject)
// Must identify options specifically
```

**Solution**: Scan backwards from args.length, identify options by type:

```typescript
for (let i = args.length - 1; i >= 0; i--) {
  const arg = args[i];
  // Check if this looks like Options:
  // - typeof object
  // - not array, date, or class instance
  // - has known option properties
  if (isOptions(arg)) {
    options = arg;
    optionsIndex = i;
    break;
  }
}
```

#### Step 3: Session Detection (Critical for Propagation)

```typescript
const existingSession = (options as any)?.session;

if (existingSession) {
  // We're in a nested call within a transaction!
  // Don't create new transaction, join existing
  return next();  // Execute with existing session
}
```

**Why This Matters**:

```
Scenario A: Top-level call
customRepo.create(data)
  → options.session doesn't exist
  → Create new transaction
  → Inject session into options

Scenario B: Nested call (already in transaction)
customRepo.create(data)  // options = { session: S1 }
  → entityRepo.create(data, options)
    → Check: options.session exists
    → Return immediately (don't create new transaction)
    → EntityRepo continues with S1
```

#### Step 4: Transaction Lifecycle

```typescript
private async executeWithTransaction(
  invocationCtx, next, args, optionsIndex, options
) {
  let session = null;
  try {
    // [1] Get dataSource
    const dataSource = invocationCtx.target.dataSource;
    
    // [2] Get MongoDB client
    const mongoConnector = dataSource.connector;
    const client = mongoConnector.client;
    
    // [3] Create session
    session = client.startSession();
    
    // [4] Begin transaction
    session.startTransaction();
    
    // [5] Inject session
    (options as any).session = session;
    args[optionsIndex] = options;
    
    // [6] Execute method
    try {
      const result = await next();
      
      // [7] Commit on success
      await session.commitTransaction();
      
      return result;
    } catch (error) {
      // [8] Rollback on error
      await session.abortTransaction();
      throw error;  // Re-throw for caller
    }
  } finally {
    // [9] ALWAYS end session
    if (session) {
      await session.endSession();
    }
  }
}
```

---

## Transaction Propagation Examples

### Example 1: Simple Transaction

```typescript
// Usage:
const entity = await customRepo.create(entityData);

// Execution flow:
customRepo.create(entityData)
  ↓
[Interceptor] Check @transactional() → YES
[Interceptor] Check options.session → NO
[Interceptor] Start transaction S1
[Interceptor] Inject session into options
[Interceptor] Call next()
  ↓
CustomEntityThroughListRepository.create(entityData, {session: S1})
  ↓
  const entity = await entityRepo.create(entityData, {session: S1})
    ↓ (Entity operations in transaction S1)
  ↓
  await relationRepo.create(relData, {session: S1})
    ↓ (Relation operations in transaction S1)
  ↓
[Interceptor] Commit S1
[Interceptor] End S1
```

**Result**: Entity and Relation both created atomically, or both rolled back.

### Example 2: Nested Transactional Calls

```typescript
// If entityRepo.create() was also @transactional()

customRepo.create(data, {})
  ↓
[Interceptor A] Start transaction S1, options.session = S1
  ↓
  entityRepo.create(data, {session: S1})
    ↓
    [Interceptor B] Check options.session → S1 exists
    [Interceptor B] return next() → SKIP transaction creation
    ↓
    EntityRepository.create(data, {session: S1})
      ↓ (Uses S1, no new transaction)
  ↓
[Interceptor A] Commit S1 (happens after both repos complete)
```

**Key**: Only the outermost @transactional() creates a transaction. Nested ones join it.

### Example 3: Error Propagation

```typescript
customRepo.create(entityData)
  ↓
[Interceptor] Start transaction S1
  ↓
  const entity = await entityRepo.create(data, {session: S1})
    ↓ Created in S1
  ↓
  await relationRepo.create(relData, {session: S1})
    ↓ Throws error!
  ↓
[Interceptor] Catch error
[Interceptor] Call abortTransaction()
[Interceptor] End session
[Interceptor] Re-throw error
  ↓
Caller receives error
Database state: ENTITY AND RELATION BOTH MISSING (rolled back)
```

**Guarantee**: Neither entity nor relation exists. Database consistent.

---

## Why This Design?

### Advantage 1: Declarative API

**Before**:
```typescript
async create(data: DataObject<E>) {
  const transaction = await this.dataSource.beginTransaction();
  try {
    const entity = await this.entityRepo.create(data, {transaction});
    const relation = await this.relationRepo.create(relData, {transaction});
    await transaction.commit();
    return entity;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

**After**:
```typescript
@transactional()
async create(data: DataObject<E>, options?: Options) {
  const entity = await this.entityRepo.create(data, options);
  const relation = await this.relationRepo.create(relData, options);
  return entity;
}
```

### Advantage 2: Automatic Error Handling

No manual try/catch/finally needed. Interceptor handles:
- Transaction commit
- Transaction rollback
- Session cleanup (guaranteed by finally block)

### Advantage 3: Automatic Propagation

By passing `options` through nested calls, the session automatically propagates:
- No explicit session passing in signatures
- Works with existing repository interfaces
- Transparent to calling code

### Advantage 4: Composability

Transactional methods can call other transactional methods:

```typescript
@transactional()
async createEntity(data) { ... }

@transactional()
async createEntityWithRelation(data) {
  const entity = await this.createEntity(data);  // Joins transaction
  // ...
}
```

Both methods use same transaction automatically.

### Advantage 5: Performance

- Non-transactional methods: Zero overhead (single metadata check)
- Transactional methods: Only pay cost when needed
- Session reuse in nested calls: No redundant sessions

---

## Edge Cases Handled

### Edge Case 1: No Options Parameter Provided

```typescript
await repo.create(data)  // No options
```

**Handling**:
```typescript
if (optionsIndex === -1) {
  // Create options and push to args
  options = {};
  args.push(options);
  optionsIndex = args.length - 1;
}
```

Result: Method receives `create(data, {session: S1})`

### Edge Case 2: Method with Multiple Parameters

```typescript
await repo.find(filter, entityFilter, listFilter, options)
```

**Handling**:
```typescript
// Scan from end backward
// Correctly identifies options as last parameter
// Ignores filter parameters (they're Filter, not Options)
```

### Edge Case 3: Exception During Session Creation

```typescript
client.startSession() throws
```

**Handling**:
```typescript
catch (error) {
  throw new Error('DataSource not found on target...');
}
finally {
  if (session) {  // Only end if created
    await session.endSession();
  }
}
```

Caller sees the original error without session cleanup errors.

### Edge Case 4: Rollback Failure

```typescript
try {
  result = await next();
  await session.commitTransaction();  // Success
} catch (error) {
  await session.abortTransaction();  // This also might fail
  throw error;  // But we still throw the original error
}
finally {
  await session.endSession();  // End regardless
}
```

Original error is always re-thrown, cleanup always happens.

---

## ClientSession Lifecycle Deep Dive

### Correct Order

```
1. client.startSession()
   ↓ Creates session (may reuse from pool)
2. session.startTransaction()
   ↓ Begins transaction on session
3. /* operations */
   ↓ All using session context
4. session.commitTransaction() OR session.abortTransaction()
   ↓ Commits or rolls back
5. session.endSession()
   ↓ Returns session to pool (enables reuse)
```

### Why Order Matters

```
❌ WRONG: Commit before transaction started
  session.startSession()
  session.commitTransaction()  ← No transaction to commit!
  
✅ CORRECT:
  session.startSession()
  session.startTransaction()
  session.commitTransaction()
```

```
❌ WRONG: End session before committing
  session.endSession()
  session.commitTransaction()  ← Session already closed!
  
✅ CORRECT:
  session.commitTransaction()
  session.endSession()
```

### Finally Block Guarantee

```typescript
finally {
  if (session) {
    await session.endSession();  // Always called
  }
}
```

Even if commit/abort throws, endSession is called. This prevents:
- Connection leaks
- Session pool exhaustion
- Stalled transactions

---

## Integration with Repository Hierarchy

### Level 1: EntityPersistenceBaseRepository

```typescript
export abstract class EntityPersistenceBaseRepository<E, IdType, Relations>
  extends DefaultTransactionalRepository<E, IdType, Relations> {
  // No changes needed
  // Still handles underlying MongoDB connector
  // Sessions work transparently
}
```

### Level 2: Core Repositories (Entity, List, Relations)

```typescript
export class EntityRepository extends EntityPersistenceBaseRepository<...> {
  async create(data: DataObject<E>, options?: Options) {
    // Receives options.session from caller
    // Passes to super.create()
    // DefaultTransactionalRepository uses session if present
  }
}
```

### Level 3: Custom Orchestration Repositories

```typescript
@globalInterceptor() // <- Detected here
export class CustomEntityThroughListRepository extends EntityPersistenceBaseRepository<...> {
  @transactional()  // <- Applied here
  async create(data, options?: Options) {
    // Interceptor injects session into options
    // Method executes with transaction context
    // All nested calls use same session
  }
}
```

---

## Conclusion

The `@transactional()` interceptor provides:

1. **Declarative syntax**: Simple decorator, complex behavior hidden
2. **Automatic propagation**: Session flows through nested calls
3. **Proper cleanup**: Session always ends, even on errors
4. **Error safety**: Automatic rollback on exceptions
5. **Composability**: Nested transactional methods work together
6. **Performance**: Zero cost for non-transactional methods

The implementation respects LoopBack 4 patterns, maintains the three-tier repository hierarchy, and provides strong ACID guarantees for MongoDB transactions.
