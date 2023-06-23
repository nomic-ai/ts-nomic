import { AtlasUser } from "./user";
import { AtlasProject } from "./project";
type UUID = string;
type OrganizationInfo = {
    id: UUID;
    projects: OrganizationProjectInfo[];
};
type OrganizationProjectInfo = {
    id: UUID;
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
    projects(): Promise<OrganizationProjectInfo[]>;
    create_project(options: ProjectInitOptions): Promise<AtlasProject>;
}
export {};
