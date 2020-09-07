import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
} from '@loopback/rest';
import {Tag} from '../models';
import {TagRepository} from '../repositories';

export class TagController {
  constructor(
    @repository(TagRepository)
    public tagRepository : TagRepository,
  ) {}

  @post('/tags', {
    responses: {
      '200': {
        description: 'Tag model instance',
        content: {'application/json': {schema: getModelSchemaRef(Tag)}},
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {
            title: 'NewTag',
            exclude: ['id'],
          }),
        },
      },
    })
    tag: Omit<Tag, 'id'>,
  ): Promise<Tag> {
    return this.tagRepository.create(tag);
  }

  @get('/tags/count', {
    responses: {
      '200': {
        description: 'Tag model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(Tag) where?: Where<Tag>,
  ): Promise<Count> {
    return this.tagRepository.count(where);
  }

  @get('/tags', {
    responses: {
      '200': {
        description: 'Array of Tag model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(Tag, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(Tag) filter?: Filter<Tag>,
  ): Promise<Tag[]> {
    return this.tagRepository.find(filter);
  }

  @patch('/tags', {
    responses: {
      '200': {
        description: 'Tag PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {partial: true}),
        },
      },
    })
    tag: Tag,
    @param.where(Tag) where?: Where<Tag>,
  ): Promise<Count> {
    return this.tagRepository.updateAll(tag, where);
  }

  @get('/tags/{id}', {
    responses: {
      '200': {
        description: 'Tag model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Tag, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Tag, {exclude: 'where'}) filter?: FilterExcludingWhere<Tag>
  ): Promise<Tag> {
    return this.tagRepository.findById(id, filter);
  }

  @patch('/tags/{id}', {
    responses: {
      '204': {
        description: 'Tag PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {partial: true}),
        },
      },
    })
    tag: Tag,
  ): Promise<void> {
    await this.tagRepository.updateById(id, tag);
  }

  @put('/tags/{id}', {
    responses: {
      '204': {
        description: 'Tag PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() tag: Tag,
  ): Promise<void> {
    await this.tagRepository.replaceById(id, tag);
  }

  @del('/tags/{id}', {
    responses: {
      '204': {
        description: 'Tag DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.tagRepository.deleteById(id);
  }
}
