import { BaseAtlasClass } from "./general";

import { AtlasProjection } from './projection';
import { AtlasProject } from "./project";
import { tableFromIPC } from "apache-arrow";
export class AtlasIndex extends BaseAtlasClass {
  id: Atlas.UUID;
  _projections?: AtlasProjection[] = undefined;
  project: AtlasProject;

  constructor(id: Atlas.UUID, user?: Atlas.AtlasUser, project?: AtlasProject, project_id?: Atlas.UUID) {
    super(user);
    if (project_id === undefined && project === undefined) {
      throw new Error("project_id or project is required");
    }
    this.project = project || new AtlasProject(project_id!, user);
    this.id = id;
  }

  /* Updates all indices
  update() {
    this.apiCall(`/v1/project/update_indices`,
      "POST", {'project_id': this.project.id})
  }*/

  /**
   * 
   * @returns a list of projections for this index. 
   */
  async projections() : Promise<AtlasProjection[]> {
    if (this._projections) {
      return this._projections
    } else {
      const project_info = await this.project.info as Atlas.ProjectInfo
      const projections = project_info.atlas_indices?.find(d => d.id === this.id)?.projections || []
      this._projections = projections.map(d => new AtlasProjection(d.id as string, {index: this, project: this.project}))
      return this._projections
    }
  }
  /**
   * 
   * @param datum_ids a list of datum ids to search for
   * @param atom_ids a list of atom ids to search for
   * @param k The number of neighbors to return for each one.
   * @returns 
   */
  async nearest_neighbors(nn_options : Atlas.NNOptions) {
    const { datum_ids, atom_ids, k } = nn_options;
    if (datum_ids !== undefined && atom_ids !== undefined) {
      throw new Error("datum_ids and atom_ids are mutually exclusive")
    }
    if (datum_ids === undefined && atom_ids === undefined) {
      throw new Error("datum_ids or atom_ids is required")
    }
    let params = {};
    if (datum_ids !== undefined) {
      params = { datum_ids }
    } else {
      params = { atom_ids }
    }
    const tb = await this.apiCall(`/v1/project/data/get/arrow/nearest_neighbors/by_id`, 'POST', {
      atlas_index_id: this.id,
      ...params,
      k
    }).then(d => d.arrayBuffer()).then(d => tableFromIPC(d))
    console.log({tb})
    return tb;
  }
}
