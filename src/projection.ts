import { Schema, Type, tableFromIPC, tableToIPC } from 'apache-arrow';
import { BaseAtlasClass } from './user.js';
import type { AtlasUser } from './user.js';
import { AtlasDataset } from './project.js';
import type { AtlasIndex } from './index.js';
import { AtlasViewer } from './viewer.js';
import type { components } from './type-gen/openapi.js';

export type ProjectGetInfo = components['schemas']['Project'];

type UUID = string;

export type DeleteTagRequest = {
  tag_id: UUID;
};

/**
 * Options for initializing a projection.
 */
type ProjectionInitializationOptions = {
  // The project that this projection belongs to.
  project?: AtlasDataset;
  // The index that this projection belongs to.
  index?: AtlasIndex;
  // The project ID that this projection belongs to.
  project_id?: UUID;
  // The user object to query with.
  user?: AtlasUser;
};

type TagResponse = {
  tag_id: UUID;
  tag_definition_id: string;
  tag_name?: string;
  user_id?: string;
  dsl_rule?: string;
};

type TagComponent = Record<string, any>;
export type TagMaskOperation =
  | 'OR'
  | 'AND'
  | 'UPSERT'
  | 'NOOP'
  | 'ALLSET_TRUE'
  | 'ALLSET_FALSE';

type TagComposition =
  | TagComponent
  | ['OR' | 'AND' | 'NOT' | 'ANY' | 'ALL', ...TagComposition[]];

type TagRequestOptions = {
  tag_name: string;
  dsl_rule: TagComposition;
  tag_id: UUID;
};

type RoboTagOptions = {
  tag_id: UUID;
};

export type UpdateTagOptions =
  | {
      tag_id: UUID;
      dsl_rule: TagComposition;
      tag_definition_id: string;
      tag_name: never;
    }
  | {
      tag_id: UUID;
      tag_name: string;
      tag_definition_id: never;
      dsl_rule: never;
    };

export type UpdateTagMaskOptions = {
  tag_id: UUID;
  tag_definition_id: string;
  complete: boolean | undefined;
};

type CreateTagOptions = {
  tag_name: string;
  dsl_rule: TagComposition;
  tag_definition_id: string;
};

type TagDefinition = {
  tag_definition_id: string;
  dsl_json: string;
};

type TagStatus = {
  is_complete: boolean;
};

type DatasetIdResponse = {
  dataset_id: UUID;
  index_id: UUID;
};

export class AtlasProjection extends BaseAtlasClass<
  components['schemas']['ProjectionResponse']
> {
  /**
   * A projection is a map in Atlas; it represents a snapshot 2d view of a dataset
   * at a point in time. Every projection belongs to a Dataset.
   */
  _project?: AtlasDataset;
  protected project_id?: UUID;
  _project_id_promise?: Promise<UUID>;
  _index?: AtlasIndex;

  /**
   *
   * @param id The UUID of the projection to retrieve.
   * @param user The user object to query with.
   * @param options Options for initializing the projection.
   */
  constructor(
    public id: UUID,
    user?: AtlasUser | AtlasViewer,
    options: ProjectionInitializationOptions = {}
  ) {
    const { project, project_id } = options;
    super(user || project?.viewer);

    if (project_id !== undefined && project !== undefined) {
      throw new Error('project_id and project are mutually exclusive');
    }

    if (project_id !== undefined) {
      this.project_id = project_id;
    } else if (project !== undefined) {
      this.project_id = project!.id;
      this._project = project;
    }
    if (options.index) {
      this._index = options.index;
    }
  }

  /**
   * @returns the UUID of the dataset that this projection belongs to.
   */
  async datasetId(): Promise<UUID> {
    if (this.project_id !== undefined) {
      return this.project_id;
    }
    if (this._project !== undefined) {
      return this._project.id;
    }

    const endpoint = `/v1/project/projection/${this.id}/get/dataset_id`;

    if (this._project_id_promise !== undefined) {
      return this._project_id_promise;
    }

    this._project_id_promise = (
      this.apiCall(endpoint, 'GET') as Promise<DatasetIdResponse>
    ).then(
      // Assign it to the project id while returning.
      ({ dataset_id }) => {
        this.project_id = dataset_id;
        return dataset_id;
      }
    );

    return this._project_id_promise;
  }

  async createTag(options: CreateTagOptions): Promise<TagResponse> {
    const endpoint = '/v1/project/projection/tags/create';
    const { tag_name, dsl_rule, tag_definition_id } = options;

    if (tag_name === undefined) {
      throw new Error('tag_name is required');
    }

    if (dsl_rule === undefined) {
      throw new Error('dsl_rule is required');
    }
    const project_id = await this.datasetId();
    const data = {
      project_id: project_id,
      tag_name,
      dsl_rule: JSON.stringify(dsl_rule),
      projection_id: this.id,
      tag_definition_id,
    };

    const response = (await this.apiCall(
      endpoint,
      'POST',
      data
    )) as TagResponse;
    return response;
  }

  async updateTag(options: UpdateTagOptions): Promise<TagResponse> {
    const endpoint = '/v1/project/projection/tags/update';
    const { tag_name, dsl_rule, tag_id, tag_definition_id } = options;
    if (tag_id === undefined) {
      throw new Error('tag_id is required');
    }

    const dsl_json =
      dsl_rule === undefined ? undefined : JSON.stringify(dsl_rule);

    const request = {
      tag_id,
      tag_name,
      dsl_rule: dsl_json,
      tag_definition_id,
    };

    return this.apiCall(endpoint, 'POST', request) as Promise<TagResponse>;
  }

  async deleteTag(options: DeleteTagRequest): Promise<void> {
    const endpoint = '/v1/project/projection/tags/delete';
    const { tag_id } = options;
    if (tag_id === undefined) {
      throw new Error('tag_id is required');
    }
    const data = {
      project_id: await this.datasetId(),
      tag_id,
    };
    await this.apiCall(endpoint, 'POST', data);
  }

  async getTags(): Promise<Array<TagResponse>> {
    const endpoint = '/v1/project/projection/tags/get/all';
    const project_id = await this.datasetId();
    const params = new URLSearchParams({
      project_id: project_id,
      projection_id: this.id,
    }).toString();
    return this.apiCall(`${endpoint}?${params}`, 'GET') as Promise<
      Array<TagResponse>
    >;
  }

  async getTagStatus(options: TagRequestOptions): Promise<TagStatus> {
    const { tag_id } = options;
    if (tag_id === undefined) {
      throw new Error('tag_id is required');
    }
    const project_id = await this.datasetId();
    const endpoint = '/v1/project/projection/tags/status';
    const params = new URLSearchParams({
      project_id: project_id,
      tag_id,
    }).toString();
    return this.apiCall(`${endpoint}?${params}`, 'GET') as Promise<TagStatus>;
  }

  async updateTagMask(
    bitmask_bytes: Uint8Array,
    options: UpdateTagMaskOptions
  ): Promise<void> {
    const endpoint = '/v1/project/projection/tags/update/mask';
    const { tag_id, tag_definition_id, complete } = options;
    const project_id = await this.datasetId();

    // Upsert tag mask with tag definition id
    let post_tag_definition_id = tag_definition_id;

    if (tag_definition_id === undefined) {
      throw new Error('tag_definition_id or dsl_rule is required');
    }

    // Deserialize the bitmask
    const bitmask = tableFromIPC(bitmask_bytes);

    bitmask.schema.metadata.set('tag_id', tag_id as string);
    bitmask.schema.metadata.set('project_id', project_id);
    bitmask.schema.metadata.set(
      'tag_definition_id',
      post_tag_definition_id as string
    );
    bitmask.schema.metadata.set('complete', JSON.stringify(!!complete));
    const fields = bitmask.schema.fields;
    const bitmask_column = fields.find((f) => f.name === 'bitmask');
    if (!bitmask_column || bitmask_column.type.id === Type.List) {
      throw new Error('bitmask column of type list not found');
    }

    if (bitmask_column.type.children[0].typeId !== Type.Bool) {
      throw new Error('bitmask column of type list<bool> not found');
    }

    const serialized = tableToIPC(bitmask, 'file');
    await this.apiCall(endpoint, 'POST', serialized);
  }

  async roboTag(options: RoboTagOptions): Promise<void> {
    const { tag_id } = options;
    const request = {
      tag_id,
      project_id: await this.datasetId(),
    };
    const endpoint = '/v1/project/projection/tags/robotag';
    await this.apiCall(endpoint, 'POST', request);
  }

  _schema: Uint8Array | null = null;

  async schema(): Promise<Uint8Array> {
    // Returns a uint8 view of
    if (this._schema !== null) {
      return this._schema;
    }
    const schema = await this.apiCall(
      `/v1/project/projection/${this.id}/schema`,
      'GET'
    );
    this._schema = schema as Uint8Array;
    return this._schema;
  }

  async project(): Promise<AtlasDataset> {
    if (this._project === undefined) {
      const project_id = await this.datasetId();
      this._project = new AtlasDataset(project_id, this.viewer);
    }
    return this._project;
  }

  async index(): Promise<AtlasIndex> {
    if (this._index) {
      return this._index;
    }
    const indices = await this.project().then((d) => d.indices());
    for (let index of indices) {
      for (let projection of await index.projections()) {
        if (projection.id === this.id) {
          this._index = index;
          return index;
        }
      }
    }
    throw new Error('Could not find index for projection');
  }

  async atomInformation(ids: string[] | number[] | bigint[]) {
    const index = await this.index();
    return index.atomInformation(ids);
  }

  /**
   * @returns the URL for the quadtree root for this projection.
   * 'public' may be be added in fetching.
   */
  get quadtree_root(): string {
    if (this.project_id === undefined) {
      throw new Error('project_id is undefined. Fetch project_id first.');
    }
    const protocol = this.viewer.apiLocation.startsWith('localhost')
      ? 'http'
      : 'https';
    return `${protocol}://${this.viewer.apiLocation}/v1/project/${this.project_id}/index/projection/${this.id}/quadtree`;
  }

  protected endpoint() {
    if (this.project_id === undefined) {
      throw new Error('project_id is undefined. Fetch project_id first.');
    }
    return `/v1/project/${this.project_id}/index/projection/${this.id}`;
  }

  /**
   *
   * @param param0 an object with keys k (number of numbers) and queries (list of vectors, where each one is the length of the embedding space).
   * @returns A list of entries in sorted order, where each entry is a list of neighbors including distances in the `_distance` field.
   */
  async nearest_neighbors_by_vector({
    k = 10,
    queries,
  }: Omit<
    components['schemas']['EmbeddingNeighborRequest'],
    'atlas_index_id'
  >): Promise<Record<string, any>> {
    const index = await this.index();
    const { neighbors, distances } = await index.nearest_neighbors_by_vector({
      k,
      queries,
    });
    const project = await this.project();
    const datums = (await Promise.all(
      neighbors.map((ids) => project.fetch_ids(ids).then((d) => d.datums))
    )) as Record<string, any>[][];
    const filled_out: Record<string, any>[][] = [];
    for (let i = 0; i < neighbors.length; i++) {
      filled_out[i] = [];
      for (let j = 0; j < neighbors[i].length; j++) {
        const d = { ...datums[i][j] };
        d._distance = distances[i][j];
        filled_out[i].push(d);
      }
    }

    return filled_out;
  }
}
