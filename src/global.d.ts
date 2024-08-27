export namespace Atlas {
  type UUID = string;
  type LoadProjectOptions = {
    project_id: UUID;
  };

  /**
   * Options for the nearest neighbors query.
   */
  type NNOptions = {
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

  type ProjectInitOptions = {
    project_name: string;
    organization_name?: string;
    organization_id?: UUID;
    unique_id_field: string;
    modality: 'text' | 'embedding';
  };
  type ProjectionInfo = {
    id: UUID;
    ready: boolean;
    created_timestamp: string;
  };
  type IndexInfo = {
    id: UUID;
    projections: ProjectionInfo[];
  };
  type ProjectInfo = {
    project_id: UUID;
    project_name: string;
    organization_id: UUID;
    is_public: boolean;
    organization_name: string;
    modality: 'text' | 'embedding';
    unique_id_field: string;
    insert_update_delete_lock: boolean;
    atlas_indices: IndexInfo[];
    access_role: 'VIEWER' | 'ADMIN' | 'OWNER' | 'NONE';
  };
  type Payload = Record<string, any> | Uint8Array | null;
  type AtlasUser = {};

  type Envlogin = {
    useEnvToken: true;
    apiLocation?: never;
    apiKey?: never;
    bearerToken?: never;
  };
  type ApiKeyLogin = {
    useEnvToken?: never;
    apiLocation?: string;
    apiKey: string;
    bearerToken?: never;
  };
  type BearerTokenLogin = {
    useEnvToken?: never;
    bearerToken: string;
    apiLocation?: string;
    apiKey?: never;
  };
  type AnonViewerLogin = {
    useEnvToken?: never;
    bearerToken?: never;
    apiLocation?: string;
    apiKey?: never;
  };
  type LoginParams =
    | Envlogin
    | ApiKeyLogin
    | BearerTokenLogin
    | AnonViewerLogin;

  type ApiCallOptions = {
    octetStreamAsUint8?: boolean;
  };

  type TokenRefreshResponse = any;
  interface Credentials {
    refresh_token: string | null;
    token: string;
    expires: number;
  }
}
