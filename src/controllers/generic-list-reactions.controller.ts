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
import { GenericList, ListReactions } from '../models';
import { GenericListRepository } from '../repositories';

export class ListListReactionsController {
  constructor(
    @repository(GenericListRepository)
    protected listRepository: GenericListRepository,
  ) {}

  @get('/generic-lists/{id}/list-reactions', {
    responses: {
      '200': {
        description: 'Array of List has many ListReactions',
        content: {
          'application/json': {
            schema: { type: 'array', items: getModelSchemaRef(ListReactions) },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<ListReactions>,
  ): Promise<ListReactions[]> {
    return this.listRepository.reactions(id).find(filter);
  }

  @post('/generic-lists/{id}/list-reactions', {
    responses: {
      '200': {
        description: 'List model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(ListReactions) },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof GenericList.prototype._id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListReactions, {
            title: 'NewListReactionsInList',
            exclude: ['id'],
            optional: ['listId'],
          }),
        },
      },
    })
    listReactions: Omit<ListReactions, 'id'>,
  ): Promise<ListReactions> {
    return this.listRepository.reactions(id).create(listReactions);
  }

  @patch('/generic-lists/{id}/list-reactions', {
    responses: {
      '200': {
        description: 'List.ListReactions PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListReactions, { partial: true }),
        },
      },
    })
    listReactions: Partial<ListReactions>,
    @param.query.object('where', getWhereSchemaFor(ListReactions))
    where?: Where<ListReactions>,
  ): Promise<Count> {
    return this.listRepository.reactions(id).patch(listReactions, where);
  }

  @del('/generic-lists/{id}/list-reactions', {
    responses: {
      '200': {
        description: 'List.ListReactions DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(ListReactions))
    where?: Where<ListReactions>,
  ): Promise<Count> {
    return this.listRepository.reactions(id).delete(where);
  }
}
