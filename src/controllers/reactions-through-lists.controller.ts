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
import { List, ListReaction } from '../models';
import { ListRepository } from '../repositories';

export class ReactionsThroughListsController {
  constructor(
    @repository(ListRepository)
    protected listRepository: ListRepository,
  ) {}

  @get('/lists/{id}/reactions', {
    responses: {
      '200': {
        description: 'Array of List has many ListReactions',
        content: {
          'application/json': {
            schema: { type: 'array', items: getModelSchemaRef(ListReaction) },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<ListReaction>,
  ): Promise<ListReaction[]> {
    return this.listRepository.reactions(id).find(filter);
  }

  @post('/lists/{id}/reactions', {
    responses: {
      '200': {
        description: 'List model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(ListReaction) },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof List.prototype._id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListReaction, {
            title: 'NewListReactionsInList',
            exclude: ['id'],
            optional: ['listId'],
          }),
        },
      },
    })
    listReactions: Omit<ListReaction, 'id'>,
  ): Promise<ListReaction> {
    return this.listRepository.reactions(id).create(listReactions);
  }

  @patch('/lists/{id}/reactions', {
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
          schema: getModelSchemaRef(ListReaction, { partial: true }),
        },
      },
    })
    listReactions: Partial<ListReaction>,
    @param.query.object('where', getWhereSchemaFor(ListReaction))
    where?: Where<ListReaction>,
  ): Promise<Count> {
    return this.listRepository.reactions(id).patch(listReactions, where);
  }

  @del('/lists/{id}/reactions', {
    responses: {
      '200': {
        description: 'List.ListReactions DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(ListReaction))
    where?: Where<ListReaction>,
  ): Promise<Count> {
    return this.listRepository.reactions(id).delete(where);
  }
}
