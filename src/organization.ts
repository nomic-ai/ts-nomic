
import { AtlasUser, get_env_user } from "./user";
import { AtlasProject } from "./project";

type UUID = string;

export type OrganizationInfo = {
    organization_id: UUID;
    nickname: string;
    user_id: string;
    access_role: "OWNER" | "MEMBER";
};

type OrganizationInfoFull = {
    id: UUID;
    projects: AtlasProject[];
};

export class AtlasOrganization {
    id: UUID;
    user: AtlasUser;
    constructor(id: UUID, user?: AtlasUser) {
        this.id = id;
        this.user = user || get_env_user();
    }
    async info() {
        const response = await this.user.apiCall(
            `/v1/organization/${this.id}`,
            "GET"
        );
        return response.json();
    }

    async projects() {
        const info = (await this.info()) as OrganizationInfoFull;
        return info.projects;
    }
}