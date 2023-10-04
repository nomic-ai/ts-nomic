declare namespace Atlas {
  type UUID = string;
  type LoadProjectOptions = {
    project_id: UUID;
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
    access_role: 'VIEWER' | 'ADMIN' | 'OWNER' | 'NONE';
  };
  type Payload = Record<string, any> | Uint8Array | null;
  type AtlasUser = {};
}
