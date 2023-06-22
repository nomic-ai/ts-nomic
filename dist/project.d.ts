import type { Schema, Table } from "apache-arrow";
import { AtlasUser } from "./user";
import { AtlasIndex } from "./index";
import { BaseAtlasClass } from "./general";
type UUID = string;
export declare function load_project(options: Atlas.LoadProjectOptions): AtlasProject;
export declare function create_project(options: Atlas.ProjectInitOptions): Promise<AtlasProject>;
/**
 * An AtlasProject represents a single mutable dataset in Atlas. It provides an
 * interfaces to upload, update, and delete data, as well as create and delete
 * indices which handle specific views.
 */
export declare class AtlasProject extends BaseAtlasClass {
    _indices: AtlasIndex[];
    _schema?: Schema | null;
    _info?: Atlas.ProjectInfo;
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
    apiCall(endpoint: string, method: "GET" | "POST", payload?: Atlas.Payload, headers?: null | Record<string, string>): Promise<Response>;
    delete(): Promise<Response>;
    wait_for_lock(): Promise<void>;
    private project_info;
    get info(): Promise<any> | Atlas.ProjectInfo;
    indices(): Promise<AtlasIndex[]>;
    update_indices(rebuild_topic_models?: boolean): Promise<void>;
    add_text(records: Record<string, string>[]): Promise<void>;
    add_embeddings(): Promise<void>;
    /**
     *
     * @param ids A list of identifiers to fetch from the server.
     */
    fetch_ids(ids?: string[]): Promise<Record<string, any>[]>;
    createIndex(options: Omit<Atlas.IndexCreateOptions, "project_id">): Promise<AtlasIndex>;
    delete_data(ids: string[]): Promise<void>;
    validate_metadata(): void;
    get schema(): Schema<any> | null | undefined;
    uploadArrow(table: Table): Promise<void>;
}
export {};
