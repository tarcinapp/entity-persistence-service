import {
  Count,
  CountSchema,
  Filter,
  FilterBuilder,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getJsonSchema,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  requestBody,
} from '@loopback/rest';
import { Set, SetFilterBuilder } from '../extensions';
import { processIncludes } from '../extensions/types/sets-in-inclusions';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { List, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
} from '../models/base-types/unmodifiable-common-fields';
import { ListRepository } from '../repositories';

export class GenericListController {
  constructor(
    @repository(ListRepository)
    public listRepository: ListRepository,
  ) {}

  @post('/lists', {
    responses: {
      '200': {
        description: 'List model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(List) },
        },
      },
      '429': {
        description: 'List limit is exceeded',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
      '409': {
        description: 'List name already exists.',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
    '422': {
      description: 'Unprocessable list',
      content: {
        'application/json': {
          schema: {
            properties: {
              error: getJsonSchema(HttpErrorResponse),
            },
          },
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(List, {
            title: 'NewList',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof List)[],
            includeRelations: false,
          }),
        },
      },
    })
    list: Omit<List, UnmodifiableCommonFields>,
  ): Promise<List> {
    return this.listRepository.create(list);
  }

  @get('/lists/count', {
    responses: {
      '200': {
        description: 'List model count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async count(
    @param.query.object('set') set?: Set,
    @param.where(List) where?: Where<List>,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<List>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<List>(set, {
        filter: filter,
      }).build();
    }

    return this.listRepository.count(filter.where);
  }

  @get('/lists', {
    responses: {
      '200': {
        description: 'Array of List model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(List, { includeRelations: true }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(List) filter?: Filter<List>,
    @param.query.object('set') set?: Set,
  ): Promise<List[]> {
    if (set) {
      filter = new SetFilterBuilder<List>(set, {
        filter: filter,
      }).build();
    }

    processIncludes<List>(filter);

    sanitizeFilterFields(filter);

    return this.listRepository.find(filter);
  }

  @patch('/lists', {
    responses: {
      '200': {
        description: 'List PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(List, {
            title: 'NewList',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof List)[],
            includeRelations: false,
          }),
        },
      },
    })
    list: Omit<List, UnmodifiableCommonFields>,
    @param.query.object('set') set?: Set,
    @param.where(List) where?: Where<List>,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<List>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<List>(set, {
        filter: filter,
      }).build();
    }

    return this.listRepository.updateAll(list, filter.where);
  }

  @get('/lists/{id}', {
    responses: {
      '200': {
        description: 'List model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(List, { includeRelations: true }),
          },
        },
      },
    },
    '404': {
      description: 'List not found',
      content: {
        'application/json': {
          schema: {
            properties: {
              error: getJsonSchema(HttpErrorResponse),
            },
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(List, { exclude: 'where' })
    filter?: FilterExcludingWhere<List>,
  ): Promise<List> {
    return this.listRepository.findById(id, filter);
  }

  @patch('/lists/{id}', {
    responses: {
      '204': {
        description: 'List PATCH success',
      },
      '404': {
        description: 'List not found',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
      '422': {
        description: 'Unprocessable list',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(List, {
            title: 'NewList',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof List)[],
            includeRelations: false,
          }),
        },
      },
    })
    list: Omit<List, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.listRepository.updateById(id, list);
  }

  @put('/lists/{id}', {
    responses: {
      '204': {
        description: 'List PUT success',
      },
      '404': {
        description: 'List not found',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
      '422': {
        description: 'Unprocessable list',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(List, {
            title: 'NewList',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof List)[],
            includeRelations: false,
          }),
        },
      },
    })
    list: Omit<List, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.listRepository.replaceById(id, list);
  }

  @del('/lists/{id}', {
    responses: {
      '204': {
        description: 'List DELETE success',
      },
      '404': {
        description: 'List not found',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.listRepository.deleteById(id);
  }
}
