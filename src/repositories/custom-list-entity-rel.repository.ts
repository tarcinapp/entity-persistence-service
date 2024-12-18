import {inject} from '@loopback/context';
import {
  DefaultCrudRepository,
  Filter,
  Getter,
  Options,
  repository
} from '@loopback/repository';
import {EntityDbDataSource} from '../datasources';
import {
  GenericEntity,
  GenericEntityRelations,
  GenericList,
  GenericListEntityRelation
} from '../models';
import {GenericEntityRepository} from './generic-entity.repository';
import {GenericListEntityRelationRepository} from './generic-list-entity-relation.repository';

export class CustomListEntityRelRepository extends DefaultCrudRepository<
  GenericEntity,
  typeof GenericEntity.prototype.id,
  GenericEntityRelations
> {

  protected sourceListId: typeof GenericList.prototype.id;

  constructor(
    @inject('datasources.EntityDb') dataSource: EntityDbDataSource,

    @repository.getter('GenericEntityRepository')
    protected genericEntityRepositoryGetter: Getter<GenericEntityRepository>,

    @repository.getter('GenericListEntityRelationRepository')
    protected genericListEntityRepositoryGetter: Getter<GenericListEntityRelationRepository>
  ) {
    super(GenericEntity, dataSource);
  }


  async find(
    filter?: Filter<GenericEntity>,
    filterThrough?: Filter<GenericListEntityRelation>,
    options?: Options
  ): Promise<GenericEntity[]> {
    const listEntityRelationRepo = await this.genericListEntityRepositoryGetter();
    const relations = await listEntityRelationRepo.find({
      where: {
        ...filterThrough?.where,
        listId: this.sourceListId,
      },
      fields: {entityId: true},
    });

    if (!relations.length) {
      return [];
    }

    const entityIds = relations.map(rel => rel.entityId);
    const enhancedFilter: Filter<GenericEntity> = {
      ...filter,
      where: {
        ...filter?.where,
        id: {inq: entityIds}, // Yalnızca ilişkili entity'ler
      },
    };

    // 4. Hedef Modelde (`GenericEntity`) Filtreleme Yap ve Sonuçları Döndür
    return super.find(enhancedFilter, options);
  }

}
