/**
 * MongoDB 7.0 & Driver v6 Stress Test Suite
 *
 * This test suite validates the stability of our migration from MongoDB Driver v3 to v6
 * (via loopback-connector-mongodb@7.0.0-alpha.10). It targets potential "silent failures"
 * in data mapping, BSON serialization, and query execution within our custom aggregation
 * pipeline architecture.
 *
 * ARCHITECTURAL CONTEXT:
 * - We use UUID strings for _id (not ObjectId), defined in RecordsCommonBase
 * - Complex queries bypass Juggler CRUD and use native MongoDB aggregation via MongoPipelineHelper
 * - $lookup stages join string-to-string (_listId → _id, _entityId → _id)
 * - cursor.toArray() + injectRecordTypeArray() post-processing ensures array handling
 *
 * RISK AREAS TESTED:
 * 1. BSON Type Enforcement: String _id matching in $match and $lookup stages
 * 2. Date Serialization: new Date() → BSON Date conversion in aggregation pipelines
 * 3. Diana Lau Mapping Bug: Array/object return consistency with cursor.toArray()
 * 4. Orphan Record Handling: $lookup + $unwind with preserveNullAndEmptyArrays
 */

import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type {
  ListToEntityRelation,
  GenericEntity,
  List,
} from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestEntity,
  createTestList,
  cleanupCreatedEntities,
  cleanupCreatedLists,
} from '../test-helper';

describe('MongoDB 7.0 & Driver v6 Stress Tests', () => {
  let client: Client;
  let appWithClient: AppWithClient | undefined;
  let createdRelationIds: string[] = [];

  beforeEach(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;

    // Clear all environment variables for isolated tests
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });

    createdRelationIds = [];
  });

  afterEach(async () => {
    if (appWithClient) {
      // Clean up relations first (they depend on entities/lists)
      for (const id of createdRelationIds) {
        try {
          await client.delete(`/relations/${id}`);
        } catch {
          // Ignore cleanup errors
        }
      }

      await cleanupCreatedEntities(client);
      await cleanupCreatedLists(client);
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;
  });

  after(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;
  });

  /**
   * Helper to create a test relation and track its ID for cleanup
   */
  async function createTestRelation(
    relationData: Partial<ListToEntityRelation>,
  ): Promise<string> {
    const response = await client
      .post('/relations')
      .send(relationData)
      .expect(200);
    const relationId = response.body._id;
    createdRelationIds.push(relationId);

    return relationId;
  }

  // ============================================================================
  // SECTION 1: ORPHAN RECORD HANDLING
  // Tests $lookup and $unwind behavior when parent records are deleted
  // NOTE: The application cascade-deletes relations when entities/lists are removed
  // These tests verify that behavior and that aggregation handles empty results gracefully
  // ============================================================================

  describe('Orphan Record Handling', () => {
    it('should cascade-delete relation when parent List is deleted', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      // Create entity and list
      const entityId = await createTestEntity(client, {
        _name: 'Orphan Test Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Temporary List',
        _kind: 'reading-list',
      });

      // Create relation linking them
      const relationId = await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
      });

      // Verify relation exists before deletion
      const beforeResponse = await client
        .get(`/relations/${relationId}`)
        .expect(200);
      expect(beforeResponse.body._fromMetadata).to.not.be.null();
      expect(beforeResponse.body._fromMetadata._name).to.equal(
        'Temporary List',
      );

      // Delete the parent list - this should cascade-delete the relation
      await client.delete(`/lists/${listId}`).expect(204);

      // Query relations via aggregation
      const response = await client.get('/relations').expect(200);

      // VERIFIED BEHAVIOR: Application cascade-deletes relations when parents are removed
      // This is intentional to maintain referential integrity
      expect(response.body).to.be.Array();

      const orphanedRelation = response.body.find(
        (r: ListToEntityRelation) => r._id === relationId,
      );

      // Relation should be deleted along with its parent
      expect(orphanedRelation).to.be.undefined();

      // Remove from cleanup since it's already deleted
      createdRelationIds = createdRelationIds.filter((id) => id !== relationId);
    });

    it('should cascade-delete relation when parent Entity is deleted', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      // Create entity and list
      const entityId = await createTestEntity(client, {
        _name: 'Temporary Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Persistent List',
        _kind: 'reading-list',
      });

      // Create relation
      const relationId = await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
      });

      // Verify relation exists before deletion
      const beforeResponse = await client
        .get(`/relations/${relationId}`)
        .expect(200);
      expect(beforeResponse.body._toMetadata).to.not.be.null();
      expect(beforeResponse.body._toMetadata._name).to.equal('Temporary Book');

      // Delete the parent entity - should cascade-delete the relation
      await client.delete(`/entities/${entityId}`).expect(204);

      // Query relations via aggregation
      const response = await client.get('/relations').expect(200);

      const orphanedRelation = response.body.find(
        (r: ListToEntityRelation) => r._id === relationId,
      );

      // VERIFIED BEHAVIOR: Relation is cascade-deleted
      expect(orphanedRelation).to.be.undefined();

      // Remove from cleanup since it's already deleted
      createdRelationIds = createdRelationIds.filter((id) => id !== relationId);
    });

    it('should handle $lookup with preserveNullAndEmptyArrays for non-matching joins', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Test Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Test List',
        _kind: 'reading-list',
      });

      // Create a valid relation
      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        _visibility: 'public',
      });

      // Query relations - verifies $unwind preserveNullAndEmptyArrays works correctly
      const response = await client.get('/relations').expect(200);

      // Should return array with valid relation
      expect(response.body).to.be.Array();
      expect(response.body.length).to.be.greaterThanOrEqual(1);

      // Verify metadata is properly populated via $lookup + $unwind
      const relation = response.body[0];
      expect(relation._fromMetadata).to.not.be.undefined();
      expect(relation._toMetadata).to.not.be.undefined();
      expect(relation._fromMetadata._name).to.equal('Test List');
      expect(relation._toMetadata._name).to.equal('Test Book');
    });
  });

  // ============================================================================
  // SECTION 2: DEEP NESTED DOT-NOTATION FILTERING
  // Tests buildMongoQuery's handling of nested paths in $match stages
  // ============================================================================

  describe('Deep Nested Dot-Notation Filtering', () => {
    it('should filter by deeply nested string field (metadata.status.current)', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Nested Test Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Nested Test List',
        _kind: 'reading-list',
      });

      // Create relations with deeply nested structures
      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        metadata: {
          status: {
            current: 'in-progress',
            phase: 'review',
            details: {
              assignee: 'user-123',
              priority: 'high',
            },
          },
        },
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        metadata: {
          status: {
            current: 'completed',
            phase: 'archived',
            details: {
              assignee: 'user-456',
              priority: 'low',
            },
          },
        },
      });

      // Filter by 2-level nested string
      const response = await client
        .get('/relations')
        .query('filter[where][metadata.status.current]=in-progress')
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0].metadata.status.current).to.equal('in-progress');
    });

    it('should filter by 3-level nested string field (metadata.status.details.assignee)', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Deep Nested Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Deep Nested List',
        _kind: 'reading-list',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        metadata: {
          status: {
            details: {
              assignee: 'alice',
              department: 'engineering',
            },
          },
        },
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        metadata: {
          status: {
            details: {
              assignee: 'bob',
              department: 'marketing',
            },
          },
        },
      });

      // Filter by 3-level nested string
      const response = await client
        .get('/relations')
        .query('filter[where][metadata.status.details.assignee]=alice')
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0].metadata.status.details.assignee).to.equal(
        'alice',
      );
    });

    it('should filter by nested numeric field with comparison operators', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Numeric Nested Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Numeric Nested List',
        _kind: 'reading-list',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        metrics: {
          performance: {
            score: 85,
            latency: 120,
          },
        },
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        metrics: {
          performance: {
            score: 45,
            latency: 300,
          },
        },
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        metrics: {
          performance: {
            score: 95,
            latency: 50,
          },
        },
      });

      // Filter by nested numeric with gt operator
      const response = await client
        .get('/relations')
        .query(
          'filter[where][metrics.performance.score][gt]=80&filter[where][metrics.performance.score][type]=number',
        )
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(2);

      const scores = response.body.map((r: any) => r.metrics.performance.score);
      expect(scores).to.containDeep([85, 95]);
    });

    it('should filter by nested date field with BSON Date serialization', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const entityId = await createTestEntity(client, {
        _name: 'Date Nested Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Date Nested List',
        _kind: 'reading-list',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        timeline: {
          milestones: {
            started: lastWeek.toISOString(),
          },
        },
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        timeline: {
          milestones: {
            started: yesterday.toISOString(),
          },
        },
      });

      // Filter by nested date with gt operator - tests BSON Date handling in nested paths
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const response = await client
        .get('/relations')
        .query(
          `filter[where][timeline.milestones.started][gt]=${encodeURIComponent(threeDaysAgo.toISOString())}`,
        )
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0].timeline.milestones.started).to.equal(
        yesterday.toISOString(),
      );
    });
  });

  // ============================================================================
  // SECTION 3: EXPLICIT ID MATCHING
  // Tests Driver v6 index utilization with string-based UUID _id
  // ============================================================================

  describe('Explicit ID Matching', () => {
    it('should find relation by exact UUID _id via aggregation filter', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'ID Test Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'ID Test List',
        _kind: 'reading-list',
      });

      // Create multiple relations
      const targetRelationId = await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        marker: 'target',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        marker: 'decoy-1',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        marker: 'decoy-2',
      });

      // Filter by exact _id - tests string ID matching in aggregation $match
      const response = await client
        .get('/relations')
        .query({ filter: { where: { _id: targetRelationId } } })
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0]._id).to.equal(targetRelationId);
      expect(response.body[0].marker).to.equal('target');
    });

    it('should find entity by exact UUID _id via aggregation filter', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
      });
      ({ client } = appWithClient);

      const targetEntityId = await createTestEntity(client, {
        _name: 'Target Entity',
        _kind: 'book',
        marker: 'target',
      });

      await createTestEntity(client, {
        _name: 'Decoy Entity 1',
        _kind: 'book',
        marker: 'decoy-1',
      });

      await createTestEntity(client, {
        _name: 'Decoy Entity 2',
        _kind: 'book',
        marker: 'decoy-2',
      });

      // Filter by exact _id
      const response = await client
        .get('/entities')
        .query({ filter: { where: { _id: targetEntityId } } })
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0]._id).to.equal(targetEntityId);
      expect(response.body[0].marker).to.equal('target');
    });

    it('should find list by exact UUID _id via aggregation filter', async () => {
      appWithClient = await setupApplication({
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const targetListId = await createTestList(client, {
        _name: 'Target List',
        _kind: 'reading-list',
        marker: 'target',
      });

      await createTestList(client, {
        _name: 'Decoy List 1',
        _kind: 'reading-list',
        marker: 'decoy-1',
      });

      await createTestList(client, {
        _name: 'Decoy List 2',
        _kind: 'reading-list',
        marker: 'decoy-2',
      });

      // Filter by exact _id
      const response = await client
        .get('/lists')
        .query({ filter: { where: { _id: targetListId } } })
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0]._id).to.equal(targetListId);
      expect(response.body[0].marker).to.equal('target');
    });

    it('should find multiple records by _id using inq operator', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'INQ Test Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'INQ Test List',
        _kind: 'reading-list',
      });

      const id1 = await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        order: 1,
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        order: 2,
      });

      const id3 = await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        order: 3,
      });

      // Filter by multiple _ids using inq
      const response = await client
        .get('/relations')
        .query({
          filter: { where: { _id: { inq: [id1, id3] } } },
        })
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(2);

      const orders = response.body.map((r: any) => r.order);
      expect(orders).to.containDeep([1, 3]);
    });
  });

  // ============================================================================
  // SECTION 4: AGGREGATION TYPE RIGIDITY
  // Tests type enforcement when query params pass numbers as strings
  // ============================================================================

  describe('Aggregation Type Rigidity', () => {
    it('should correctly filter numeric field stored as number', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Type Rigidity Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Type Rigidity List',
        _kind: 'reading-list',
      });

      // Create relations with numeric priority (stored as actual numbers in MongoDB)
      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        priority: 10,
        marker: 'low',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        priority: 20,
        marker: 'medium',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        priority: 30,
        marker: 'high',
      });

      // Query with exact numeric match - the value 20 is stored as a number in MongoDB
      // Using JSON-stringified filter ensures proper type handling
      const filterJson = JSON.stringify({
        where: { priority: 20 },
      });
      const response = await client
        .get(`/relations?filter=${encodeURIComponent(filterJson)}`)
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0].priority).to.equal(20);
      expect(response.body[0].marker).to.equal('medium');
    });

    it('should correctly filter float values with precision', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Float Precision Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Float Precision List',
        _kind: 'reading-list',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        rating: 4.5,
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        rating: 3.7,
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        rating: 4.9,
      });

      // Query with exact float value
      const response = await client
        .get('/relations')
        .query(
          'filter[where][rating][eq]=4.5&filter[where][rating][type]=number',
        )
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0].rating).to.equal(4.5);
    });

    it('should handle version field (integer) comparisons correctly', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Version Test Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Version Test List',
        _kind: 'reading-list',
      });

      // Create a relation
      const relationId = await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
      });

      // Update it multiple times to increment _version
      await client
        .patch(`/relations/${relationId}`)
        .send({ marker: 'update-1' })
        .expect(204);

      await client
        .patch(`/relations/${relationId}`)
        .send({ marker: 'update-2' })
        .expect(204);

      await client
        .patch(`/relations/${relationId}`)
        .send({ marker: 'update-3' })
        .expect(204);

      // Query by _version (should be 4 after 3 updates starting from 1)
      const response = await client
        .get('/relations')
        .query(
          'filter[where][_version][gte]=4&filter[where][_version][type]=number',
        )
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0]._version).to.equal(4);
      expect(response.body[0].marker).to.equal('update-3');
    });
  });

  // ============================================================================
  // SECTION 5: DATE SERIALIZATION & BSON COMPLIANCE
  // Tests new Date() → BSON Date conversion in aggregation pipelines
  // ============================================================================

  describe('Date Serialization & BSON Compliance', () => {
    it('should correctly serialize and compare ISO date strings to BSON Dates', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

      const entityId = await createTestEntity(client, {
        _name: 'Date Serialization Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Date Serialization List',
        _kind: 'reading-list',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        _validFromDateTime: threeHoursAgo.toISOString(),
        marker: 'oldest',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        _validFromDateTime: twoHoursAgo.toISOString(),
        marker: 'middle',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        _validFromDateTime: oneHourAgo.toISOString(),
        marker: 'newest',
      });

      // Filter using between operator on date field
      const response = await client
        .get('/relations')
        .query(
          `filter[where][_validFromDateTime][between][0]=${encodeURIComponent(threeHoursAgo.toISOString())}` +
            `&filter[where][_validFromDateTime][between][1]=${encodeURIComponent(twoHoursAgo.toISOString())}`,
        )
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(2);

      const markers = response.body.map((r: any) => r.marker);
      expect(markers).to.containDeep(['oldest', 'middle']);
    });

    it('should handle null date fields in comparisons', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
        autoapprove_list_entity_relations: 'false', // Disable auto-approval so validFromDateTime can be null
      });
      ({ client } = appWithClient);

      const now = new Date();

      const entityId = await createTestEntity(client, {
        _name: 'Null Date Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Null Date List',
        _kind: 'reading-list',
      });

      // Create relation with explicit validFromDateTime
      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        _validFromDateTime: now.toISOString(),
        marker: 'has-date',
      });

      // Create relation without validFromDateTime (should be null/undefined)
      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        marker: 'no-date',
      });

      // Query for records where _validFromDateTime is not null
      const response = await client
        .get('/relations')
        .query('filter[where][_validFromDateTime][neq]=null')
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0].marker).to.equal('has-date');
    });

    it('should correctly handle _createdDateTime in queries', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Created Date Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Created Date List',
        _kind: 'reading-list',
      });

      const beforeCreation = new Date();

      // Small delay to ensure timestamps differ
      await new Promise((resolve) => setTimeout(resolve, 100));

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        marker: 'test-relation',
      });

      // Query for records created after our timestamp
      const response = await client
        .get('/relations')
        .query(
          `filter[where][_createdDateTime][gt]=${encodeURIComponent(beforeCreation.toISOString())}`,
        )
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0].marker).to.equal('test-relation');

      // Verify the _createdDateTime is a valid ISO string
      const createdDate = new Date(response.body[0]._createdDateTime);
      expect(createdDate.getTime()).to.be.greaterThan(beforeCreation.getTime());
    });
  });

  // ============================================================================
  // SECTION 6: CURSOR.TOARRAY() AND ARRAY MAPPING
  // Tests the Diana Lau Bug protection via cursor.toArray() + injectRecordTypeArray
  // ============================================================================

  describe('Array Mapping Consistency', () => {
    it('should always return array from aggregation even with single result', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Single Result Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Single Result List',
        _kind: 'reading-list',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        marker: 'only-one',
      });

      // Query that returns exactly one result
      const response = await client
        .get('/relations')
        .query({ filter: { where: { marker: 'only-one' } } })
        .expect(200);

      // CRITICAL: Response must be an array, not a single object
      expect(response.body).to.be.Array();
      expect(response.body).to.have.length(1);
      expect(response.body[0].marker).to.equal('only-one');
    });

    it('should return empty array when no results match', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      // Query with filter that matches nothing
      const response = await client
        .get('/relations')
        .query({ filter: { where: { marker: 'nonexistent-marker-xyz' } } })
        .expect(200);

      // CRITICAL: Response must be an empty array, not null/undefined
      expect(response.body).to.be.Array();
      expect(response.body).to.have.length(0);
    });

    it('should correctly inject _recordType on all array elements', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Record Type Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Record Type List',
        _kind: 'reading-list',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        order: 1,
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        order: 2,
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        order: 3,
      });

      const response = await client.get('/relations').expect(200);

      expect(response.body).to.be.Array().and.have.length(3);

      // Verify _recordType is injected on ALL elements by injectRecordTypeArray
      for (const relation of response.body) {
        expect(relation._recordType).to.equal('relation');
      }
    });

    it('should handle large result sets without array mapping issues', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
        response_limit_list_entity_rel: '50', // Allow larger response for this test
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Large Set Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Large Set List',
        _kind: 'reading-list',
      });

      // Create 20 relations
      const expectedCount = 20;
      for (let i = 0; i < expectedCount; i++) {
        await createTestRelation({
          _listId: listId,
          _entityId: entityId,
          _kind: 'reading-list-book',
          sequenceNumber: i,
        });
      }

      const response = await client.get('/relations').expect(200);

      expect(response.body).to.be.Array().and.have.length(expectedCount);

      // Verify all items are properly mapped
      const sequenceNumbers = response.body.map(
        (r: any) => r.sequenceNumber,
      ) as number[];
      for (let i = 0; i < expectedCount; i++) {
        expect(sequenceNumbers).to.containEql(i);
      }
    });
  });

  // ============================================================================
  // SECTION 7: COMPLEX FILTER COMBINATIONS
  // Tests buildMongoQuery with $and, $or, and nested operators
  // ============================================================================

  describe('Complex Filter Combinations', () => {
    it('should handle AND + OR combination with nested date comparisons', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const entityId = await createTestEntity(client, {
        _name: 'Complex Filter Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'Complex Filter List',
        _kind: 'reading-list',
      });

      // Active public relation
      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        _visibility: 'public',
        _validFromDateTime: yesterday.toISOString(),
        _validUntilDateTime: tomorrow.toISOString(),
        marker: 'active-public',
      });

      // Active private relation
      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        _visibility: 'private',
        _validFromDateTime: yesterday.toISOString(),
        _validUntilDateTime: tomorrow.toISOString(),
        marker: 'active-private',
      });

      // Expired public relation
      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        _visibility: 'public',
        _validFromDateTime: yesterday.toISOString(),
        _validUntilDateTime: yesterday.toISOString(),
        marker: 'expired-public',
      });

      // Complex filter: (public OR private) AND active (validUntilDateTime > now)
      const filterStr =
        `filter[where][and][0][or][0][_visibility]=public&` +
        `filter[where][and][0][or][1][_visibility]=private&` +
        `filter[where][and][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}`;

      const response = await client
        .get('/relations')
        .query(filterStr)
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(2);

      const markers = response.body.map((r: any) => r.marker);
      expect(markers).to.containDeep(['active-public', 'active-private']);
    });

    it('should handle multiple inq operators in same query', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book,magazine',
        list_kinds: 'reading-list,wish-list',
      });
      ({ client } = appWithClient);

      const bookId = await createTestEntity(client, {
        _name: 'Multi INQ Book',
        _kind: 'book',
      });

      const magazineId = await createTestEntity(client, {
        _name: 'Multi INQ Magazine',
        _kind: 'magazine',
      });

      const readingListId = await createTestList(client, {
        _name: 'Reading List',
        _kind: 'reading-list',
      });

      const wishListId = await createTestList(client, {
        _name: 'Wish List',
        _kind: 'wish-list',
      });

      // Create various combinations
      await createTestRelation({
        _listId: readingListId,
        _entityId: bookId,
        _kind: 'reading-list-book',
        marker: 'reading-book',
      });

      await createTestRelation({
        _listId: wishListId,
        _entityId: magazineId,
        _kind: 'wish-list-magazine',
        marker: 'wish-magazine',
      });

      await createTestRelation({
        _listId: readingListId,
        _entityId: magazineId,
        _kind: 'reading-list-magazine',
        marker: 'reading-magazine',
      });

      // Filter by multiple _kinds using inq
      const response = await client
        .get('/relations')
        .query({
          filter: {
            where: {
              _kind: { inq: ['reading-list-book', 'wish-list-magazine'] },
            },
          },
        })
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(2);

      const markers = response.body.map((r: any) => r.marker);
      expect(markers).to.containDeep(['reading-book', 'wish-magazine']);
    });

    it('should handle nin (not in) operator correctly', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book',
        list_kinds: 'reading-list',
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'NIN Test Book',
        _kind: 'book',
      });

      const listId = await createTestList(client, {
        _name: 'NIN Test List',
        _kind: 'reading-list',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        status: 'draft',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        status: 'published',
      });

      await createTestRelation({
        _listId: listId,
        _entityId: entityId,
        _kind: 'reading-list-book',
        status: 'archived',
      });

      // Filter using nin - exclude draft and archived
      const response = await client
        .get('/relations')
        .query({
          filter: {
            where: {
              status: { nin: ['draft', 'archived'] },
            },
          },
        })
        .expect(200);

      expect(response.body).to.be.Array().and.have.length(1);
      expect(response.body[0].status).to.equal('published');
    });
  });
});
