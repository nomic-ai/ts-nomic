import { BaseAtlasClass } from "./general";
import type { AtlasUser } from "./user";
import { AtlasProject } from "./project";
import type { AtlasIndex } from "./index";
type UUID = string;
type ProjectionInitializationOptions = {
    project?: AtlasProject;
    index?: AtlasIndex;
    project_id?: UUID;
    user?: AtlasUser;
};
export declare class AtlasProjection extends BaseAtlasClass {
    id: UUID;
    _project?: AtlasProject;
    project_id: UUID;
    _index?: AtlasIndex;
    constructor(id: UUID, options: ProjectionInitializationOptions);
    project(): Promise<AtlasProject>;
    index(): Promise<AtlasIndex>;
    atomInformation(ids: string[] | number[] | bigint[]): Promise<any>;
    get quadtree_root(): string;
    info(): Promise<any>;
}
export {};
