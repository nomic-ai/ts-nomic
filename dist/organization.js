import { get_env_user } from "./user";
import { AtlasProject } from "./project";
export class AtlasOrganization {
    constructor(id, user) {
        this._info = undefined;
        this.id = id;
        this.user = user || get_env_user();
    }
    async info() {
        if (this._info !== undefined) {
            return this._info;
        }
        const response = await this.user.apiCall(`/v1/organization/${this.id}`, "GET");
        const info = (await response.json());
        this._info = info;
        return info;
    }
    async projects() {
        const info = (await this.info());
        return info.projects;
    }
    async create_project(options) {
        const info = (await this.info());
        const user = this.user;
        if (options.unique_id_field === undefined) {
            throw new Error("unique_id_field is required");
        }
        if (options.project_name === undefined) {
            throw new Error("Project name is required");
        }
        options["modality"] = options["modality"] || "text";
        const response = await user.apiCall(`/v1/project/create`, "POST", { ...options, organization_id: this.id });
        if (response.status !== 201) {
            throw new Error(`Error ${response.status}, ${response.headers}, creating project: ${response.statusText}`);
        }
        const data = (await response.json());
        console.log('new project', data);
        return new AtlasProject(data["project_id"], user);
    }
}
