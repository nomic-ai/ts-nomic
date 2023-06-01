import { BaseAtlasClass } from "./general.js";
import type { AtlasUser } from "user.js";
import { AtlasProjection } from "./projection.js";
import { AtlasProject } from "./project.js";
export declare class AtlasIndex extends BaseAtlasClass {
    id: Atlas.UUID;
    _projections?: AtlasProjection[];
    project: AtlasProject;
    constructor(id: Atlas.UUID, user?: AtlasUser, project?: AtlasProject, project_id?: Atlas.UUID);
    /**
     *
     * @param ids a list of ids (atom_ids, which are scoped to the index level) to fetch. If passing
     * datum_ids, use the project-level fetchIds method. This API is subject to change.
     *
     * @returns a list of Records containing metadata for each atom.
     */
    atomInformation(ids: string[] | number[] | bigint[]): Promise<any>;
    /**
     *
     * @returns a list of projections for this index.
     */
    projections(): Promise<AtlasProjection[]>;
    /**
     *
     * @param datum_ids a list of datum ids to search for
     * @param atom_ids a list of atom ids to search for
     * @param k The number of neighbors to return for each one.
     * @returns
     */
    nearest_neighbors(nn_options: Atlas.NNOptions): Promise<import("apache-arrow").Table<any>>;
}
