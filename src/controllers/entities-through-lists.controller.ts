import {
  Count,
  CountSchema,
  Filter,
  FilterBuilder,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { GenericEntity, List, ListToEntityRelation } from '../models';
import { ListRepository } from '../repositories';

export class GenericListGenericEntityController {
  constructor(
    @repository(ListRepository)
    protected listRepository: ListRepository,
  ) {}

  @get('/generic-lists/{id}/entities', {
    responses: {
      '200': {
        description:
          'Array of GenericList has many GenericEntity through ListEntityRelation',
        content: {
          'application/json': {
            schema: { type: 'array', items: getModelSchemaRef(GenericEntity) },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('filter') filter?: Filter<GenericEntity>,
    @param.query.object('setThrough') setThrough?: Set,
    @param.query.object('filterThrough')
    filterThrough?: Filter<ListToEntityRelation>,
  ): Promise<GenericEntity[]> {
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
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

    return this.listRepository.entities(id).find(filter, filterThrough);
  }

  @post('/generic-lists/{id}/entities', {
    responses: {
      '200': {
        description: 'create a GenericEntity model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(GenericEntity) },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof List.prototype._id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'NewGenericEntityInList',
            exclude: [
              '_id',
              '_slug',
              '_ownerUsersCount',
              '_ownerGroupsCount',
              '_viewerUsersCount',
              '_viewerGroupsCount',
              '_version',
              '_idempotencyKey',
            ],
          }),
        },
      },
    })
    genericEntity: Omit<GenericEntity, 'id'>,
  ): Promise<GenericEntity> {
    return this.listRepository.entities(id).create(genericEntity);
  }

  @patch('/generic-lists/{id}/entities', {
    responses: {
      '200': {
        description: 'GenericList.GenericEntity PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, { partial: true }),
        },
      },
    })
    genericEntity: Partial<GenericEntity>,
    @param.query.object('where', getWhereSchemaFor(GenericEntity))
    where?: Where<GenericEntity>,
    @param.query.object('whereThrough')
    whereThrough?: Where<ListToEntityRelation>,
  ): Promise<Count> {
    return this.listRepository
      .entities(id)
      .updateAll(genericEntity, where, whereThrough);
  }

  @del('/generic-lists/{id}/entities', {
    responses: {
      '200': {
        description: 'GenericList.GenericEntity DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('where', getWhereSchemaFor(GenericEntity))
    where?: Where<GenericEntity>,
    @param.query.object('whereThrough')
    whereThrough?: Where<ListToEntityRelation>,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<GenericEntity>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
    }

    return this.listRepository
      .entities(id)
      .deleteAll(filter.where, whereThrough);
  }
}
