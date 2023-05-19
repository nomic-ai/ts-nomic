import { get_user } from './user';
export const isNode = typeof process !== "undefined" && process.versions && process.versions.node;
export class BaseAtlasClass {
    constructor(user) {
        if (user === undefined) {
            this.user = get_user();
        }
        else {
            this.user = user;
        }
    }
    async apiCall(endpoint, method, payload = null, headers = null) {
        // make an API call
        return this.user.apiCall(endpoint, method, payload, headers);
    }
}
/*
function isSingleEmbedding(value: any): value is SingleEmbedding {
  return Array.isArray(value) && value.every((element) => typeof element === 'number');
}
function isTypedArrayEmbedding(value: any): value is TypedArrayEmbedding {
  return value instanceof Float32Array || value instanceof Float64Array;
}
function isEmbeddingType(value: any): value is EmbeddingType {
  return isEmbeddingMatrix(value) || isTypedArrayEmbedding(value);
}

function isEmbeddingMatrix(value: any): value is Atlas.EmbeddingMatrix {
  return (
    Array.isArray(value) &&
    value.every((element) => isSingleEmbedding(element))
  );
}*/
function isRecordIngest(value) {
    return typeof value === 'object' && value !== null;
}
function isTextIndexOptions(value) {
    return value.indexed_field !== undefined;
}
