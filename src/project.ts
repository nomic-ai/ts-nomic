import type { Schema, Table } from 'apache-arrow';
import { tableToIPC, tableFromJSON, tableFromIPC } from 'apache-arrow';
import { BaseAtlasClass } from './user.js';
import { AtlasIndex } from './index.js';
import { AtlasViewer } from './viewer.js';
import * as Atlas from './global.js';
import { components } from './type-gen/openapi.js';
// get the API key from the node environment
type UUID = string;

export function load_project(options: Atlas.LoadProjectOptions): AtlasDataset {
  throw new Error('Not implemented');
}

type DataIngest = Record<string, string | number | Date> | Table;
type SingleEmbedding = Array<number>;
type EmbeddingMatrix = Array<SingleEmbedding>;
type TypedArrayEmbedding = Float32Array | Float64Array;
type EmbeddingType = EmbeddingMatrix | TypedArrayEmbedding;

type IndexCreateOptions = {
  project_id: UUID;
  index_name: string;
  indexed_field?: string;
  colorable_fields?: string[];
  multilingual?: boolean;
  build_topic_model?: boolean;
  topic_label_field?: string;
  duplicate_detection?: boolean;
};

type GeometryStrategy = 'document';
type AtomizerStrategy = 'document' | 'charchunk';
type Model = 'NomicEmbed' | 'NomicEmbedMultilingual';
type NNIndex = 'HNSWIndex';
type ProjectionType = 'NomicProject';

type CreateAtlasIndexRequest = {
  project_id: UUID;
  index_name: string;
  indexed_field: string | null;
  colorable_fields: string[];
  atomizer_strategies: AtomizerStrategy[] | null;
  geometry_strategies: GeometryStrategy[][] | null;
  model: Model | null;
  model_hyperparameters: string | null;
  nearest_neighbor_index: NNIndex;
  nearest_neighbor_index_hyperparameters: string;
  projection: ProjectionType;
  projection_hyperparameters: string;
  topic_model_hyperparameters: string;
  duplicate_detection_hyperparameters: string | null;
};

const createIndexTextDefaults: Omit<
  components['schemas']['CreateAtlasIndexRequest'],
  'project_id'
> = {
  index_name: 'New index',
  indexed_field: 'document', // nb upstream types are vague here.
  colorable_fields: [],
  atomizer_strategies: ['document', 'charchunk'],
  geometry_strategies: [['document']],
  model: 'nomic-embed-text-v1.5',
  model_hyperparameters: JSON.stringify({
    dataset_buffer_size: 1000,
    batch_size: 20,
    polymerize_by: 'charchunk',
    norm: 'both',
  }),
  nearest_neighbor_index: 'HNSWIndex',
  nearest_neighbor_index_hyperparameters: JSON.stringify({
    space: 'l2',
    ef_construction: 100,
    M: 16,
  }),
  projection: 'NomicProject',
  projection_hyperparameters: JSON.stringify({
    n_neighbors: 15,
    n_epochs: 50,
    spread: 1,
  }),
  topic_model_hyperparameters: JSON.stringify({
    build_topic_model: true,
    community_description_target_field: null,
    cluster_method: 'fast',
    enforce_topic_hierarchy: false,
  }),
  duplicate_detection_hyperparameters: JSON.stringify({
    tag_duplicates: false,
    duplicate_cutoff: 0.1,
  }),
};

/**
 * An AtlasDataset represents a single mutable dataset in Atlas. It provides an
 * interfaces to upload, update, and delete data, as well as create and delete
 * indices which handle specific views.
 */
export class AtlasDataset extends BaseAtlasClass<
  components['schemas']['Project']
> {
  _indices: AtlasIndex[] = [];
  _schema?: Schema | null;
  id: UUID;

  /**
   *
   * @param id The project's unique UUID. To create a new project or fetch
   * an existing project, use the create_project or load_project functions.
   * @param user An existing AtlasUser object. If not provided, a new one will be created.
   *
   * @returns An AtlasDataset object.
   */
  constructor(id: UUID | string, viewer?: AtlasViewer) {
    super(viewer);
    // check if id is a valid UUID

    const uuidPattern =
      /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/;
    this.id = id;
    if (!id.toLowerCase().match(uuidPattern)) {
      // throw new Error(`${id} is not a valid UUID.`);
      this.id = id;
      this.fetchAttributes().then((i) => (this.id = i.id));
    }
  }

  /**
   *
   * @returns A list of projection summaries, sorted so that the first is
   * the most useable (defined as ready and newest)
   */
  public async projectionSummaries() {
    const projections = [];
    const info = await this.fetchAttributes();
    for (const index of info.atlas_indices) {
      for (const projection of index.projections) {
        projections.push(projection);
      }
    }
    // sort from newest to oldest
    // Put ready projections first
    projections.sort((a, b) => {
      if (a.ready && !b.ready) return -1;
      if (!a.ready && b.ready) return 1;
      return (
        new Date(b.created_timestamp).getTime() -
        new Date(a.created_timestamp).getTime()
      );
    });
    return projections;
  }

  async delete() {
    const value = await this.apiCall(`/v1/project/remove`, 'POST', {
      project_id: this.id,
    });
    return value;
  }

  private clear() {
    this.attributePromise = undefined;
    this._schema = undefined;
    this._indices = [];
  }

  async wait_for_lock(): Promise<void> {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        // Create a new project to clear the cache.

        const renewed = new AtlasDataset(this.id, this.viewer);
        const info = await renewed.fetchAttributes();
        if (info.insert_update_delete_lock === false) {
          clearInterval(interval);
          // Clear the cache.
          this.clear();
          resolve();
        }
      }, 2000);
    });
  }

  protected endpoint() {
    return `/v1/project/${this.id}`;
  }

  async indices(): Promise<AtlasIndex[]> {
    if (this._indices.length > 0) {
      return this._indices;
    }
    const { atlas_indices } = await this.fetchAttributes();

    if (atlas_indices === undefined) {
      return [];
    }
    const options = { project: this };
    this._indices = atlas_indices.map(
      (d) => new AtlasIndex(d['id'], this.viewer, options)
    );
    return this._indices;
  }

  /**
   * Updates all indices associated with a project.
   *
   * @param rebuild_topic_models If true, rebuilds topic models for all indices.
   */
  async update_indices(rebuild_topic_models: boolean = false): Promise<void> {
    throw new Error(
      'Update_indices has been deprecated: please run `createIndex` on an existing project instead.'
    );
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

  async fetch_ids(
    ids?: string[]
  ): Promise<Record<string, Record<string, any>>> {
    if (ids === undefined) {
      return {};
    }
    const response = await this.apiCall(
      '/v1/project/data/get',
      'POST',
      { project_id: this.id, datum_ids: ids },
      null
    );
    return response as Record<string, Record<string, any>>;
  }

  /**
   * This should be preferred over createIndex, as it uses the actual
   * up-to-date types. Note that it is definitely possible to pass a
   * malformed but type-compliant object. (E.g., specifying no embedding field
   * but also specifying a model.)
   *
   * @param options See types for options.
   * @returns an AtlasIndex object based on the new arguments.
   */
  async createIndexRaw(
    options: Partial<components['schemas']['CreateAtlasIndexRequest']> & {
      indexed_field: string;
    }
  ): Promise<AtlasIndex> {
    // The default options for this request are very long, so we use them.
    // Then we override them with the user's options, and finally guarantee
    // that the project_id is set.

    const fields: components['schemas']['CreateAtlasIndexRequest'] = {
      ...createIndexTextDefaults,
      ...options,
      project_id: this.id,
    };

    const response = await this.apiCall(
      '/v1/project/index/create',
      'POST',
      fields
    );
    const id = response as string;
    return new AtlasIndex(id, this.viewer, { project: this });
  }

  /**
   * Prefer createIndexRaw, which has better syncing of types
   * @deprecated
   * @param options
   * @returns
   */
  async createIndex(
    options: Omit<IndexCreateOptions, 'project_id'>
  ): Promise<AtlasIndex> {
    const info = await this.fetchAttributes();
    const isText = info.modality === 'text';

    const fields: CreateAtlasIndexRequest = {
      project_id: this.id,
      index_name: options.index_name ?? 'New index',
      indexed_field: options.indexed_field ?? null,
      colorable_fields: options.colorable_fields ?? [],
      atomizer_strategies: isText ? ['document', 'charchunk'] : null,
      geometry_strategies: isText ? [['document']] : null,
      model: isText
        ? options.multilingual
          ? 'NomicEmbedMultilingual'
          : 'NomicEmbed'
        : null,
      model_hyperparameters: isText
        ? JSON.stringify({
            dataset_buffer_size: 1000,
            batch_size: 20,
            polymerize_by: 'charchunk',
            norm: 'both',
          })
        : null,
      nearest_neighbor_index: 'HNSWIndex',
      nearest_neighbor_index_hyperparameters: JSON.stringify({
        space: 'l2',
        ef_construction: 100,
        M: 16,
      }),
      projection: 'NomicProject',
      projection_hyperparameters: JSON.stringify({
        n_neighbors: 15,
        n_epochs: 50,
        spread: 1,
      }),
      topic_model_hyperparameters: JSON.stringify({
        build_topic_model: options.build_topic_model ?? false,
        community_description_target_field: options.topic_label_field ?? null,
        cluster_method: 'fast',
        enforce_topic_hierarchy: false,
      }),
      duplicate_detection_hyperparameters: isText
        ? JSON.stringify({
            tag_duplicates: options.duplicate_detection ?? false,
            duplicate_cutoff: 0.1,
          })
        : null,
    };

    const response = await this.apiCall(
      '/v1/project/index/create',
      'POST',
      fields
    );
    const id = response as string;
    return new AtlasIndex(id, this.viewer, { project: this });
  }

  async delete_data(ids: string[]): Promise<void> {
    // TODO: untested
    // const info = await this.info
    await this.viewer.apiCall('/v1/project/data/delete', 'POST', {
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

  async uploadArrow(table: Table | Uint8Array): Promise<void> {
    if (table instanceof Uint8Array) {
      table = tableFromIPC(table);
    }

    table.schema.metadata.set('project_id', this.id);
    table.schema.metadata.set('on_id_conflict_ignore', JSON.stringify(true));
    table.schema.metadata.set('num_rows', table.numRows.toString());
    const data = tableToIPC(table, 'file');
    await this.multipartUpload(data);
  }

  async multipartUpload(ipcBytes: Uint8Array) {
    const startResponse = (await this.apiCall(
      `/v1/project/${this.id}/data/upload/start`,
      'POST',
      {
        file_type: 'feather',
        file_size: ipcBytes.length,
      }
    )) as {
      part_urls: Array<{ part_number: number; url: string }>;
      upload_id: string;
      object_id: string;
    };

    if (!startResponse) {
      throw new Error('Failed to start multipart upload');
    }

    const { part_urls, upload_id, object_id } = startResponse;
    const partSize = 16 * 1024 * 1024; // 16MB parts
    const partResults: Array<{
      part_number: number;
      etag: string;
      url: string;
    }> = [];
    let failedReqs = 0;
    const maxRetries = 10;
    let nextPartIndex = 0;

    const uploadPart = async (partInfo: {
      part_number: number;
      url: string;
    }) => {
      const { part_number, url } = partInfo;
      const start = (part_number - 1) * partSize;
      const end = Math.min(start + partSize, ipcBytes.length);
      const partData = ipcBytes.slice(start, end);

      try {
        const response = await fetch(url, {
          method: 'PUT',
          body: partData,
        });

        if (!response.ok) {
          throw new Error(`Part upload failed: ${await response.text()}`);
        }

        return {
          part_number,
          etag:
            response.headers.get('ETag') ||
            (() => {
              throw new Error(
                `Missing ETag header in response for part ${part_number}`
              );
            })(),
          url,
        };
      } catch (error) {
        console.error(`Failed to upload part ${part_number}:`, error);
        throw error;
      }
    };

    const do_work = async () => {
      while (true) {
        // Atomically get next part index
        const currentIndex = nextPartIndex++;
        if (currentIndex >= part_urls.length) break;

        const partUrl = part_urls[currentIndex];
        let success = false;
        let attempts = 0;

        while (!success && attempts < maxRetries) {
          try {
            const result = await uploadPart(partUrl);
            partResults[currentIndex] = result; // Store in correct position
            success = true;
          } catch (error) {
            attempts++;
            failedReqs++;
            if (failedReqs >= maxRetries) {
              throw new Error(
                'Too many upload requests have failed. Please try again later.'
              );
            }
            // Linear backoff.
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * attempts)
            );
          }
        }
      }
    };

    // Two concurrent workers, hard_coded.
    await Promise.all([do_work(), do_work()]);

    const completeResponse = await this.apiCall(
      `/v1/project/${this.id}/data/upload/complete`,
      'POST',
      {
        upload_id,
        object_id,
        part_etags: partResults,
        file_type: 'feather',
      }
    );

    if (!completeResponse) {
      throw new Error('Failed to complete multipart upload');
    }

    if (failedReqs > 0) {
      console.warn(`Upload completed with ${failedReqs} retried parts`);
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
