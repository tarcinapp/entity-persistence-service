import { Filter, repository } from '@loopback/repository';
import { get, getModelSchemaRef, param } from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { List, ListToEntityRelation } from '../models';
import { ALWAYS_HIDDEN_FIELDS } from '../models/base-types/unmodifiable-common-fields';
import { EntityRepository } from '../repositories';

export class ListsThroughEntitiesController {
  constructor(
    @repository(EntityRepository)
    protected entityRepository: EntityRepository,
  ) {}

  @get('/entities/{id}/lists', {
    responses: {
      '200': {
        description: 'Array of Lists through ListEntityRelation',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(List, {
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof List)[],
              }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('filter') filter?: Filter<List>,
    @param.query.object('setThrough') setThrough?: Set,
    @param.query.object('filterThrough')
    filterThrough?: Filter<ListToEntityRelation>,
  ): Promise<List[]> {
    if (set) {
      filter = new SetFilterBuilder<List>(set, {
        filter: filter,
      }).build();
    }

    if (setThrough) {
      filterThrough = new SetFilterBuilder<ListToEntityRelation>(setThrough, {
        filter: filterThrough,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(filterThrough);

    return this.entityRepository.lists(id).find(filter, filterThrough);
  }
}
