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
import {Relation} from '../models';
import {RelationRepository} from '../repositories';

export class RelationController {
  constructor(
    @repository(RelationRepository)
    public relationRepository : RelationRepository,
  ) {}

  @post('/relations', {
    responses: {
      '200': {
        description: 'Relation model instance',
        content: {'application/json': {schema: getModelSchemaRef(Relation)}},
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Relation, {
            title: 'NewRelation',
            exclude: ['id'],
          }),
        },
      },
    })
    relation: Omit<Relation, 'id'>,
  ): Promise<Relation> {
    return this.relationRepository.create(relation);
  }

  @get('/relations/count', {
    responses: {
      '200': {
        description: 'Relation model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(Relation) where?: Where<Relation>,
  ): Promise<Count> {
    return this.relationRepository.count(where);
  }

  @get('/relations', {
    responses: {
      '200': {
        description: 'Array of Relation model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(Relation, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(Relation) filter?: Filter<Relation>,
  ): Promise<Relation[]> {
    return this.relationRepository.find(filter);
  }

  @patch('/relations', {
    responses: {
      '200': {
        description: 'Relation PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Relation, {partial: true}),
        },
      },
    })
    relation: Relation,
    @param.where(Relation) where?: Where<Relation>,
  ): Promise<Count> {
    return this.relationRepository.updateAll(relation, where);
  }

  @get('/relations/{id}', {
    responses: {
      '200': {
        description: 'Relation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Relation, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Relation, {exclude: 'where'}) filter?: FilterExcludingWhere<Relation>
  ): Promise<Relation> {
    return this.relationRepository.findById(id, filter);
  }

  @patch('/relations/{id}', {
    responses: {
      '204': {
        description: 'Relation PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Relation, {partial: true}),
        },
      },
    })
    relation: Relation,
  ): Promise<void> {
    await this.relationRepository.updateById(id, relation);
  }

  @put('/relations/{id}', {
    responses: {
      '204': {
        description: 'Relation PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() relation: Relation,
  ): Promise<void> {
    await this.relationRepository.replaceById(id, relation);
  }

  @del('/relations/{id}', {
    responses: {
      '204': {
        description: 'Relation DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.relationRepository.deleteById(id);
  }
}
