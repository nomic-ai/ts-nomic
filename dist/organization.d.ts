import { AtlasUser } from "./user";
import { AtlasProject } from "./project";
type UUID = string;
export type OrganizationUserInfo = {
    organization_id: UUID;
    nickname: string;
    user_id: string;
    access_role: "OWNER" | "MEMBER";
};
type OrganizationInfo = {
    id: UUID;
    projects: AtlasProject[];
};
type ProjectInitOptions = {
    project_name: string;
    unique_id_field: string;
    modality: "text" | "embedding";
};
export declare class AtlasOrganization {
    id: UUID;
    user: AtlasUser;
    _info: OrganizationInfo | undefined;
    constructor(id: UUID, user?: AtlasUser);
    info(): Promise<OrganizationInfo>;
    projects(): Promise<AtlasProject[]>;
    create_project(options: ProjectInitOptions): Promise<AtlasProject>;
}
export {};
