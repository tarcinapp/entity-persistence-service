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
import { GenericList, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
} from '../models/base-types/unmodifiable-common-fields';
import { GenericListRepository } from '../repositories';

export class GenericListController {
  constructor(
    @repository(GenericListRepository)
    public genericListRepository: GenericListRepository,
  ) {}

  @post('/lists', {
    responses: {
      '200': {
        description: 'List model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(GenericList) },
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
          schema: getModelSchemaRef(GenericList, {
            title: 'NewList',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericList)[],
            includeRelations: false,
          }),
        },
      },
    })
    list: Omit<GenericList, UnmodifiableCommonFields>,
  ): Promise<GenericList> {
    return this.genericListRepository.create(list);
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
    @param.where(GenericList) where?: Where<GenericList>,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<GenericList>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<GenericList>(set, {
        filter: filter,
      }).build();
    }

    return this.genericListRepository.count(filter.where);
  }

  @get('/lists', {
    responses: {
      '200': {
        description: 'Array of List model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(GenericList, { includeRelations: true }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(GenericList) filter?: Filter<GenericList>,
    @param.query.object('set') set?: Set,
  ): Promise<GenericList[]> {
    if (set) {
      filter = new SetFilterBuilder<GenericList>(set, {
        filter: filter,
      }).build();
    }

    processIncludes<GenericList>(filter);

    sanitizeFilterFields(filter);

    return this.genericListRepository.find(filter);
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
          schema: getModelSchemaRef(GenericList, {
            title: 'NewList',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericList)[],
            includeRelations: false,
          }),
        },
      },
    })
    list: Omit<GenericList, UnmodifiableCommonFields>,
    @param.query.object('set') set?: Set,
    @param.where(GenericList) where?: Where<GenericList>,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<GenericList>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<GenericList>(set, {
        filter: filter,
      }).build();
    }

    return this.genericListRepository.updateAll(list, filter.where);
  }

  @get('/lists/{id}', {
    responses: {
      '200': {
        description: 'List model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(GenericList, { includeRelations: true }),
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
    @param.filter(GenericList, { exclude: 'where' })
    filter?: FilterExcludingWhere<GenericList>,
  ): Promise<GenericList> {
    return this.genericListRepository.findById(id, filter);
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
          schema: getModelSchemaRef(GenericList, {
            title: 'NewList',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericList)[],
            includeRelations: false,
          }),
        },
      },
    })
    list: Omit<GenericList, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.genericListRepository.updateById(id, list);
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
          schema: getModelSchemaRef(GenericList, {
            title: 'NewList',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericList)[],
            includeRelations: false,
          }),
        },
      },
    })
    list: Omit<GenericList, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.genericListRepository.replaceById(id, list);
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
    await this.genericListRepository.deleteById(id);
  }
}
