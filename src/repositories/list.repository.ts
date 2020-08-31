import {DefaultCrudRepository, repository, HasManyThroughRepositoryFactory} from '@loopback/repository';
import {List, ListRelations, GenericEntity, ListEntityRelation} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject, Getter} from '@loopback/core';
import {ListEntityRelationRepository} from './list-entity-relation.repository';
import {GenericEntityRepository} from './generic-entity.repository';

export class ListRepository extends DefaultCrudRepository<
  List,
  typeof List.prototype.id,
  ListRelations
> {

  public readonly genericEntities: HasManyThroughRepositoryFactory<GenericEntity, typeof GenericEntity.prototype.id,
          ListEntityRelation,
          typeof List.prototype.id
        >;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource, @repository.getter('ListEntityRelationRepository') protected listEntityRelationRepositoryGetter: Getter<ListEntityRelationRepository>, @repository.getter('GenericEntityRepository') protected genericEntityRepositoryGetter: Getter<GenericEntityRepository>,
  ) {
    super(List, dataSource);
    this.genericEntities = this.createHasManyThroughRepositoryFactoryFor('genericEntities', genericEntityRepositoryGetter, listEntityRelationRepositoryGetter,);
  }
}
