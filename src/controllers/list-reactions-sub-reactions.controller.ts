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
import { ListReactions, SubReactions } from '../models';
import { ListReactionsRepository } from '../repositories';

export class ListReactionsSubReactionsController {
  constructor(
    @repository(ListReactionsRepository)
    protected listReactionsRepository: ListReactionsRepository,
  ) {}

  @get('/list-reactions/{id}/sub-reactions', {
    responses: {
      '200': {
        description: 'Array of ListReactions has many SubReactions',
        content: {
          'application/json': {
            schema: { type: 'array', items: getModelSchemaRef(SubReactions) },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<SubReactions>,
  ): Promise<SubReactions[]> {
    return this.listReactionsRepository.subReactions(id).find(filter);
  }

  @post('/list-reactions/{id}/sub-reactions', {
    responses: {
      '200': {
        description: 'ListReactions model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(SubReactions) },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof ListReactions.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(SubReactions, {
            title: 'NewSubReactionsInListReactions',
            exclude: ['id'],
            optional: ['listReactionId'],
          }),
        },
      },
    })
    subReactions: Omit<SubReactions, 'id'>,
  ): Promise<SubReactions> {
    return this.listReactionsRepository.subReactions(id).create(subReactions);
  }

  @patch('/list-reactions/{id}/sub-reactions', {
    responses: {
      '200': {
        description: 'ListReactions.SubReactions PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(SubReactions, { partial: true }),
        },
      },
    })
    subReactions: Partial<SubReactions>,
    @param.query.object('where', getWhereSchemaFor(SubReactions))
    where?: Where<SubReactions>,
  ): Promise<Count> {
    return this.listReactionsRepository
      .subReactions(id)
      .patch(subReactions, where);
  }

  @del('/list-reactions/{id}/sub-reactions', {
    responses: {
      '200': {
        description: 'ListReactions.SubReactions DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(SubReactions))
    where?: Where<SubReactions>,
  ): Promise<Count> {
    return this.listReactionsRepository.subReactions(id).delete(where);
  }
}
