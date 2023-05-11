import type { Schema, Table } from 'apache-arrow'
import { tableToIPC } from 'apache-arrow';
import { AtlasUser, get_user } from './user'
import {AtlasIndex} from './index'
// get the API key from the node environment
import { BaseAtlasClass } from './general';
// import { isEmbeddingIndexOptions, isTextIndexOptions } from 'global';
type UUID = string;
import {components} from '../private/openapi.d'

export function load_project(options: Atlas.LoadProjectOptions) : AtlasProject {
    throw new Error("Not implemented")
} 

export async function create_project(options: Atlas.ProjectInitOptions) : Promise<AtlasProject> {
  const user = get_user();
    if (options.unique_id_field === undefined) {
      throw new Error("id_field is required")
    }
    if (options.project_name === undefined) {
      throw new Error("Project name is required")
    }
    if (options.organization_name === undefined) {
      options.organization_id = await user.info().then(d => d.organizations[0]['organization_id'])
      // Delete because this isn't allowed at the endpoint.
      delete options.organization_name
    } else {
      const info = await user.info()
      options.organization_id = info['organizations'].find(d => d.nickname === options.organization_name)!['organization_id']
      delete options.organization_name
    }
    options['modality'] = options['modality'] || "text"
    const response = await user.apiCall(`/v1/project/create`, "POST", options)
    if (response.status !== 201) {
      throw new Error(`Error ${response.status}, ${response.headers}, creating project: ${response.statusText}`)
    }
    const data = await response.json() as Atlas.ProjectInfo;
    return new AtlasProject(data['project_id'], user);
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
  //options: ProjectInitOptions;
  indices: AtlasIndex[] = [];
  _schema?: Schema | null;
  id: UUID;
  //info: Project;

  /**
   * 
   * @param id The project's unique UUID. To create a new project or fetch
   * an existing project, use the create_project or load_project functions.
   * @param user An existing AtlasUser object. If not provided, a new one will be created.
   * 
   * @returns An AtlasProject object.
  */

  constructor(id: UUID, user?: AtlasUser) {
    super(user)
    // check if id is a valid UUID
    const uuid = /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/
    if (!id.toLowerCase().match(uuid)) {
      throw new Error(`${id} is not a valid UUID.`)
    }    
    this.id = id;
  }

  apiCall(endpoint: string, method: "GET" | "POST", payload: Atlas.Payload = null, headers: null | Record<string, string> = null): Promise<Response> {
    return this.user.apiCall(endpoint, method, payload, headers)
  }
  
  async delete() : Promise<Response> {
    const value = await this.apiCall(`/v1/project/remove`, "POST", {'project_id': this.id})
    if (value.status !== 200) {
      throw new Error(`Error ${value.status}, ${value.headers}, deleting project: ${value.statusText}`)
    }
    return value
  }

  get info() : Promise<AtlasProject> {
    return this.apiCall(
      `/v1/project/${this.id}`, "GET"
    ).then(async d => {
      if (d.status !== 200) {
        const body = d.clone()
        console.error({body})
        throw new Error(`Error ${d.status}, ${d.headers}, fetching project info: ${d.statusText}`)
      }

      const value = await d.json()
      return value as AtlasProject;
    })
  }

  async update_indices(rebuild_topic_models: boolean = false) : Promise<void> {
    await this.apiCall(`/v1/project/update_indices`,
      "POST", {'project_id': this.id,
       'rebuild_topic_models': rebuild_topic_models
      })  
  }

  async add_text() {
    // TODO: implement
  }
  async add_embeddings() {
    // TODO: implement
  }

  /**
   * 
   * @param ids A list of identifiers to fetch from the server.
   */

  async fetch_ids(ids?: string[]) : Promise<Record<string, any>[]> {
    throw new Error("Not implemented")
  }

  async createIndex(options: Omit<Atlas.IndexCreateOptions, 'project_id'>) : Promise<AtlasIndex> {
    let defaults = {
      'project_id': this.id,
      index_name: "New index",
      colorable_fields: [],
      'nearest_neighbor_index': 'HNSWIndex',
      'nearest_neighbor_index_hyperparameters': JSON.stringify({'space': 'l2', 'ef_construction': 100, 'M': 16}),
      
      'projection': 'NomicProject',
      'projection_hyperparameters': JSON.stringify(
          {'n_neighbors': 64, 'n_epochs': 64, 'spread': 1}
      ),
      'topic_model_hyperparameters': JSON.stringify(
      {'build_topic_model': false})
    } as Record<string, any>;

    const text_defaults = {
      'indexed_field': 'text',
      'geometry_strategies': [['document']],
      'atomizer_strategies': ['document', 'charchunk'],
      'model_hyperparameters': JSON.stringify(
        {
            'dataset_buffer_size': 1000,
            'batch_size': 20,
            'polymerize_by': 'charchunk',
            'norm': 'both',
        }
      ),
      model: 'NomicEmbed'// options?.multilingual === true ? 'NomicEmbedMultilingual' : 'NomicEmbed',
    };

    const embedding_defaults = {
      "model": null,
      'atomizer_strategies': null,
      "indexed_field": null,
    } 
    if (options['indexed_field'] !== undefined) {
      defaults = {
        ...defaults,
        ...text_defaults,
      } 
    } else {
      defaults = {
        ...defaults,
        ...embedding_defaults,
      }
    }
    
    const prefs = {
      ...defaults,
      ...options
    } as components['schemas']['CreateAtlasIndexRequest']

    console.log({prefs})
    const response = await this.apiCall(
        "/v1/project/index/create",
        "POST",
        prefs)
    if (response.status !== 200) {
      throw new Error(`Error ${response.status}, ${response.headers}, creating index: ${response.statusText}`)
    }
    const id = await response.json() as string;
    console.log("ID IS", id)
    return new AtlasIndex(id, this.user)
  }

  async delete_data(ids: string[]) : Promise<void> {
    // TODO: untested
    const info = await this.info
    await this.user.apiCall(
      "/v1/project/data/delete",
      "POST",
      {'project_id': this.id, 'datum_ids': ids})
  }

  validate_metadata() : void {
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

  async uploadArrow(table: Table) : Promise<void> {
    table.schema.metadata.set('project_id', this.id)
    table.schema.metadata.set('on_id_conflict_ignore', JSON.stringify(true))
    const data = tableToIPC(table, "file")
    const response = await this.apiCall(`/v1/project/data/add/arrow`,
      "POST",
      data
    );

    if (response.status !== 200) {
      throw new Error(`Error ${response.status}, ${response.headers}, uploading data: ${response.statusText}`)
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

