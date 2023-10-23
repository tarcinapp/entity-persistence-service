import {
  Count,
  CountSchema,
  Filter,
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
import {
List,
ListEntityRelation,
GenericEntity,
} from '../models';
import {ListRepository} from '../repositories';

export class ListGenericEntityController {
  constructor(
    @repository(ListRepository) protected listRepository: ListRepository,
  ) { }

  @get('/lists/{id}/generic-entities', {
    responses: {
      '200': {
        description: 'Array of List has many GenericEntity through ListEntityRelation',
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
    @param.query.object('filter') filter?: Filter<GenericEntity>,
  ): Promise<GenericEntity[]> {
    return this.listRepository.genericEntities(id).find(filter);
  }

  @post('/lists/{id}/generic-entities', {
    responses: {
      '200': {
        description: 'create a GenericEntity model instance',
        content: {'application/json': {schema: getModelSchemaRef(GenericEntity)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof List.prototype.id,
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

  @patch('/lists/{id}/generic-entities', {
    responses: {
      '200': {
        description: 'List.GenericEntity PATCH success count',
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
    return this.listRepository.genericEntities(id).patch(genericEntity, where);
  }

  @del('/lists/{id}/generic-entities', {
    responses: {
      '200': {
        description: 'List.GenericEntity DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(GenericEntity)) where?: Where<GenericEntity>,
  ): Promise<Count> {
    return this.listRepository.genericEntities(id).delete(where);
  }
}
