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
import {TagListRelation} from '../models';
import {TagListRelationRepository} from '../repositories';

export class TagListRelationController {
  constructor(
    @repository(TagListRelationRepository)
    public tagListRelationRepository : TagListRelationRepository,
  ) {}

  @post('/tag-list-relations', {
    responses: {
      '200': {
        description: 'TagListRelation model instance',
        content: {'application/json': {schema: getModelSchemaRef(TagListRelation)}},
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(TagListRelation, {
            title: 'NewTagListRelation',
            exclude: ['id'],
          }),
        },
      },
    })
    tagListRelation: Omit<TagListRelation, 'id'>,
  ): Promise<TagListRelation> {
    return this.tagListRelationRepository.create(tagListRelation);
  }

  @get('/tag-list-relations/count', {
    responses: {
      '200': {
        description: 'TagListRelation model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(TagListRelation) where?: Where<TagListRelation>,
  ): Promise<Count> {
    return this.tagListRelationRepository.count(where);
  }

  @get('/tag-list-relations', {
    responses: {
      '200': {
        description: 'Array of TagListRelation model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(TagListRelation, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(TagListRelation) filter?: Filter<TagListRelation>,
  ): Promise<TagListRelation[]> {
    return this.tagListRelationRepository.find(filter);
  }

  @patch('/tag-list-relations', {
    responses: {
      '200': {
        description: 'TagListRelation PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(TagListRelation, {partial: true}),
        },
      },
    })
    tagListRelation: TagListRelation,
    @param.where(TagListRelation) where?: Where<TagListRelation>,
  ): Promise<Count> {
    return this.tagListRelationRepository.updateAll(tagListRelation, where);
  }

  @get('/tag-list-relations/{id}', {
    responses: {
      '200': {
        description: 'TagListRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(TagListRelation, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(TagListRelation, {exclude: 'where'}) filter?: FilterExcludingWhere<TagListRelation>
  ): Promise<TagListRelation> {
    return this.tagListRelationRepository.findById(id, filter);
  }

  @patch('/tag-list-relations/{id}', {
    responses: {
      '204': {
        description: 'TagListRelation PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(TagListRelation, {partial: true}),
        },
      },
    })
    tagListRelation: TagListRelation,
  ): Promise<void> {
    await this.tagListRelationRepository.updateById(id, tagListRelation);
  }

  @put('/tag-list-relations/{id}', {
    responses: {
      '204': {
        description: 'TagListRelation PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() tagListRelation: TagListRelation,
  ): Promise<void> {
    await this.tagListRelationRepository.replaceById(id, tagListRelation);
  }

  @del('/tag-list-relations/{id}', {
    responses: {
      '204': {
        description: 'TagListRelation DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.tagListRelationRepository.deleteById(id);
  }
}
