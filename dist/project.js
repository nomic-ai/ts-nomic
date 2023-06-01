import { tableToIPC, tableFromJSON } from "apache-arrow";
import { get_user } from "./user.js";
import { AtlasIndex } from "./index.js";
// get the API key from the node environment
import { BaseAtlasClass } from "./general.js";
export function load_project(options) {
    throw new Error("Not implemented");
}
export async function create_project(options) {
    const user = get_user();
    if (options.unique_id_field === undefined) {
        throw new Error("id_field is required");
    }
    if (options.project_name === undefined) {
        throw new Error("Project name is required");
    }
    if (options.organization_name === undefined) {
        options.organization_id = await user
            .info()
            .then((d) => d.organizations[0]["organization_id"]);
        // Delete because this isn't allowed at the endpoint.
        delete options.organization_name;
    }
    else {
        const info = await user.info();
        options.organization_id = info["organizations"].find((d) => d.nickname === options.organization_name)["organization_id"];
        delete options.organization_name;
    }
    options["modality"] = options["modality"] || "text";
    const response = await user.apiCall(`/v1/project/create`, "POST", options);
    if (response.status !== 201) {
        throw new Error(`Error ${response.status}, ${response.headers}, creating project: ${response.statusText}`);
    }
    const data = (await response.json());
    return new AtlasProject(data["project_id"], user);
}
/**
 * An AtlasProject represents a single mutable dataset in Atlas. It provides an
 * interfaces to upload, update, and delete data, as well as create and delete
 * indices which handle specific views.
 */
export class AtlasProject extends BaseAtlasClass {
    //info: Project;
    /**
     *
     * @param id The project's unique UUID. To create a new project or fetch
     * an existing project, use the create_project or load_project functions.
     * @param user An existing AtlasUser object. If not provided, a new one will be created.
     *
     * @returns An AtlasProject object.
     */
    constructor(id, user) {
        super(user);
        //options: ProjectInitOptions;
        this._indices = [];
        // check if id is a valid UUID
        const uuid = /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/;
        if (!id.toLowerCase().match(uuid)) {
            throw new Error(`${id} is not a valid UUID.`);
        }
        this.id = id;
    }
    apiCall(endpoint, method, payload = null, headers = null) {
        return this.user.apiCall(endpoint, method, payload, headers);
    }
    async delete() {
        const value = await this.apiCall(`/v1/project/remove`, "POST", {
            project_id: this.id,
        });
        if (value.status !== 200) {
            throw new Error(`Error ${value.status}, ${value.headers}, deleting project: ${value.statusText}`);
        }
        return value;
    }
    async wait_for_lock() {
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                const info = (await this.project_info());
                if (info.insert_update_delete_lock === false) {
                    clearInterval(interval);
                    resolve();
                }
            }, 1000);
        });
    }
    async project_info() {
        return this.apiCall(`/v1/project/${this.id}`, "GET").then(async (d) => {
            if (d.status !== 200) {
                const body = d.clone();
                throw new Error(`Error ${d.status}, ${d.headers}, fetching project info: ${d.statusText}`);
            }
            const value = await d.json();
            this._info = value;
            return value;
        });
    }
    get info() {
        if (this._info !== undefined) {
            return this._info;
        }
        return this.project_info();
    }
    async indices() {
        if (this._indices.length > 0) {
            return this._indices;
        }
        const { atlas_indices } = (await this.info);
        if (atlas_indices === undefined) {
            return [];
        }
        this._indices = atlas_indices.map((d) => new AtlasIndex(d["id"], this.user, this));
        return this._indices;
    }
    async update_indices(rebuild_topic_models = false) {
        await this.apiCall(`/v1/project/update_indices`, "POST", {
            project_id: this.id,
            rebuild_topic_models: rebuild_topic_models,
        });
    }
    async add_text(records) {
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
    async fetch_ids(ids) {
        throw new Error("Not implemented");
    }
    async createIndex(options) {
        let defaults = {
            project_id: this.id,
            index_name: "New index",
            colorable_fields: [],
            nearest_neighbor_index: "HNSWIndex",
            nearest_neighbor_index_hyperparameters: JSON.stringify({
                space: "l2",
                ef_construction: 100,
                M: 16,
            }),
            projection: "NomicProject",
            projection_hyperparameters: JSON.stringify({
                n_neighbors: 64,
                n_epochs: 64,
                spread: 1,
            }),
            topic_model_hyperparameters: JSON.stringify({ build_topic_model: false }),
        };
        const text_defaults = {
            indexed_field: "text",
            geometry_strategies: [["document"]],
            atomizer_strategies: ["document", "charchunk"],
            model_hyperparameters: JSON.stringify({
                dataset_buffer_size: 1000,
                batch_size: 20,
                polymerize_by: "charchunk",
                norm: "both",
            }),
            model: "NomicEmbed", // options?.multilingual === true ? 'NomicEmbedMultilingual' : 'NomicEmbed',
        };
        const embedding_defaults = {
            model: null,
            atomizer_strategies: null,
            indexed_field: null,
        };
        if (options["indexed_field"] !== undefined) {
            defaults = {
                ...defaults,
                ...text_defaults,
            };
        }
        else {
            defaults = {
                ...defaults,
                ...embedding_defaults,
            };
        }
        const prefs = {
            ...defaults,
            ...options
        };
        const response = await this.apiCall("/v1/project/index/create", "POST", prefs);
        if (response.status !== 200) {
            throw new Error(`Error ${response.status}, ${response.headers}, creating index: ${response.statusText}`);
        }
        const id = (await response.json());
        return new AtlasIndex(id, this.user, this);
    }
    async delete_data(ids) {
        // TODO: untested
        // const info = await this.info
        await this.user.apiCall("/v1/project/data/delete", "POST", {
            project_id: this.id,
            datum_ids: ids,
        });
    }
    validate_metadata() {
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
    async uploadArrow(table) {
        table.schema.metadata.set("project_id", this.id);
        table.schema.metadata.set("on_id_conflict_ignore", JSON.stringify(true));
        const data = tableToIPC(table, "file");
        const response = await this.apiCall(`/v1/project/data/add/arrow`, "POST", data);
        if (response.status !== 200) {
            throw new Error(`Error ${response.status}, ${response.headers}, uploading data: ${response.statusText}`);
        }
    }
}
