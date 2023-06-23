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
}
