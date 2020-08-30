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
import {List} from '../models';
import {ListRepository} from '../repositories';

export class ListController {
  constructor(
    @repository(ListRepository)
    public listRepository : ListRepository,
  ) {}

  @post('/lists', {
    responses: {
      '200': {
        description: 'List model instance',
        content: {'application/json': {schema: getModelSchemaRef(List)}},
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(List, {
            title: 'NewList',
            exclude: ['id'],
          }),
        },
      },
    })
    list: Omit<List, 'id'>,
  ): Promise<List> {
    return this.listRepository.create(list);
  }

  @get('/lists/count', {
    responses: {
      '200': {
        description: 'List model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(List) where?: Where<List>,
  ): Promise<Count> {
    return this.listRepository.count(where);
  }

  @get('/lists', {
    responses: {
      '200': {
        description: 'Array of List model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(List, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(List) filter?: Filter<List>,
  ): Promise<List[]> {
    return this.listRepository.find(filter);
  }

  @patch('/lists', {
    responses: {
      '200': {
        description: 'List PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(List, {partial: true}),
        },
      },
    })
    list: List,
    @param.where(List) where?: Where<List>,
  ): Promise<Count> {
    return this.listRepository.updateAll(list, where);
  }

  @get('/lists/{id}', {
    responses: {
      '200': {
        description: 'List model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(List, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(List, {exclude: 'where'}) filter?: FilterExcludingWhere<List>
  ): Promise<List> {
    return this.listRepository.findById(id, filter);
  }

  @patch('/lists/{id}', {
    responses: {
      '204': {
        description: 'List PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(List, {partial: true}),
        },
      },
    })
    list: List,
  ): Promise<void> {
    await this.listRepository.updateById(id, list);
  }

  @put('/lists/{id}', {
    responses: {
      '204': {
        description: 'List PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() list: List,
  ): Promise<void> {
    await this.listRepository.replaceById(id, list);
  }

  @del('/lists/{id}', {
    responses: {
      '204': {
        description: 'List DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.listRepository.deleteById(id);
  }
}
