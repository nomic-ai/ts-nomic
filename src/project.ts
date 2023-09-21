import { RecordBatch, Schema, Table } from 'apache-arrow';
import type { ApiCallOptions } from './user.js';
import { tableToIPC, tableFromJSON, tableFromIPC } from 'apache-arrow';
import { AtlasUser, get_env_user } from './user.js';
import { AtlasIndex } from './index.js';
// get the API key from the node environment
import { BaseAtlasClass } from './general.js';
import { OrganizationProjectInfo } from 'organization.js';
type UUID = string;

export function load_project(options: Atlas.LoadProjectOptions): AtlasProject {
  throw new Error('Not implemented');
}

type DataIngest = Record<string, string | number | Date> | Table;
type SingleEmbedding = Array<number>;
type EmbeddingMatrix = Array<SingleEmbedding>;
type TypedArrayEmbedding = Float32Array | Float64Array;
type EmbeddingType = EmbeddingMatrix | TypedArrayEmbedding;

interface AddDataOptions {
  data: DataIngest;
  embeddings?: EmbeddingType;
}

/**
 * An AtlasProject represents a single mutable dataset in Atlas. It provides an
 * interfaces to upload, update, and delete data, as well as create and delete
 * indices which handle specific views.
 */
export class AtlasProject extends BaseAtlasClass {
  _indices: AtlasIndex[] = [];
  _schema?: Schema | null;
  private _info?: Promise<Atlas.ProjectInfo>;
  id: UUID;

  /**
   *
   * @param id The project's unique UUID. To create a new project or fetch
   * an existing project, use the create_project or load_project functions.
   * @param user An existing AtlasUser object. If not provided, a new one will be created.
   *
   * @returns An AtlasProject object.
   */
  constructor(id: UUID, user?: AtlasUser) {
    super(user);
    // check if id is a valid UUID
    const uuid =
      /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/;
    if (!id.toLowerCase().match(uuid)) {
      throw new Error(`${id} is not a valid UUID.`);
    }
    this.id = id;
  }

  async apiCall(
    endpoint: string,
    method: 'GET' | 'POST',
    payload: Atlas.Payload = null,
    headers: null | Record<string, string> = null,
    options: ApiCallOptions = {}
  ) {
    const fixedEndpoint = await this._fixEndpointURL(endpoint);
    return this.user.apiCall(fixedEndpoint, method, payload, headers, options);
  }

  async delete() {
    const value = await this.apiCall(`/v1/project/remove`, 'POST', {
      project_id: this.id,
    });
    return value;
  }

  private clear() {
    this._info = undefined;
    this._schema = undefined;
    this._indices = [];
  }

  async wait_for_lock(): Promise<void> {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        // Create a new project to clear the cache.
        const renewed = new AtlasProject(this.id, this.user);
        const info = (await renewed.info()) as Atlas.ProjectInfo;
        if (info.insert_update_delete_lock === false) {
          clearInterval(interval);
          // Clear the cache.
          this.clear();
          resolve();
        }
      }, 2000);
    });
  }

  project_info() {
    throw new Error(`This method is deprecated. Use info() instead.`);
  }

  info() {
    if (this._info !== undefined) {
      return this._info;
    }
    // This call must be on the underlying user object, not the project object,
    // because otherwise it will infinitely in some downstream calls.

    // stored as a promise so that we don't make multiple calls to the server
    this._info = this.user
      // Try the public route first
      .apiCall(`/v1/project/${this.id}`, 'GET') as Promise<Atlas.ProjectInfo>;
    return this._info;
  }

  async _fixEndpointURL(endpoint: string): Promise<string> {
    // Don't mandate starting with a slash
    if (!endpoint.startsWith('/')) {
      console.warn(`DANGER: endpoint ${endpoint} doesn't start with a slash`);
      endpoint = '/' + endpoint;
    }
    return endpoint;
  }

  async indices(): Promise<AtlasIndex[]> {
    if (this._indices.length > 0) {
      return this._indices;
    }
    const { atlas_indices } = (await this.info()) as Atlas.ProjectInfo;
    console.log(await this.info(), atlas_indices, 'INFO');
    if (atlas_indices === undefined) {
      return [];
    }
    const options = { project: this };
    this._indices = atlas_indices.map(
      (d) => new AtlasIndex(d['id'], this.user, options)
    );
    return this._indices;
  }

  /**
   * Updates all indices associated with a project.
   *
   * @param rebuild_topic_models If true, rebuilds topic models for all indices.
   */
  async update_indices(rebuild_topic_models: boolean = false): Promise<void> {
    await this.apiCall(`/v1/project/update_indices`, 'POST', {
      project_id: this.id,
      rebuild_topic_models: rebuild_topic_models,
    });
  }

  async add_text(records: Record<string, string>[]): Promise<void> {
    const table = tableFromJSON(records);
    await this.uploadArrow(table);
  }

  async add_embeddings() {
    // TODO: implement
  }

  /**
   *
   * @param ids A list of identifiers to fetch from the server.
   */

  async fetch_ids(ids?: string[]): Promise<Record<string, any>[]> {
    throw new Error('Not implemented');
  }

  async createIndex(
    options: Omit<Atlas.IndexCreateOptions, 'project_id'>
  ): Promise<AtlasIndex> {
    let defaults = {
      project_id: this.id,
      index_name: 'Newz index',
      colorable_fields: [],
      nearest_neighbor_index: 'HNSWIndex',
      nearest_neighbor_index_hyperparameters: JSON.stringify({
        space: 'l2',
        ef_construction: 100,
        M: 16,
      }),
      projection: 'NomicProject',
      projection_hyperparameters: JSON.stringify({
        n_neighbors: 64,
        n_epochs: 64,
        spread: 3,
      }),
      topic_model_hyperparameters: JSON.stringify({ build_topic_model: false }),
    } as Record<string, any>;

    const text_defaults = {
      indexed_field: 'text',
      geometry_strategies: [['document']],
      atomizer_strategies: ['document', 'charchunk'],
      model_hyperparameters: JSON.stringify({
        dataset_buffer_size: 1000,
        batch_size: 20,
        polymerize_by: 'charchunk',
        norm: 'both',
      }),
      model: 'NomicEmbed', // options?.multilingual === true ? 'NomicEmbedMultilingual' : 'NomicEmbed',
    };

    const embedding_defaults = {
      model: null,
      atomizer_strategies: null,
      indexed_field: null,
    };
    if (options['indexed_field'] !== undefined) {
      defaults = {
        ...defaults,
        ...text_defaults,
      };
    } else {
      defaults = {
        ...defaults,
        ...embedding_defaults,
      };
    }

    const prefs = {
      ...defaults,
      ...options,
    } as unknown as Atlas.CreateAtlasIndexRequest;

    const response = await this.apiCall(
      '/v1/project/index/create',
      'POST',
      prefs
    );
    const id = response as string;
    return new AtlasIndex(id, this.user, { project: this });
  }

  async delete_data(ids: string[]): Promise<void> {
    // TODO: untested
    // const info = await this.info
    await this.user.apiCall('/v1/project/data/delete', 'POST', {
      project_id: this.id,
      datum_ids: ids,
    });
  }

  validate_metadata(): void {
    // validate metadata
  }

  /*  async create_projection(options: IndexCreateOptions) : Promise<AtlasProjection> {
    await 
  } */

  get schema() {
    if (this._schema === undefined) {
      // this.update_info()
    }
    return this._schema;
  }

  async uploadArrow(
    table: Table | Uint8Array,
    progressCallback: (successful: number, total: number) => any = (a, b) =>
      undefined
  ): Promise<void> {
    // if it's a Uint8Array, deserialize.
    if (table instanceof Uint8Array) {
      table = tableFromIPC(table);
    }

    const uploadBatch = async (batch: RecordBatch): Promise<any> => {
      const tb = new Table([batch]);
      console.log(tb.numRows, 'rows');
      tb.schema.metadata.set('project_id', this.id);
      tb.schema.metadata.set('on_id_conflict_ignore', JSON.stringify(true));
      const data = tableToIPC(tb, 'file');
      return this.apiCall(`/v1/project/data/add/arrow`, 'POST', data);
    };

    const MAX_CONCURRENT_UPLOADS = 8;
    let batches = [...table.batches];
    let activeUploads: Promise<any>[] = [];

    const total = batches.length;
    let complete = 0;
    while (batches.length || activeUploads.length) {
      while (activeUploads.length < MAX_CONCURRENT_UPLOADS && batches.length) {
        const batch = batches.shift();
        if (batch) {
          activeUploads.push(uploadBatch(batch));
        }
      }

      const finishedUploadIndex = await findIndexOfResolvedPromise(
        activeUploads
      );
      if (typeof finishedUploadIndex !== 'undefined') {
        activeUploads.splice(finishedUploadIndex, 1);
        complete++;
        progressCallback(complete, total);
      }
    }
  }

  /*
  async addData(options : AddDataOptions) : Promise<Response> {
    if (isRecordIngest(options.data)) {
      // convert to arrow
    }
    throw new Error("Not implemented")

    if (isEmbeddingType(options.embeddings)) {
      if (isEmbeddingMatrix(options.embeddings)) {
        // convert to typed array
      }
      // convert to arrow
    }
    if (this.schema === null) {
      // this._schema = table.schema;
    }
  }
  */
}

async function findIndexOfResolvedPromise(
  promises: Promise<any>[]
): Promise<number> {
  const indexedPromises = promises.map((p, index) => p.then(() => index));
  const finishedIndex = await Promise.race(indexedPromises);
  return finishedIndex;
}
