# @transactional() Quick Reference Card

## ⚠️ MongoDB Topology Requirements

**Transactions require Replica Set or Sharded Cluster**

| Topology | Transactions | Behavior |
|----------|--------------|----------|
| Standalone | ❌ NOT SUPPORTED | Logs warning, proceeds without transaction |
| Replica Set | ✅ SUPPORTED | Full ACID transaction support |
| Sharded Cluster | ✅ SUPPORTED | Distributed transaction support |

**Local Development**: Standalone MongoDB works (with warning, no transactions)  
**Production**: Use Replica Set or Sharded Cluster for full transaction support

---

## Quick Import

```typescript
import { transactional } from '../decorators';
import { inject } from '@loopback/core';
import { Options } from '@loopback/repository';
```

## Controller-Level Usage (Recommended)

```typescript
// In controllers, use @inject to receive transaction options
@transactional()
@post('/entities')
async create(
  @requestBody() data: DataObject<E>,
  @inject('active.transaction.options', { optional: true }) options: Options = {},
): Promise<E> {
  const entity = await this.entityRepo.create(data, options);
  await this.relationRepo.create(relData, options);
  return entity;
}
```

## Repository-Level Usage

```typescript
@transactional()
async create(data: DataObject<E>, options?: Options): Promise<E> {
  const entity = await this.entityRepo.create(data, options);
  await this.relationRepo.create(relData, options);
  return entity;
}

## ✅ DO's

✅ **Inject transaction options in controllers**
```typescript
@inject('active.transaction.options', { optional: true }) options: Options = {}
```

✅ **Always pass options parameter through**
```typescript
await this.repo.create(data, options);  // ✓ Session propagates
```

✅ **Use for multi-entity operations**
```typescript
@transactional()
async createWithRelation(data, options?) {
  const entity = await this.entityRepo.create(data, options);
  await this.relationRepo.create({entityId: entity._id}, options);
  return entity;
}
```

✅ **Trust automatic rollback**
```typescript
@transactional()
async create(data, options?) {
  // No try/catch needed
  await this.stepOne(data, options);
  await this.stepTwo(data, options);  // If fails, stepOne rolls back
}
```

✅ **Pass options to services too**
```typescript
await this.lookupService.checkConstraints(data, options);
await this.limitChecker.checkLimits(data, options);
```

## ❌ DON'Ts

❌ **Don't forget the `optional: true` in inject**
```typescript
// ✗ Will fail when no transaction context exists
@inject('active.transaction.options') options: Options

// ✓ Works with or without transaction
@inject('active.transaction.options', { optional: true }) options: Options = {}
```

❌ **Don't omit options parameter**
```typescript
await this.repo.create(data);  // ✗ Session lost, not in transaction
```

❌ **Don't create new empty options**
```typescript
await this.repo.create(data, {});  // ✗ Session lost
```

❌ **Don't use for read-only operations**
```typescript
// ✗ Unnecessary overhead
@transactional()
async find(filter) {
  return this.repo.find(filter);
}

// ✓ No decorator needed
async find(filter) {
  return this.repo.find(filter);
}
```

## Transaction Flow

```
@transactional()
├─ Interceptor detects decorator
├─ Checks for existing session
│  ├─ YES → Join existing transaction
│  └─ NO  → Start new transaction
├─ Execute method body
│  └─ Pass options to nested calls
├─ On success → commit
├─ On error   → rollback
└─ Always     → end session
```

## Nested Calls

```typescript
// Outer call starts transaction
@transactional()
async outerMethod(data, options?) {
  // Inner call joins same transaction
  await this.innerMethod(data, options);
}

// Inner method reuses parent session
@transactional()
async innerMethod(data, options?) {
  await this.repo.create(data, options);
}

// Result: All operations in ONE transaction
```

## Error Handling

Automatic rollback on any error:

```typescript
@transactional()
async create(data, options?) {
  await this.step1(data, options);  // Success
  await this.step2(data, options);  // Success
  await this.step3(data, options);  // Throws error
  // step1 and step2 are ROLLED BACK
}
```

Manual error handling (if needed):

```typescript
@transactional()
async create(data, options?) {
  try {
    await this.repo.create(data, options);
  } catch (error) {
    // Transaction already rolled back
    // Log error or re-throw
    throw error;
  }
}
```

## When to Use @transactional()

### ✓ USE for:
- Creating multiple related entities
- Update + Create operations together
- Delete + Create operations together  
- Any multi-step write operation that must be atomic

### ✗ DON'T USE for:
- Single entity operations
- Read-only queries (find, count)
- Operations that don't modify data

## Common Patterns

### Pattern 0: Controller with Transaction Injection

```typescript
@transactional()
@post('/entities')
async create(
  @requestBody() data: Omit<GenericEntity, '_id'>,
  @inject('active.transaction.options', { optional: true }) options: Options = {},
): Promise<GenericEntity> {
  // Options contains session from TransactionalInterceptor
  return this.entityRepository.create(data, options);
}

@transactional()
@patch('/entities')
async updateAll(
  @requestBody() data: DataObject<GenericEntity>,
  @param.where(GenericEntity) where?: Where<GenericEntity>,
  @inject('active.transaction.options', { optional: true }) options: Options = {},
): Promise<Count> {
  return this.entityRepository.updateAll(data, where, options);
}
```

### Pattern 1: Entity + Relation

```typescript
@transactional()
async createEntityWithRelation(entityData, listId, options?) {
  const entity = await this.entityRepo.create(entityData, options);
  await this.relationRepo.create({
    _entityId: entity._id,
    _listId: listId,
  }, options);
  return entity;
}
```

### Pattern 2: Update + Log

```typescript
@transactional()
async updateWithAudit(id, data, options?) {
  const updated = await this.repo.updateById(id, data, options);
  await this.auditRepo.create({
    action: 'UPDATE',
    entityId: id,
    timestamp: new Date(),
  }, options);
  return updated;
}
```

### Pattern 3: Delete + Cleanup

```typescript
@transactional()
async deleteWithRelations(id, options?) {
  await this.relationRepo.deleteAll({_entityId: id}, options);
  await this.entityRepo.deleteById(id, options);
}
```

## Troubleshooting

### Issue: "DataSource not found on target"

**Cause**: @transactional() used on non-repository class

**Fix**: Only use on repository classes that have `dataSource` property

### Issue: Nested operation not in transaction

**Cause**: Forgot to pass `options` parameter

**Fix**: Always pass `options` to nested repository calls

```typescript
// ✗ WRONG
await this.repo.create(data);

// ✓ CORRECT
await this.repo.create(data, options);
```

### Issue: Transaction not rolling back

**Cause**: MongoDB not configured for transactions (requires replica set)

**Fix**: Ensure MongoDB is running as replica set

## Best Practices

1. **Keep transactions short**: Only wrap necessary operations
2. **Pass options everywhere**: Enable propagation
3. **Let interceptor handle cleanup**: No manual session management
4. **Test rollback scenarios**: Ensure ACID compliance
5. **Document transactional methods**: Help other developers understand

## Example: Full Implementation

```typescript
import { inject } from '@loopback/context';
import { DataObject, Getter, Options, repository } from '@loopback/repository';
import { transactional } from '../../decorators';
import { EntityPersistenceBaseRepository } from '../base';
import { EntityDbDataSource } from '../../datasources';
import { Entity, Relation } from '../../models';
import { EntityRepository } from '../core/entity.repository';
import { RelationRepository } from '../core/relation.repository';

export class CustomEntityThroughListRepository 
  extends EntityPersistenceBaseRepository<Entity, string> {
  
  protected readonly recordTypeName = 'entity';
  protected sourceListId: string;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,
    @repository.getter('EntityRepository')
    protected entityRepositoryGetter: Getter<EntityRepository>,
    @repository.getter('RelationRepository')
    protected relationRepositoryGetter: Getter<RelationRepository>,
  ) {
    super(Entity, dataSource);
  }

  @transactional()
  async create(
    data: DataObject<Entity>,
    options?: Options,
  ): Promise<Entity> {
    const entitiesRepo = await this.entityRepositoryGetter();
    const relationRepo = await this.relationRepositoryGetter();

    // Step 1: Create entity
    const entity = await entitiesRepo.create(data, options);

    // Step 2: Create relation
    await relationRepo.create({
      _entityId: entity._id,
      _listId: this.sourceListId,
    }, options);

    // Both succeed or both rollback
    return entity;
  }

  @transactional()
  async deleteById(id: string, options?: Options): Promise<void> {
    const relationRepo = await this.relationRepositoryGetter();
    const entitiesRepo = await this.entityRepositoryGetter();

    // Step 1: Delete relations first
    await relationRepo.deleteAll({_entityId: id}, options);

    // Step 2: Delete entity
    await entitiesRepo.deleteById(id, options);

    // Both succeed or both rollback
  }
}
```

---

## More Information

- **Full documentation**: `TRANSACTION_IMPLEMENTATION.md`
- **Design rationale**: `REASONING_LOG.md`
- **Source code**: 
  - `src/interceptors/transactional.interceptor.ts`
  - `src/decorators/transactional.decorator.ts`
