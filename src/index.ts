export type UUID = string;
import type AtlasProjection from './projection';
export default class AtlasIndex {
  id: UUID;
  projections: AtlasProjection[] = []
  constructor(id: UUID) {
    this.id = id;
  }
}
