import {inject} from '@loopback/context';
import {
  DefaultHasManyThroughRepository,
  Filter,
  Getter,
  juggler,
  Options,
  repository
} from '@loopback/repository';
import {
  GenericEntity,
  GenericListEntityRelation
} from '../models';
import {GenericEntityRepository} from './generic-entity.repository';
import {GenericListEntityRelationRepository} from './generic-list-entity-relation.repository';

export class CustomListEntityRelRepository extends DefaultHasManyThroughRepository<
  GenericEntity,
  typeof GenericEntity.prototype.id,
  GenericEntityRepository,
  GenericListEntityRelation,
  typeof GenericListEntityRelation.prototype.id,
  GenericListEntityRelationRepository
> {

  protected sourceId: typeof GenericEntity.prototype.id;

  constructor(
    @repository.getter('GenericEntityRepository')
    protected genericEntityRepositoryGetter: Getter<GenericEntityRepository>,

    @repository.getter('GenericListEntityRelationRepository')
    protected genericListEntityRepositoryGetter: Getter<GenericListEntityRelationRepository>,

    @inject('datasources.db')
    protected dataSource: juggler.DataSource,
  ) {
    super(
      // getTargetRepository
      genericEntityRepositoryGetter,

      // getThroughRepository
      genericListEntityRepositoryGetter,

      // getTargetConstraintFromThroughModels: throughInstances -> target filter constraint
      (throughInstances: GenericListEntityRelation[]) => {
        const fkValues = throughInstances.map(inst => inst.entityId);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const constraint: any =
          fkValues.length === 1
            ? {entityId: fkValues[0]}
            : {entityId: {inq: fkValues}};

        return constraint;
      },

      // getTargetKeys: throughInstances -> targetIDs array
      (throughInstances: GenericListEntityRelation[]) => {
        return throughInstances.map(inst => inst.entityId);
      },

      // getThroughConstraintFromSource: based on this.sourceId -> through filter by listId
      () => {
        return {listId: this.sourceId};
      },

      // getTargetIds: targetInstances -> extract target entity IDs
      (targetInstances: GenericEntity[]) => {
        return targetInstances.map(t => t.id!);
      },

      // getThroughConstraintFromTarget: targetIDs -> filter through by entityId
      (fkValues: (typeof GenericEntity.prototype.id)[]) => {

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const constraint: any =
          fkValues.length === 1
            ? {entityId: fkValues[0]}
            : {entityId: {inq: fkValues}};

        // Sadece ilk ID'yi alarak eşitlik kıyaslaması yapın
        return constraint;
      },

      // targetResolver
      () => GenericEntity,
      // throughResolver
      () => GenericListEntityRelation,
    );
  }


  async find(filter?: Filter<GenericEntity>, options?: Options) {
    return super.find(filter, options);
  }
}
