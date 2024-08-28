export type UUID = string;
export type LoadProjectOptions = {
  project_id: UUID;
};

/**
 * Options for the nearest neighbors query.
 */
export type NNOptions = {
  /**
   * The datum_ids (i.e., user-specified keys) to query for.
   */
  datum_ids?: string[];
  /**
   * The Atom IDs (Nomic-generated integers) to query for.
   */
  atom_ids?: string[];
  /**
   * The number of nearest neighbors to return.
   */
  k?: number;
};

export type ProjectInitOptions = {
  project_name: string;
  organization_name?: string;
  organization_id?: UUID;
  unique_id_field: string;
  modality: 'text' | 'embedding';
};
export type ProjectionInfo = {
  id: UUID;
  ready: boolean;
  created_timestamp: string;
};
export type IndexInfo = {
  id: UUID;
  projections: ProjectionInfo[];
};
export type Payload = Record<string, any> | Uint8Array | null;
export type AtlasUser = {};

export type Envlogin = {
  useEnvToken: true;
  apiLocation?: never;
  apiKey?: never;
  bearerToken?: never;
};
export type ApiKeyLogin = {
  useEnvToken?: never;
  apiLocation?: string;
  apiKey: string;
  bearerToken?: never;
};
export type BearerTokenLogin = {
  useEnvToken?: never;
  bearerToken: string;
  apiLocation?: string;
  apiKey?: never;
};
export type AnonViewerLogin = {
  useEnvToken?: never;
  bearerToken?: never;
  apiLocation?: string;
  apiKey?: never;
};
export type LoginParams =
  | Envlogin
  | ApiKeyLogin
  | BearerTokenLogin
  | AnonViewerLogin;

export type ApiCallOptions = {
  octetStreamAsUint8?: boolean;
};

export type TokenRefreshResponse = any;

export interface Credentials {
  refresh_token: string | null;
  token: string;
  expires: number;
}
