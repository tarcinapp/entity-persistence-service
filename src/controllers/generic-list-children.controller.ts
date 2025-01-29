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
import { List, ListRelation } from '../models';
import { ListRepository } from '../repositories';

export class GenericListChildrenController {
  constructor(
    @repository(ListRepository)
    protected listRepository: ListRepository,
  ) {}

  @get('/generic-lists/{id}/children', {
    responses: {
      '200': {
        description: 'Array of List has many ListRelation',
        content: {
          'application/json': {
            schema: { type: 'array', items: getModelSchemaRef(ListRelation) },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<ListRelation>,
  ): Promise<ListRelation[]> {
    return this.listRepository.children(id).find(filter);
  }

  @post('/generic-lists/{id}/children', {
    responses: {
      '200': {
        description: 'List model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(ListRelation) },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof List.prototype._id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListRelation, {
            title: 'NewListRelationInList',
            exclude: ['id'],
            optional: ['from'],
          }),
        },
      },
    })
    listRelation: Omit<ListRelation, 'id'>,
  ): Promise<ListRelation> {
    return this.listRepository.children(id).create(listRelation);
  }

  @patch('/generic-lists/{id}/children', {
    responses: {
      '200': {
        description: 'List.ListRelation PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListRelation, { partial: true }),
        },
      },
    })
    listRelation: Partial<ListRelation>,
    @param.query.object('where', getWhereSchemaFor(ListRelation))
    where?: Where<ListRelation>,
  ): Promise<Count> {
    return this.listRepository.children(id).patch(listRelation, where);
  }

  @del('/generic-lists/{id}/children', {
    responses: {
      '200': {
        description: 'List.ListRelation DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(ListRelation))
    where?: Where<ListRelation>,
  ): Promise<Count> {
    return this.listRepository.children(id).delete(where);
  }
}
