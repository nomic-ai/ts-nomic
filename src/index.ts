import { BaseAtlasClass } from './user.js';
import type { AtlasUser } from './user.js';
import { AtlasProjection } from './projection.js';
import { AtlasDataset as AtlasDataset } from './project.js';
import type { Table } from 'apache-arrow';
import { AtlasViewer } from 'viewer.js';
import type { components } from './type-gen/openapi.js';

type IndexInitializationOptions = {
  project_id?: Atlas.UUID;
  project?: AtlasDataset;
};

export class AtlasIndex extends BaseAtlasClass<{}> {
  id: Atlas.UUID;
  _projections?: AtlasProjection[] = undefined;
  project: AtlasDataset;

  constructor(
    id: Atlas.UUID,
    user?: AtlasUser | AtlasViewer,
    options: IndexInitializationOptions = {}
  ) {
    super(user);
    if (options === undefined) {
      throw new Error('project_id or project is required');
    }
    if (options.project_id === undefined && options.project === undefined) {
      throw new Error('project_id or project is required');
    }
    this.project =
      options.project || new AtlasDataset(options.project_id as string, user);
    this.id = id;
  }

  protected endpoint(): string {
    throw new Error('There is no info property on Atlas Indexes');
  }

  /**
   *
   * @param ids a list of ids (atom_ids, which are scoped to the index level) to fetch. If passing
   * datum_ids, use the project-level fetchIds method. This API is subject to change.
   *
   * @returns a list of Records containing metadata for each atom.
   */
  async atomInformation(ids: string[] | number[] | bigint[]) {
    const body = {
      project_id: this.project.id,
      index_id: this.id,
      atom_ids: ids,
    };
    const responseJson = (await this.apiCall(
      `/v1/project/atoms/get`,
      'POST',
      body
    )) as Record<string, any>;

    const content = responseJson['atoms'];
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
  async projections(): Promise<AtlasProjection[]> {
    if (this._projections) {
      return this._projections;
    } else {
      const project_info =
        (await this.project.fetchAttributes()) as Atlas.ProjectInfo;
      const projections =
        project_info.atlas_indices?.find((d) => d.id === this.id)
          ?.projections || [];
      this._projections = projections.map(
        (d) =>
          new AtlasProjection(d.id as string, this.viewer, {
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
   * @returns A table containing the nearest neighbors for each atom.
   */
  async nearest_neighbors(nn_options: Atlas.NNOptions): Promise<Table> {
    const { datum_ids, atom_ids, k } = nn_options;
    if (datum_ids !== undefined && atom_ids !== undefined) {
      throw new Error('datum_ids and atom_ids are mutually exclusive');
    }
    if (datum_ids === undefined && atom_ids === undefined) {
      throw new Error('datum_ids or atom_ids is required');
    }
    let params = {};
    if (datum_ids !== undefined) {
      params = { datum_ids };
    } else {
      params = { atom_ids };
    }
    const tb = (await this.apiCall(
      `/v1/project/data/get/arrow/nearest_neighbors/by_id`,
      'POST',
      {
        atlas_index_id: this.id,
        ...params,
        k,
      }
    )) as Table;
    return tb;
  }

  /**
   *
   * @param param0 A keyed dictionary including `k` (the number of neighbors to return)
   * and `queries` (a list of vectors to search for).
   * @returns
   */
  async nearest_neighbors_by_vector({
    k = 10,
    queries,
  }: Omit<
    components['schemas']['EmbeddingNeighborRequest'],
    'atlas_index_id'
  >): Promise<components['schemas']['EmbeddingNeighborResponse']> {
    const { neighbors, distances } = (await this.apiCall(
      `/v1/project/data/get/nearest_neighbors/by_embedding`,
      'POST',
      {
        atlas_index_id: this.id,
        k,
        queries,
      }
    )) as components['schemas']['EmbeddingNeighborResponse'];
    return { neighbors, distances };
  }
}
