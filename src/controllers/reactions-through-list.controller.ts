import { inject } from '@loopback/context';
import {
  Count,
  CountSchema,
  Filter,
  FilterBuilder,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { ListReaction, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
  ALWAYS_HIDDEN_FIELDS,
} from '../models/base-types/unmodifiable-common-fields';
import { CustomReactionThroughListRepository } from '../repositories/custom-reaction-through-list.repository';
import { LoggingService } from '../services/logging.service';

export class ReactionsThroughListController {
  constructor(
    @repository(CustomReactionThroughListRepository)
    protected reactionRepository: CustomReactionThroughListRepository,
    @inject('services.LoggingService')
    private logger: LoggingService,
  ) {}

  @get('/lists/{id}/reactions', {
    operationId: 'findReactionsByListId',
    responses: {
      '200': {
        description: 'Array of ListReaction model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(ListReaction, {
                includeRelations: true,
                exclude: [
                  '_relationMetadata',
                  ...(ALWAYS_HIDDEN_FIELDS as (keyof ListReaction)[]),
                ],
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
                error: getModelSchemaRef(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('filter') filter?: Filter<ListReaction>,
  ): Promise<ListReaction[]> {
    // Set the source list ID in the repository
    this.reactionRepository.sourceListId = id;

    if (set) {
      filter = new SetFilterBuilder<ListReaction>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    return this.reactionRepository.find(filter);
  }

  @post('/lists/{id}/reactions', {
    operationId: 'createReactionByListId',
    responses: {
      '200': {
        description: 'ListReaction model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(ListReaction, {
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof ListReaction)[],
            }),
          },
        },
      },
      '429': {
        description: 'List reaction limit is exceeded',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '409': {
        description: 'List reaction already exists.',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '422': {
        description: 'Unprocessable entity',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
      '404': {
        description: 'List not found',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListReaction, {
            title: 'NewListReactionByList',
            exclude: [
              ...UNMODIFIABLE_COMMON_FIELDS,
              '_listId',
            ] as (keyof ListReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    listReaction: Omit<ListReaction, UnmodifiableCommonFields | '_listId'>,
  ): Promise<ListReaction> {
    // Set the source list ID in the repository
    this.reactionRepository.sourceListId = id;

    return this.reactionRepository.create(listReaction);
  }

  @patch('/lists/{id}/reactions', {
    operationId: 'updateReactionsByListId',
    responses: {
      '200': {
        description: 'ListReaction PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
      '404': {
        description: 'List not found',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListReaction, {
            title: 'PartialListReaction',
            partial: true,
            exclude: [
              ...UNMODIFIABLE_COMMON_FIELDS,
              '_listId',
            ] as (keyof ListReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    listReaction: Omit<ListReaction, UnmodifiableCommonFields | '_listId'>,
    @param.query.object('set') set?: Set,
    @param.query.object('where') where?: Where<ListReaction>,
  ): Promise<Count> {
    // Set the source list ID in the repository
    this.reactionRepository.sourceListId = id;

    const filterBuilder = new FilterBuilder<ListReaction>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<ListReaction>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    return this.reactionRepository.updateAll(listReaction, filter.where);
  }

  @del('/lists/{id}/reactions', {
    operationId: 'deleteReactionsByListId',
    responses: {
      '200': {
        description: 'ListReaction DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
      '404': {
        description: 'List not found',
        content: {
          'application/json': {
            schema: getModelSchemaRef(HttpErrorResponse),
          },
        },
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('where') where?: Where<ListReaction>,
  ): Promise<Count> {
    // Set the source list ID in the repository
    this.reactionRepository.sourceListId = id;

    const filterBuilder = new FilterBuilder<ListReaction>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<ListReaction>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    return this.reactionRepository.deleteAll(filter.where);
  }
}
