import { get_env_user } from "./user";
export class AtlasOrganization {
    constructor(id, user) {
        this.id = id;
        this.user = user || get_env_user();
    }
    async info() {
        const response = await this.user.apiCall(`/v1/organization/${this.id}`, "GET");
        return response.json();
    }
    async projects() {
        const info = (await this.info());
        return info.projects;
    }
}
