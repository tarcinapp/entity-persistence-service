import {DefaultCrudRepository, repository, HasManyThroughRepositoryFactory, HasManyRepositoryFactory} from '@loopback/repository';
import {List, ListRelations, GenericEntity, ListEntityRelation, ListRelation, ListReactions, Tag, TagListRelation} from '../models';
import {EntityDbDataSource} from '../datasources';
import {inject, Getter} from '@loopback/core';
import {ListEntityRelationRepository} from './list-entity-relation.repository';
import {GenericEntityRepository} from './generic-entity.repository';
import {ListRelationRepository} from './list-relation.repository';
import {ListReactionsRepository} from './list-reactions.repository';
import {TagListRelationRepository} from './tag-list-relation.repository';
import {TagRepository} from './tag.repository';

export class ListRepository extends DefaultCrudRepository<
  List,
  typeof List.prototype.id,
  ListRelations
> {

  public readonly genericEntities: HasManyThroughRepositoryFactory<GenericEntity, typeof GenericEntity.prototype.id,
          ListEntityRelation,
          typeof List.prototype.id
        >;

  public readonly relations: HasManyRepositoryFactory<ListRelation, typeof List.prototype.id>;

  public readonly reactions: HasManyRepositoryFactory<ListReactions, typeof List.prototype.id>;

  public readonly tags: HasManyThroughRepositoryFactory<Tag, typeof Tag.prototype.id,
          TagListRelation,
          typeof List.prototype.id
        >;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource, @repository.getter('ListEntityRelationRepository') protected listEntityRelationRepositoryGetter: Getter<ListEntityRelationRepository>, @repository.getter('GenericEntityRepository') protected genericEntityRepositoryGetter: Getter<GenericEntityRepository>, @repository.getter('ListRelationRepository') protected listRelationRepositoryGetter: Getter<ListRelationRepository>, @repository.getter('ListReactionsRepository') protected listReactionsRepositoryGetter: Getter<ListReactionsRepository>, @repository.getter('TagListRelationRepository') protected tagListRelationRepositoryGetter: Getter<TagListRelationRepository>, @repository.getter('TagRepository') protected tagRepositoryGetter: Getter<TagRepository>,
  ) {
    super(List, dataSource);
    this.tags = this.createHasManyThroughRepositoryFactoryFor('tags', tagRepositoryGetter, tagListRelationRepositoryGetter,);
    this.reactions = this.createHasManyRepositoryFactoryFor('reactions', listReactionsRepositoryGetter,);
    this.registerInclusionResolver('reactions', this.reactions.inclusionResolver);
    this.relations = this.createHasManyRepositoryFactoryFor('relations', listRelationRepositoryGetter,);
    this.registerInclusionResolver('relations', this.relations.inclusionResolver);
    this.genericEntities = this.createHasManyThroughRepositoryFactoryFor('genericEntities', genericEntityRepositoryGetter, listEntityRelationRepositoryGetter,);
  }
}
