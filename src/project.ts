import {
  Field,
  Float32,
  RecordBatch,
  Schema,
  Struct,
  Table,
  Timestamp,
  Utf8,
  vectorFromArray,
} from 'apache-arrow';
import { tableToIPC, tableFromIPC } from 'apache-arrow';
import { BaseAtlasClass } from './user.js';
import { AtlasIndex } from './index.js';
import { AtlasViewer } from './viewer.js';
import { components } from './type-gen/openapi.js';
import { FullMapOptions, MapBuilder, SimpleMapOptions } from './map-builder.js';

type IndexCreateOptions = {
  project_id: string;
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
  project_id: string;
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
  id: string;

  /**
   *
   * @param id The project's unique UUID. To create a new project or fetch
   * an existing project, use the create_project or load_project functions.
   * @param user An existing AtlasUser object. If not provided, a new one will be created.
   *
   * @returns An AtlasDataset object.
   */
  constructor(id: string, viewer?: AtlasViewer) {
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

  async delete() {
    const value = await this.apiCall(`/v1/project/remove`, 'POST', {
      project_id: this.id,
    });
    return value;
  }

  protected endpoint() {
    return `/v1/project/${this.id}`;
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

  async loadSchema() {
    if (this.attr === undefined) {
      await this.fetchAttributes();
    }
    if (this.attr === undefined) {
      throw new Error('Attributes not found after fetching');
    }
    const base64Schema = this.attr.schema;
    if (!base64Schema) {
      return null;
    }
    const schemaBuffer = Buffer.from(base64Schema, 'base64');
    const array = new Uint8Array(schemaBuffer);
    const table = tableFromIPC(array);
    return table.schema;
  }

  async uploadData(
    data: Record<string, unknown> | Record<string, unknown>[]
  ): Promise<void> {
    const points = Array.isArray(data) ? data : [data];

    const schema = await this.loadSchema();

    const fields: Field[] = schema?.fields ?? [];

    if (fields.length === 0) {
      // If no schema, this is the first datapoint. We need to determine the right type
      // for each column given our constraints
      for (const key in points[0]) {
        const value =
          points.find((p) => p[key] != null)?.[key] ?? points[0][key];
        if (typeof value === 'string') {
          fields.push(new Field(key, new Utf8(), true));
        } else if (typeof value === 'number') {
          fields.push(new Field(key, new Float32(), true));
        } else if (typeof value === 'boolean') {
          fields.push(new Field(key, new Utf8(), true));
        } else if (value === null) {
          fields.push(new Field(key, new Utf8(), true));
        } else if (value instanceof Date) {
          fields.push(new Field(key, new Timestamp(1), true));
        } else if (typeof value === 'object') {
          fields.push(new Field(key, new Utf8(), true));
        } else if (Array.isArray(value)) {
          fields.push(new Field(key, new Utf8(), true));
        } else {
          fields.push(new Field(key, new Utf8(), true));
        }
      }
    }

    const vector = vectorFromArray(points, new Struct(fields));

    const table = new Table(
      vector.data.map(
        (batch) => new RecordBatch(new Schema(vector.type.children), batch)
      )
    );

    await this.uploadArrow(table);
  }

  async uploadArrow(table: Table | Uint8Array): Promise<void> {
    if (table instanceof Uint8Array) {
      table = tableFromIPC(table);
    }

    table.schema.metadata.set('project_id', this.id);
    table.schema.metadata.set('on_id_conflict_ignore', JSON.stringify(true));
    const data = tableToIPC(table, 'file');
    await this.apiCall(`/v1/project/data/add/arrow`, 'POST', data);
  }

  /**
   * Create a map on the dataset. This function specifies the basic
   * parameters for the map creation process, and uses recommended defaults.
   * For a more advanced map creation process, use `createMapFromResourceList`.
   * @param options Options for the map creation.
   * @returns The created resource.
   */
  async createMap(
    options: SimpleMapOptions | FullMapOptions
  ): Promise<components['schemas']['ResourceResponse']> {
    const mapBuilder = this.mapBuilder();
    mapBuilder.setMapOptions(options);
    return mapBuilder.buildMap();
  }

  /**
   * Get a MapBuilder object for this dataset.
   * @returns A MapBuilder object.
   */
  mapBuilder(): MapBuilder {
    return new MapBuilder(this);
  }
}
