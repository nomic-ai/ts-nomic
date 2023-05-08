import { BaseAtlasClass } from "general";

export default class AtlasProjection extends BaseAtlasClass {
  id: UUID;
  constructor(id: UUID, user?: AtlasUser) {
    super(user);
    this.id = id;
  }
}
