import { inject } from '@loopback/context';
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
  Request,
  RestBindings,
} from '@loopback/rest';
import { Set, SetFilterBuilder } from '../extensions';
import { processIncludes } from '../extensions/types/sets-in-inclusions';
import { processLookups } from '../extensions/types/sets-in-lookups';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { List, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
  ALWAYS_HIDDEN_FIELDS,
} from '../models/base-types/unmodifiable-common-fields';
import { getFilterSchemaFor } from '../openapi/filter-schemas';
import { ListRepository } from '../repositories';
import { LoggingService } from '../services/logging.service';

export class ListsController {
  constructor(
    @repository(ListRepository)
    public listRepository: ListRepository,
    @inject('services.LoggingService')
    private loggingService: LoggingService,
    @inject(RestBindings.Http.REQUEST)
    private request: Request,
  ) {}

  @post('/lists', {
    responses: {
      '200': {
        description: 'List model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(List, {
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof List)[],
            }),
          },
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
        description: 'List already exists.',
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
              items: getModelSchemaRef(List, {
                includeRelations: true,
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof List)[],
              }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.query.object('set') set?: Set,
    @param.query.object('filter', getFilterSchemaFor(List))
    filter?: Filter<List>,
  ): Promise<List[]> {
    if (set) {
      filter = new SetFilterBuilder<List>(set, {
        filter: filter,
      }).build();
    }

    processIncludes<List>(filter);
    processLookups<List>(filter);
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
            title: 'PartialList',
            partial: true,
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
            schema: getModelSchemaRef(List, {
              includeRelations: true,
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof List)[],
            }),
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
    @param.query.object('filter', getFilterSchemaFor(List))
    filter?: FilterExcludingWhere<List>,
  ): Promise<List> {
    // Process includes to handle relation-specific filtering:
    // 1. setThrough - Apply sets to filter the relation records themselves
    //    e.g., ?filter[include][0][relation]=_entities&filter[include][0][setThrough][actives]
    //    This will return only relations that are active, not the entities or lists
    // 2. whereThrough - Apply where conditions to filter the relation records
    //    e.g., ?filter[include][0][relation]=_entities&filter[include][0][whereThrough][foo]=bar
    //    This filters the relations themselves, not the entities or lists
    processIncludes<List>(filter);
    processLookups<List>(filter);
    sanitizeFilterFields(filter);

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
            title: 'PartialList',
            partial: true,
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

  @post('/lists/{id}/children', {
    responses: {
      '200': {
        description: 'Child List model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(List, {
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof List)[],
            }),
          },
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
      '404': {
        description: 'Parent list not found',
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
  async createChild(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(List, {
            title: 'NewChildList',
            exclude: [
              ...UNMODIFIABLE_COMMON_FIELDS,
              '_parents',
            ] as (keyof List)[],
            includeRelations: false,
          }),
        },
      },
    })
    list: Omit<List, UnmodifiableCommonFields | '_parents'>,
  ): Promise<List> {
    return this.listRepository.createChild(id, list);
  }

  @get('/lists/{id}/parents', {
    responses: {
      '200': {
        description: 'Array of parent List model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(List, {
                includeRelations: true,
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof List)[],
              }),
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
    },
  })
  async findParents(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('filter', getFilterSchemaFor(List))
    filter?: Filter<List>,
  ): Promise<List[]> {
    if (set) {
      filter = new SetFilterBuilder<List>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);
    processIncludes<List>(filter);
    processLookups<List>(filter);

    return this.listRepository.findParents(id, filter);
  }

  @get('/lists/{id}/children', {
    responses: {
      '200': {
        description: 'Array of child List model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(List, {
                includeRelations: true,
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof List)[],
              }),
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
    },
  })
  async findChildren(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('filter', getFilterSchemaFor(List))
    filter?: Filter<List>,
  ): Promise<List[]> {
    if (set) {
      filter = new SetFilterBuilder<List>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);
    processIncludes<List>(filter);
    processLookups<List>(filter);

    return this.listRepository.findChildren(id, filter);
  }
}
