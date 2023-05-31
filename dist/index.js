import { BaseAtlasClass } from "./general.js";
import { AtlasProjection } from "./projection.js";
import { AtlasProject } from "./project.js";
import { tableFromIPC } from "apache-arrow";
export class AtlasIndex extends BaseAtlasClass {
  constructor(id, user, project, project_id) {
    super(user);
    this._projections = undefined;
    if (project_id === undefined && project === undefined) {
      throw new Error("project_id or project is required");
    }
    this.project = project || new AtlasProject(project_id, user);
    this.id = id;
  }
  /**
   *
   * @param ids a list of ids (atom_ids, which are scoped to the index level) to fetch. If passing
   * datum_ids, use the project-level fetchIds method. This API is subject to change.
   *
   * @returns a list of Records containing metadata for each atom.
   */
  async atomInformation(ids) {
    const body = {
      project_id: this.project.id,
      index_id: this.id,
      atom_ids: ids,
    };
    const responseJson = await this.apiCall(
      `/v1/project/atoms/get`,
      "POST",
      body
    ).then((d) => d.json());
    const content = responseJson["atoms"];
    return content;
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
  async projections() {
    if (this._projections) {
      return this._projections;
    } else {
      const project_info = await this.project.info;
      const projections =
        project_info.atlas_indices?.find((d) => d.id === this.id)
          ?.projections || [];
      this._projections = projections.map(
        (d) =>
          new AtlasProjection(d.id, {
            index: this,
            project: this.project,
          })
      );
      return this._projections;
    }
  }
  /**
   *
   * @param datum_ids a list of datum ids to search for
   * @param atom_ids a list of atom ids to search for
   * @param k The number of neighbors to return for each one.
   * @returns
   */
  async nearest_neighbors(nn_options) {
    const { datum_ids, atom_ids, k } = nn_options;
    if (datum_ids !== undefined && atom_ids !== undefined) {
      throw new Error("datum_ids and atom_ids are mutually exclusive");
    }
    if (datum_ids === undefined && atom_ids === undefined) {
      throw new Error("datum_ids or atom_ids is required");
    }
    let params = {};
    if (datum_ids !== undefined) {
      params = { datum_ids };
    } else {
      params = { atom_ids };
    }
    const tb = await this.apiCall(
      `/v1/project/data/get/arrow/nearest_neighbors/by_id`,
      "POST",
      {
        atlas_index_id: this.id,
        ...params,
        k,
      }
    )
      .then((d) => d.arrayBuffer())
      .then((d) => tableFromIPC(d));
    console.log({ tb });
    return tb;
  }
}
