import { components } from './type-gen/openapi.js';
import { AtlasDataset } from './project.js';

// Basic Types //

/**
 * Union type of all possible resource request objects.
 */
type FullResourceRequest =
  components['schemas']['ResourceRequestList']['items'][number];

/**
 * Union type of all possible resource type strings.
 */
type ResourceType = FullResourceRequest['resource_type'];

/**
 * A distributive version of Omit that works with unions.
 */
type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

/**
 * A resource request object without dependencies, ref, and dataset_id.
 * Used for user-specified resource requests.
 */
type ResourceRequest = DistributiveOmit<
  FullResourceRequest,
  'dependencies' | 'ref' | 'dataset_id'
>;

/**
 * Gets the resource request object for a given resource type.
 */
type ResourceRequestByType<
  T extends ResourceType,
  V extends ResourceRequest = ResourceRequest
> = Extract<V, { resource_type: T }>;

/**
 * Conditional type for dependencies - returns never for DATASET_CHECKPOINT,
 * otherwise returns the dependencies type for the resource.
 */
type ResourceDependencies<T extends ResourceType> =
  T extends 'DATASET_CHECKPOINT'
    ? never
    : 'dependencies' extends keyof ResourceRequestByType<T, FullResourceRequest>
    ? ResourceRequestByType<T, FullResourceRequest>['dependencies']
    : never;

// Map Creation Options //

type ProjectionShortNames = 'UMAP' | 'TSNE' | 'NPV2';
type ProjectionResourceTypes =
  | 'UMAP_COORDINATE_SET'
  | 'TSNE_COORDINATE_SET'
  | 'NPV2_COORDINATE_SET' extends ResourceType
  ? 'UMAP_COORDINATE_SET' | 'TSNE_COORDINATE_SET' | 'NPV2_COORDINATE_SET'
  : never;

const ProjectionShortNameMap: Record<
  ProjectionShortNames,
  ProjectionResourceTypes
> = {
  UMAP: 'UMAP_COORDINATE_SET',
  TSNE: 'TSNE_COORDINATE_SET',
  NPV2: 'NPV2_COORDINATE_SET',
};

export type SimpleMapOptions = {
  embeddingField: string;
};

export type FullMapOptions = {
  embedding: {
    field: string;
    model?: 'nomic-embed-text-v1.5' | 'gte-multilingual-base';
  };
  projection?:
    | {
        method: ProjectionShortNames;
      }
    | { method: ProjectionShortNames }[];
  topics?: {
    labelingField?: string;
  };
  duplicate_detection?: {
    enabled: boolean;
  };
};

export class MapBuilder {
  private dataset: AtlasDataset;
  private resourceList: ResourceRequest[];
  private options: FullMapOptions | SimpleMapOptions | null = null;

  constructor(dataset: AtlasDataset) {
    this.dataset = dataset;
    this.resourceList = [];
  }

  setMapOptions(options: FullMapOptions | SimpleMapOptions): this {
    this.options = options;
    return this;
  }

  /**
   * Generates the complete resource graph/list based on the current configuration.
   * This method validates that required resources are configured and builds the
   * dependency graph between resources.
   *
   * @returns The complete resource request list ready for API submission
   * @throws Error if required resources (like embeddings) are not configured
   */
  generateResourceGraph(): FullResourceRequest[] {
    const finalResources: FullResourceRequest[] = [];
    const refCounter = { current: 1 };
    const options = this.options;

    if (!options) {
      throw new Error('No map options set');
    }

    const simpleMode = 'embeddingField' in options;

    const projectionMethods: ProjectionResourceTypes[] = [
      ...new Set<ProjectionResourceTypes>(
        simpleMode || !options.projection
          ? ['NPV2_COORDINATE_SET']
          : Array.isArray(options.projection)
          ? options.projection.map((p) => ProjectionShortNameMap[p.method])
          : [ProjectionShortNameMap[options.projection.method]]
      ),
    ];

    // Helper function to generate unique refs
    const generateRef = (resourceType: ResourceType): string =>
      `resource_${refCounter.current++}_${resourceType}`;

    // Helper function to create a resource with proper typing
    const addResource = <T extends ResourceType>(
      resourceType: T,
      resourceData: Omit<
        ResourceRequestByType<T, FullResourceRequest>,
        'resource_type' | 'ref' | 'dataset_id' | 'dependencies'
      >,
      dependencies: ResourceDependencies<T>
    ): string => {
      const ref = generateRef(resourceType);
      const fullResource: ResourceRequestByType<T, FullResourceRequest> = {
        resource_type: resourceType,
        ref,
        dataset_id: this.dataset.id,
        ...(resourceType !== 'DATASET_CHECKPOINT' && { dependencies }),
        ...resourceData,
      } as ResourceRequestByType<T, FullResourceRequest>;

      finalResources.push(fullResource);
      return ref;
    };

    const datasetCheckpointRef = addResource(
      'DATASET_CHECKPOINT',
      {},
      null as never
    );
    const checkpointDescriptionRef = addResource(
      'CHECKPOINT_DESCRIPTION',
      {},
      {
        DATASET_CHECKPOINT: datasetCheckpointRef,
      }
    );
    const embeddingSetInferredRef = addResource(
      'EMBEDDING_SET_INFERRED',
      {
        embedding_model:
          simpleMode || !options.embedding.model
            ? 'nomic-embed-text-v1.5'
            : options.embedding.model,
        source_column: simpleMode
          ? options.embeddingField
          : options.embedding.field,
      },
      { DATASET_CHECKPOINT: datasetCheckpointRef }
    );
    const hnswIndexRef = addResource(
      'HNSW_INDEX',
      {},
      { EMBEDDING_SET: embeddingSetInferredRef }
    );
    const svdCoordinateSetRef = addResource(
      'SVD_COORDINATE_SET',
      {},
      { EMBEDDING_SET: embeddingSetInferredRef }
    );
    const coordinateSetRefs: string[] = projectionMethods.map((method) =>
      addResource(
        method,
        {},
        {
          COORDINATE_SET: svdCoordinateSetRef,
          NN_INDEX: hnswIndexRef,
          EMBEDDING_SET: embeddingSetInferredRef,
        }
      )
    );
    const quadtreeRef = addResource(
      'QUADTREE',
      {},
      {
        COORDINATE_SET: coordinateSetRefs[0],
        DATASET_CHECKPOINT: datasetCheckpointRef,
        OTHER_COORDINATE_SETS:
          coordinateSetRefs.length > 1 ? coordinateSetRefs.slice(1) : undefined,
      }
    );
    const embeddingSidecarRef = addResource(
      'EMBEDDING_SIDECAR',
      {},
      { EMBEDDING_SET: embeddingSetInferredRef, QUADTREE: quadtreeRef }
    );
    const clusterAssignmentRef = addResource(
      'CLUSTER_ASSIGNMENT',
      {},
      { EMBEDDING_SET: embeddingSetInferredRef }
    );
    const clusterSidecarRef = addResource(
      'CLUSTER_SIDECAR',
      {},
      { CLUSTER_ASSIGNMENT: clusterAssignmentRef, QUADTREE: quadtreeRef }
    );
    const topicLabelPositionsRef = addResource(
      'TOPIC_LABEL_POSITIONS',
      {},
      {
        COORDINATE_SET: coordinateSetRefs[0],
        CLUSTER_ASSIGNMENT: clusterAssignmentRef,
      }
    );
    const keywordsTopicLabelRef = addResource(
      'KEYWORDS_TOPIC_LABEL',
      {
        target_field: simpleMode
          ? options.embeddingField
          : options.topics?.labelingField || options.embedding.field,
      },
      {
        TOPIC_LABEL_POSITIONS: topicLabelPositionsRef,
        DATASET_CHECKPOINT: datasetCheckpointRef,
      }
    );
    const llmTopicLabelRef = addResource(
      'LLM_TOPIC_LABEL',
      {},
      {
        KEYWORDS_TOPIC_LABEL: keywordsTopicLabelRef,
        TOPIC_LABEL_POSITIONS: topicLabelPositionsRef,
      }
    );
    let mapCheckpointResources = [
      quadtreeRef,
      datasetCheckpointRef,
      checkpointDescriptionRef,
      embeddingSidecarRef,
      clusterSidecarRef,
      llmTopicLabelRef,
    ];
    if (!simpleMode && options.duplicate_detection?.enabled) {
      const duplicateDetectionRef = addResource(
        'DUPLICATES',
        {},
        { QUADTREE: quadtreeRef, NN_INDEX: hnswIndexRef }
      );
      mapCheckpointResources.push(duplicateDetectionRef);
    }
    addResource(
      'MAP_CHECKPOINT',
      {},
      {
        RESOURCES: mapCheckpointResources,
      }
    );

    return finalResources;
  }

  fromResourceList(resourceList: FullResourceRequest[]): this {
    this.resourceList = resourceList;
    return this;
  }

  /**
   * Returns the current resource graph without building/submitting it.
   * Useful for advanced users who want to inspect or modify the resource
   * configuration before submission.
   *
   * @returns The resource request list that would be submitted
   */
  getResourceGraph(): ResourceRequest[] {
    return this.resourceList;
  }

  /**
   * Builds and submits the map to the Atlas API.
   * This is the main execution method that generates the resource graph
   * and sends it to the server.
   *
   * @returns Promise resolving to the API response
   */
  async buildMap(): Promise<components['schemas']['ResourceResponse']> {
    const finalResourceList = this.generateResourceGraph();

    return (await this.dataset.apiCall(
      `/v1/dataset/${this.dataset.id}/resources`,
      'POST',
      finalResourceList
    )) as components['schemas']['ResourceResponse'];
  }
}
