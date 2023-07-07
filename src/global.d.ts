declare namespace Atlas {
  type UUID = string;
  type LoadProjectOptions = {
    project_id: UUID;
  };
  type TextIndexOptions = {
    indexed_field: string;
  };
  type NNOptions = {
    datum_ids?: string[];
    atom_ids?: string[];
    k?: number;
  };

  type ProjectInitOptions = {
    project_name: string;
    organization_name?: string;
    organization_id?: UUID;
    unique_id_field: string;
    modality: 'text' | 'embedding';
  };
  type ProjectionInfo = {
    id: UUID;
  };
  type IndexInfo = {
    id: UUID;
    projections: ProjectionInfo[];
  };
  type IndexCreateOptions = {
    project_id: UUID;
    index_name: string;
    index_type: 'text' | 'embedding';
    indexed_field: string;
  };
  type GeometryStrategy = 'document';
  type CreateAtlasIndexRequest = {
    project_id: UUID;
    indexed_field: string;
    geometry_strategies: GeometryStrategy[];
    atomizer_strategies: string[];
    model_hyperparameters: string;
    model: string;
  };
  type ProjectInfo = {
    project_id: UUID;
    project_name: string;
    organization_id: UUID;
    is_public: boolean;
    organization_name: string;
    modality: 'text' | 'embedding';
    unique_id_field: string;
    insert_update_delete_lock: boolean;
    atlas_indices: IndexInfo[];
  };
  type Payload = Record<string, any> | Uint8Array | null;
  type AtlasUser = {};
}
