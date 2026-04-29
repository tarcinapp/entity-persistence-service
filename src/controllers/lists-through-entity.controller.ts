import { Filter, repository } from '@loopback/repository';
import { get, getModelSchemaRef, param } from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { List, ListToEntityRelation, HttpErrorResponse } from '../models';
import { ALWAYS_HIDDEN_FIELDS } from '../models/base-types/unmodifiable-common-fields';
import { EntityRepository } from '../repositories';

export class ListsThroughEntityController {
  constructor(
    @repository(EntityRepository)
    protected entityRepository: EntityRepository,
  ) {}

  @get('/entities/{id}/lists', {
    operationId: 'findListsByEntityId',
    responses: {
      '200': {
        description: 'Array of List model instances through Entity',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(List, { includeRelations: true }),
            },
          },
        },
      },
      '400': {
        description: 'Bad request - malformed filter or query parameter',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getModelSchemaRef(HttpErrorResponse),
              },
            },
          },
        },
      },
      '500': {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getModelSchemaRef(HttpErrorResponse),
              },
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

    const repo = await this.entityRepository.lists(id);

    return repo.find(filter, filterThrough);
  }
}
