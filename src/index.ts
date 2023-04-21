
class AtlasIndex {
  id: UUID;
  projections: AtlasProjection[] = []
  constructor(id: UUID) {
    this.id = id;
  }
}
