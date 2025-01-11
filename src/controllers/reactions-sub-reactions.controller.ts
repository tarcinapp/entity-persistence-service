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

import { Reactions, SubReactions } from '../models';
import { ReactionsRepository } from '../repositories';

export class ReactionsSubReactionsController {
  constructor(
    @repository(ReactionsRepository)
    protected reactionsRepository: ReactionsRepository,
  ) {}

  @get('/reactions/{id}/sub-reactions', {
    responses: {
      '200': {
        description: 'Array of Reactions has many SubReactions',
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
    return this.reactionsRepository.subReactions(id).find(filter);
  }

  @post('/reactions/{id}/sub-reactions', {
    responses: {
      '200': {
        description: 'Reactions model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(SubReactions) },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Reactions.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(SubReactions, {
            title: 'NewSubReactionsInReactions',
            exclude: ['id'],
            optional: ['reactionId'],
          }),
        },
      },
    })
    subReactions: Omit<SubReactions, 'id'>,
  ): Promise<SubReactions> {
    return this.reactionsRepository.subReactions(id).create(subReactions);
  }

  @patch('/reactions/{id}/sub-reactions', {
    responses: {
      '200': {
        description: 'Reactions.SubReactions PATCH success count',
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
    return this.reactionsRepository.subReactions(id).patch(subReactions, where);
  }

  @del('/reactions/{id}/sub-reactions', {
    responses: {
      '200': {
        description: 'Reactions.SubReactions DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(SubReactions))
    where?: Where<SubReactions>,
  ): Promise<Count> {
    return this.reactionsRepository.subReactions(id).delete(where);
  }
}
