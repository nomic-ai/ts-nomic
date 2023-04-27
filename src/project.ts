import type { Schema, Table } from 'apache-arrow'
import { AtlasUser, get_user } from './user'
import AtlasIndex from './index'
// get the API key from the node environment
import { BaseAtlasClass } from './general';
import type { Response } from 'node-fetch';
type UUID = string;


export function get_project(options: LoadProjectOptions) : AtlasProject {
    throw new Error("Not implemented")
} 

export async function create_project(options: ProjectInitOptions) : Promise<AtlasProject> {
  const user = get_user();
    if (options.unique_id_field === undefined) {
      throw new Error("id_field is required")
    }
    if (options.project_name === undefined) {
      throw new Error("name is required")
    }
    if (options.organization_name === undefined) {
      options.organization_id = await user.info().then(d => d.organizations[0]['organization_id'])
      // Delete because this isn't allowed at the endpoint.
      delete options.organization_name
    } else {
      const info = await user.info()
      options.organization_id = info['organizations'].find(d => d.nickname === options.organization_name)['organization_id']
    }
    options['is_public'] = options['is_public'] || false
    options['modality'] = options['modality'] || "text"
    const response = await user.apiCall(`/v1/project/create`, "POST", options)
    if (response.status !== 201) {
      throw new Error(`Error ${response.status}, ${response.headers}, creating project: ${response.statusText}`)
    }
    const data = await response.json() as ProjectInfo;
    return new AtlasProject(data['project_id'], user);
  }

type DataIngest = Record<string, string | number | Date> | Table;
type SingleEmbedding = Array<number>;
type EmbeddingMatrix = Array<SingleEmbedding>;
type TypedArrayEmbedding = Float32Array | Float64Array;

type ProjectInfo = {
  id: UUID;
}

type EmbeddingType = EmbeddingMatrix | TypedArrayEmbedding;

interface AddDataOptions {
  data: DataIngest;
  embeddings?: EmbeddingType;
}

class AtlasProjection {
  id: UUID;
  constructor(id: UUID) {
    this.id = id;
  }
}


export class AtlasProject extends BaseAtlasClass {
  //options: ProjectInitOptions;
  indices: AtlasIndex[] = [];
  _schema?: Schema | null;
  id: UUID;
  //info: ProjectInfo;

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

  apiCall(endpoint: string, method: "GET" | "POST", options: FetchOptions = null, headers: null | Record<string, string> = null): Promise<Response> {
    return this.user.apiCall(endpoint, method, options, headers)
  }
  
  async delete() : Promise<Response> {
    return this.apiCall(`/v1/project/remove`, "POST", {'project_id': this.id})
  }

  get info() : Promise<ProjectInfo> {
    return this.apiCall(
      `/v1/project/${this.id}`, "GET"
    ).then(async d => {
      if (d.status !== 200) {
        const body = d.clone()
        console.error({body})
        throw new Error(`Error ${d.status}, ${d.headers}, fetching project info: ${d.statusText}`)
      }

      const value = await d.json()
      return value as ProjectInfo
    })
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

  private async uploadArrow(table: Table) : Promise<void> {
    // upload arrow to the server
  }

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

}

