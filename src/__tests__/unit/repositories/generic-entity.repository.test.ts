import { Getter } from '@loopback/core';
import { expect, sinon } from '@loopback/testlab';
import {
  setupRepositoryTest,
  teardownRepositoryTest,
} from './test-helper.repository';
import type { EntityPersistenceApplication } from '../../..';
import {
  GenericListEntityRelationRepository,
  ReactionsRepository,
  RelationRepository,
  TagEntityRelationRepository,
  TagRepository,
} from '../../../repositories';
import { GenericEntityRepository } from '../../../repositories/generic-entity.repository';

describe('GenericEntityRepository', () => {
  let app: EntityPersistenceApplication;
  let repository: GenericEntityRepository;

  before(async () => {
    // Set up test environment
    const testSetup = await setupRepositoryTest();
    app = testSetup.app;

    // Create stubs for related repositories
    const relationRepoStub = sinon.createStubInstance(RelationRepository);
    const reactionsRepoStub = sinon.createStubInstance(ReactionsRepository);
    const tagEntityRelationRepoStub = sinon.createStubInstance(
      TagEntityRelationRepository,
    );
    const tagRepoStub = sinon.createStubInstance(TagRepository);
    const listEntityRelationRepoStub = sinon.createStubInstance(
      GenericListEntityRelationRepository,
    );

    // Create main repository instance with stubbed dependencies
    repository = new GenericEntityRepository(
      testSetup.dataSource,
      Getter.fromValue(relationRepoStub),
      Getter.fromValue(reactionsRepoStub),
      Getter.fromValue(tagEntityRelationRepoStub),
      Getter.fromValue(tagRepoStub),
      Getter.fromValue(listEntityRelationRepoStub),
      testSetup.configReaders.uniquenessConfigReader,
      testSetup.configReaders.recordLimitConfigReader,
      testSetup.configReaders.kindLimitConfigReader,
      testSetup.configReaders.visibilityConfigReader,
      testSetup.configReaders.validfromConfigReader,
      testSetup.configReaders.idempotencyConfigReader,
      testSetup.configReaders.responseLimitConfigReader,
    );
  });

  after(async () => {
    await teardownRepositoryTest(app);
  });

  it('should be properly instantiated', () => {
    expect(repository).to.be.instanceOf(GenericEntityRepository);
  });

  it('should have all required relations configured', () => {
    expect(repository.children).to.not.be.undefined();
    expect(repository.reactions).to.not.be.undefined();
    expect(repository.tags).to.not.be.undefined();
  });
});
