import { BaseAtlasClass } from "general";

import AtlasProjection from './projection';
import { AtlasProject } from "project";
export default class AtlasIndex extends BaseAtlasClass {
  id: Atlas.UUID;
  projections: AtlasProjection[] = []
  project?: AtlasProject;

  constructor(id: Atlas.UUID, user?: Atlas.AtlasUser) {
    super(user);
    this.id = id;
  }


  // Updates all indices
  update() {
    this.apiCall(`/v1/project/update_indices`,
      "POST", {'project_id': this.id})
  }
}
