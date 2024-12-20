import {
  Count,
  CountSchema,
  Filter,
  FilterBuilder,
  repository,
  Where
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
import {Set, SetFilterBuilder} from '../extensions/set';
import {sanitizeFilterFields} from '../helpers/filter.helper';
import {
  GenericEntity,
  GenericList
} from '../models';
import {GenericListRepository} from '../repositories';

export class GenericListGenericEntityController {
  constructor(
    @repository(GenericListRepository) protected listRepository: GenericListRepository,
  ) { }

  @get('/generic-lists/{id}/generic-entities', {
    responses: {
      '200': {
        description: 'Array of GenericList has many GenericEntity through ListEntityRelation',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(GenericEntity)},
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
    @param.query.object('filterThrough') filterThrough?: Filter<GenericEntity>,
  ): Promise<GenericEntity[]> {

    if (set)
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter
      }).build();

    if (setThrough)
      filterThrough = new SetFilterBuilder<GenericEntity>(setThrough, {
        filter: filter
      }).build();

    sanitizeFilterFields(filter);
    sanitizeFilterFields(filterThrough);

    return this.listRepository.genericEntities(id).find(filter, filterThrough);
  }

  @post('/generic-lists/{id}/generic-entities', {
    responses: {
      '200': {
        description: 'create a GenericEntity model instance',
        content: {'application/json': {schema: getModelSchemaRef(GenericEntity)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof GenericList.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'NewGenericEntityInList',
            exclude: ['id'],
          }),
        },
      },
    }) genericEntity: Omit<GenericEntity, 'id'>,
  ): Promise<GenericEntity> {
    return this.listRepository.genericEntities(id).create(genericEntity);
  }

  @patch('/generic-lists/{id}/generic-entities', {
    responses: {
      '200': {
        description: 'GenericList.GenericEntity PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {partial: true}),
        },
      },
    })
    genericEntity: Partial<GenericEntity>,
    @param.query.object('where', getWhereSchemaFor(GenericEntity)) where?: Where<GenericEntity>,
  ): Promise<Count> {
    return this.listRepository.genericEntities(id).updateAll(genericEntity, where);
  }

  @del('/generic-lists/{id}/generic-entities', {
    responses: {
      '200': {
        description: 'GenericList.GenericEntity DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('where', getWhereSchemaFor(GenericEntity)) where?: Where<GenericEntity>,
  ): Promise<Count> {

    const filterBuilder = new FilterBuilder<GenericEntity>();

    if (where)
      filterBuilder.where(where);

    let filter = filterBuilder.build();

    if (set)
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter
      }).build();

    return this.listRepository.genericEntities(id).deleteAll(filter.where);
  }
}
