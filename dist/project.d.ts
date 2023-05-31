import type { Schema, Table } from "apache-arrow";
import { AtlasUser } from "./user.js";
import { AtlasIndex } from "./index.js";
import { BaseAtlasClass } from "./general.js";
type UUID = string;
import type { components } from "../private/openapi.d";
export declare function load_project(
  options: Atlas.LoadProjectOptions
): AtlasProject;
export declare function create_project(
  options: Atlas.ProjectInitOptions
): Promise<AtlasProject>;
/**
 * An AtlasProject represents a single mutable dataset in Atlas. It provides an
 * interfaces to upload, update, and delete data, as well as create and delete
 * indices which handle specific views.
 */
export declare class AtlasProject extends BaseAtlasClass {
  _indices: AtlasIndex[];
  _schema?: Schema | null;
  _info?: components["schemas"]["Project"];
  id: UUID;
  /**
   *
   * @param id The project's unique UUID. To create a new project or fetch
   * an existing project, use the create_project or load_project functions.
   * @param user An existing AtlasUser object. If not provided, a new one will be created.
   *
   * @returns An AtlasProject object.
   */
  constructor(id: UUID, user?: AtlasUser);
  apiCall(
    endpoint: string,
    method: "GET" | "POST",
    payload?: Atlas.Payload,
    headers?: null | Record<string, string>
  ): Promise<Response>;
  delete(): Promise<Response>;
  wait_for_lock(): Promise<void>;
  private project_info;
  get info():
    | Promise<any>
    | {
        id: string;
        owner: string;
        project_name: string;
        creator: string;
        description: string;
        opensearch_index_id: string;
        is_public: boolean;
        project_fields: string[];
        unique_id_field: string;
        modality: string;
        total_datums_in_project: number;
        created_timestamp: string;
        atlas_indices: {
          id: string;
          project_id: string;
          index_name: string;
          indexed_field: string;
          created_timestamp: string;
          updated_timestamp: string;
          atoms: string[];
          colorable_fields: string[];
          embedders: {
            id: string;
            atlas_index_id: string;
            ready: boolean;
            model_name: string;
            hyperparameters: Record<string, never>;
          }[];
          nearest_neighbor_indices: {
            id: string;
            index_name: string;
            ready: boolean;
            hyperparameters: Record<string, never>;
            atom_strategies: string[];
          }[];
          projections: {
            id: string;
            projection_name: string;
            ready: boolean;
            hyperparameters: Record<string, never>;
            atom_strategies: string[];
            created_timestamp: string;
            updated_timestamp: string;
          }[];
        }[];
        insert_update_delete_lock: boolean;
        access_role?: string | undefined;
        schema?: string | undefined;
      };
  indices(): Promise<AtlasIndex[]>;
  update_indices(rebuild_topic_models?: boolean): Promise<void>;
  add_text(records: Record<string, string>[]): Promise<void>;
  add_embeddings(): Promise<void>;
  /**
   *
   * @param ids A list of identifiers to fetch from the server.
   */
  fetch_ids(ids?: string[]): Promise<Record<string, any>[]>;
  createIndex(
    options: Omit<Atlas.IndexCreateOptions, "project_id">
  ): Promise<AtlasIndex>;
  delete_data(ids: string[]): Promise<void>;
  validate_metadata(): void;
  get schema(): Schema<any> | null | undefined;
  uploadArrow(table: Table): Promise<void>;
}
export {};
