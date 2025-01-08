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
  GenericList,
  Tag
} from '../models';
import {GenericListRepository} from '../repositories';

export class ListTagController {
  constructor(
    @repository(GenericListRepository) protected listRepository: GenericListRepository,
  ) { }

  @get('/generic-lists/{id}/tags', {
    responses: {
      '200': {
        description: 'Array of List has many Tag through TagListRelation',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Tag)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Tag>,
  ): Promise<Tag[]> {
    return this.listRepository.tags(id).find(filter);
  }

  @post('/generic-lists/{id}/tags', {
    responses: {
      '200': {
        description: 'create a Tag model instance',
        content: {'application/json': {schema: getModelSchemaRef(Tag)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof GenericList.prototype._id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {
            title: 'NewTagInList',
            exclude: ['id'],
          }),
        },
      },
    }) tag: Omit<Tag, 'id'>,
  ): Promise<Tag> {
    return this.listRepository.tags(id).create(tag);
  }

  @patch('/generic-lists/{id}/tags', {
    responses: {
      '200': {
        description: 'List.Tag PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {partial: true}),
        },
      },
    })
    tag: Partial<Tag>,
    @param.query.object('where', getWhereSchemaFor(Tag)) where?: Where<Tag>,
  ): Promise<Count> {
    return this.listRepository.tags(id).patch(tag, where);
  }

  @del('/generic-lists/{id}/tags', {
    responses: {
      '200': {
        description: 'List.Tag DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Tag)) where?: Where<Tag>,
  ): Promise<Count> {
    return this.listRepository.tags(id).delete(where);
  }
}
