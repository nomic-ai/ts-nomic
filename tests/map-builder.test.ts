import { assert, beforeAll, describe, expect, it } from 'vitest';

import { AtlasDataset } from '../src/project';
import { Atlas } from '../src/client';
import { MapBuilder } from '../src/map-builder';

describe('Map Builder', () => {
  let client: Atlas;
  let dummyDataset: AtlasDataset;

  beforeAll(() => {
    dummyDataset = new AtlasDataset('test-dataset');
  });

  it('should create an empty resource graph at initialization', () => {
    const builder = new MapBuilder(dummyDataset);
    expect(builder.getResourceGraph()).toEqual([]);
  });

  it('should throw if embeddings are not specified', () => {
    const builder = new MapBuilder(dummyDataset);
    expect(() => builder.generateResourceGraph()).toThrow();
  });

  it('should create a resource graph when given simple options', () => {
    const builder = new MapBuilder(dummyDataset);
    builder.setMapOptions({
      embeddingField: 'text',
    });
    const resourceGraph = builder.generateResourceGraph();
    const embeddingResource = resourceGraph.find(
      (r) => r.resource_type === 'EMBEDDING_SET_INFERRED'
    );
    assert(embeddingResource);
    expect(embeddingResource).toMatchObject({
      resource_type: 'EMBEDDING_SET_INFERRED',
      embedding_model: 'nomic-embed-text-v1.5',
      source_column: 'text',
      dataset_id: dummyDataset.id,
    });
    const hnswIndexResource = resourceGraph.find(
      (r) => r.resource_type === 'HNSW_INDEX'
    );
    expect(hnswIndexResource).toMatchObject({
      resource_type: 'HNSW_INDEX',
      dependencies: { EMBEDDING_SET: embeddingResource.ref },
    });
  });

  it('should create a resource graph when given full options', () => {
    const builder = new MapBuilder(dummyDataset);
    builder.setMapOptions({
      embedding: {
        field: 'description',
        model: 'nomic-embed-text-v1.5',
      },
      projection: [{ method: 'UMAP' }, { method: 'TSNE' }],
      topics: {
        labelingField: 'title',
      },
      duplicate_detection: {
        enabled: true,
      },
    });
    const resourceGraph = builder.generateResourceGraph();
    const embeddingResource = resourceGraph.find(
      (r) => r.resource_type === 'EMBEDDING_SET_INFERRED'
    );
    assert(embeddingResource);
    expect(embeddingResource).toMatchObject({
      resource_type: 'EMBEDDING_SET_INFERRED',
      embedding_model: 'nomic-embed-text-v1.5',
      source_column: 'description',
      dataset_id: dummyDataset.id,
    });
    assert(
      resourceGraph.find((r) => r.resource_type === 'UMAP_COORDINATE_SET')
    );
    assert(
      resourceGraph.find((r) => r.resource_type === 'TSNE_COORDINATE_SET')
    );
    const topicLabelResource = resourceGraph.find(
      (r) => r.resource_type === 'KEYWORDS_TOPIC_LABEL'
    );
    assert(topicLabelResource);
    expect(topicLabelResource).toMatchObject({
      resource_type: 'KEYWORDS_TOPIC_LABEL',
      target_field: 'title',
    });
    assert(resourceGraph.find((r) => r.resource_type === 'DUPLICATES'));
    assert(resourceGraph.find((r) => r.resource_type === 'MAP_CHECKPOINT'));
    assert(resourceGraph.find((r) => r.resource_type === 'DATASET_CHECKPOINT'));
  });
});
