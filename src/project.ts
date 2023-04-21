import type { Schema, Table } from 'apache-arrow'
import { AtlasUser, get_user } from './user'
// get the API key from the node environment


type UUID = string;

type ProjectInitOptions = {
  name: string;
  description?: string;
  id: string;
  modality: string;
}

type LoadProjectByName = {
  name: string;
}

type typeLoadProjectById = {
  id: UUID;
}

type LoadProjectOptions = LoadProjectByName | typeLoadProjectById;

type TextIndexOptions = {
  indexed_field: string;
}

type EmbeddingIndexOptions = {

}

type IndexCreateOptions = TextIndexOptions | EmbeddingIndexOptions;

// returns any concrete type that extends AtlasProject

export function get_project(options: LoadProjectOptions) : AtlasProject {
   
} 

export function create_project(LoadProjectOptions) {

}

type DataIngest = Record<string, string | number | Date> | Table;
type SingleEmbedding = Array<number>;
type EmbeddingMatrix = Array<SingleEmbedding>;
type TypedArrayEmbedding = Float32Array | Float64Array;

function isSingleEmbedding(value: any): value is SingleEmbedding {
  return Array.isArray(value) && value.every((element) => typeof element === 'number');
}

function isEmbeddingMatrix(value: any): value is EmbeddingMatrix {
  return (
    Array.isArray(value) &&
    value.every((element) => isSingleEmbedding(element))
  );
}

function isTypedArrayEmbedding(value: any): value is TypedArrayEmbedding {
  return value instanceof Float32Array || value instanceof Float64Array;
}

function isEmbeddingType(value: any): value is EmbeddingType {
  return isEmbeddingMatrix(value) || isTypedArrayEmbedding(value);
}

function isRecordIngest(value: any): value is Record<string, string | number | Date> {
  return typeof value === 'object' && value !== null;
}

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

export class AtlasProject {
  options: ProjectInitOptions;
  user: AtlasUser;
  indices: AtlasIndex[] = [];
  _schema?: Schema | null;
  info: ProjectInfo;
  constructor(options : ProjectInitOptions, user: AtlasUser | undefined) {
    this.options = options;
    if (user === undefined) {
      this.user = get_user();
    } else {
      this.user = user;
    }
  }

  validate_metadata() : void {
    // validate metadata
  }

  async create_projection(options: IndexCreateOptions) : Promise<AtlasProjection> {
    await 
  }

  get schema() {
    if (this._schema === undefined) {
      this.update_info()
    }
    return this._schema;
  }

  private async uploadArrow(table: Table) : Promise<void> {
    // upload arrow to the server
  }

  addData(options : AddDataOptions) : Promise<void> {
    if (isRecordIngest(options.data)) {
      // convert to arrow
    }

    if (isEmbeddingType(options.embeddings)) {
      if (isEmbeddingMatrix(options.embeddings)) {
        // convert to typed array

      }
      // convert to arrow
    }
    if (this.schema === null) {
      this._schema = table.schema;
    }
  }

}

