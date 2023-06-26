import { BaseAtlasClass } from './general.js';
import type { AtlasUser } from './user.js';
import { AtlasProject } from './project.js';
import type { AtlasIndex } from './index.js';
type UUID = string;

type ProjectionInitializationOptions = {
  project?: AtlasProject;
  index?: AtlasIndex;
  project_id?: UUID;
  user?: AtlasUser;
};

export class AtlasProjection extends BaseAtlasClass {
  _project?: AtlasProject;
  project_id: UUID;
  _index?: AtlasIndex;

  constructor(public id: UUID, options: ProjectionInitializationOptions) {
    const { project, project_id, user } = options;
    super(user || project?.user);

    if (project_id === undefined && project === undefined) {
      throw new Error('project_id or project is required');
    }
    if (project_id !== undefined && project !== undefined) {
      throw new Error('project_id and project are mutually exclusive');
    }

    if (project_id !== undefined) {
      this.project_id = project_id;
    } else {
      this.project_id = project!.id;
      this._project = project;
    }
    if (options.index) {
      this._index = options.index;
    }
  }
  async project(): Promise<AtlasProject> {
    if (this._project === undefined) {
      this._project = new AtlasProject(this.project_id, this.user);
    }
    return this._project;
  }

  async index(): Promise<AtlasIndex> {
    if (this._index) {
      return this._index;
    }
    const indices = await this.project().then((d) => d.indices());
    console.log({ indices });
    for (let index of indices) {
      console.log({ index });
      for (let projection of await index.projections()) {
        if (projection.id === this.id) {
          this._index = index;
          return index;
        }
      }
    }
    throw new Error('Could not find index for projection');
  }
  async atomInformation(ids: string[] | number[] | bigint[]) {
    const index = await this.index();
    return index.atomInformation(ids);
  }

  get quadtree_root(): string {
    return `https://${this.user.apiEndpoint}/v1/project/public/${this.project_id}/index/projection/${this.id}/quadtree`;
  }

  async info() {
    const response = await this.apiCall(
      `/v1/project/${this.project_id}/projection/${this.id}`,
      'GET'
    );
    return response.json();
  }
}
