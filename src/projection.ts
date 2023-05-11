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

export class AtlasProjection extends BaseAtlasClass {
  _project?: AtlasProject;
  project_id: UUID;
  _index?: AtlasIndex;

  constructor(private id: UUID, options: ProjectionInitializationOptions) {    
    const { project, project_id, user } = options;
    super(user);

    if (project_id === undefined && project === undefined) {
      throw new Error("project_id or project is required");
    }
    if (project_id !== undefined && project !== undefined) {
      throw new Error("project_id and project are mutually exclusive");
    }

    if (project_id !== undefined) {
      this.project_id = project_id;
    } else {
      this.project_id = project!.id;
      this._project = project;
    }
  }
  async project() : Promise<AtlasProject> {
    if (this._project === undefined) {
      this._project = new AtlasProject(this.project_id, this.user)
    }
    return this._project
  }

  async index() : Promise<AtlasIndex> {
      
    throw new Error("Not implemented")

    //const project_info = await this.project().then(d => d.info())

    // This is going to be a slight pain.
  }

  get quadtree_root() : string {
    return `https://${this.user.apiEndpoint}/v1/project/public/${this.project_id}/index/projection/${this.id}/quadtree`
  }
  async info() {
    const response = await this.apiCall(
      `/v1/project/${this.project_id}/projection/${this.id}`,
      "GET"
    );
    return response.json();
  }

}
