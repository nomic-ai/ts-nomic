import { AtlasUser } from "./user";
import { AtlasProject } from "./project";
type UUID = string;
export type OrganizationInfo = {
    organization_id: UUID;
    nickname: string;
    user_id: string;
    access_role: "OWNER" | "MEMBER";
};
export declare class AtlasOrganization {
    id: UUID;
    user: AtlasUser;
    constructor(id: UUID, user?: AtlasUser);
    info(): Promise<any>;
    projects(): Promise<AtlasProject[]>;
}
export {};
