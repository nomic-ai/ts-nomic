import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Atlas } from '../src/client';
import { AtlasDataset } from '../src/project';
import { LoadedObject } from '../src/user';
import { generateRandomJsonData } from './data-utils';

describe.sequential('Atlas Dataset (light tests)', () => {
  let client: Atlas;
  let dataset: LoadedObject<AtlasDataset, NonNullable<AtlasDataset['attr']>>;
  const datasetName = 'test-dataset-creation';

  beforeAll(() => {
    client = new Atlas(process.env.ATLAS_API_KEY!, {
      apiDomain: process.env.ATLAS_API_DOMAIN!,
    });
  });

  afterAll(async () => {
    if (dataset) {
      await dataset.delete();
    }
  });

  it('should create a dataset from the client', async () => {
    dataset = await client.createDataset({
      project_name: datasetName,
    });

    // expect(dataset).toBeInstanceOf(AtlasDataset);
    expect(dataset.id).toBeDefined();
    expect(dataset.attr).toBeDefined();
    expect(dataset.attr.project_name).toBe(datasetName);
  });

  it('should load an existing dataset from the client', async () => {
    const loadedDataset = await client.loadDataset(dataset.id);

    expect(loadedDataset).toBeInstanceOf(AtlasDataset);
    expect(loadedDataset.id).toBe(dataset.id);
    expect(loadedDataset.attr).toBeDefined();
    expect(loadedDataset.attr.project_name).toBe(datasetName);
  });

  it('should have proper attributes after loading', async () => {
    const loadedDataset = await client.loadDataset(dataset.id);
    const organization = await client.loadOrganization();

    expect(loadedDataset.attr.owner).toBe(organization.id);
    expect(loadedDataset.attr.project_name).toBe(datasetName);
  });
});

async function findAndDeleteDataset(client: Atlas, datasetName: string) {
  const organization = await client.loadOrganization();
  const dataset = organization.attr.projects.find(
    (p) => p.project_name === datasetName
  );
  if (dataset) {
    const loadedDataset = await client.loadDataset(dataset.id);
    if (loadedDataset) {
      await loadedDataset.delete();
    }
  }
}

// Default skipped because they involve hefty operations.
// When testing changes locally, these tests should be run.
describe.skip('Atlas Dataset (full tests)', () => {
  let client: Atlas;

  beforeAll(() => {
    client = new Atlas(process.env.ATLAS_API_KEY!, {
      apiDomain: process.env.ATLAS_API_DOMAIN!,
    });
  });

  describe.sequential('JSON upload flow', () => {
    let dataset: LoadedObject<AtlasDataset, NonNullable<AtlasDataset['attr']>>;
    const datasetName = 'test-json-dataset-creation';

    beforeAll(async () => {
      await findAndDeleteDataset(client, datasetName);
    });

    afterAll(async () => {
      if (dataset) {
        await dataset.delete();
      }
    });

    it('should create a dataset and upload initial data', async () => {
      dataset = await client.createDataset({
        project_name: datasetName,
      });

      const data = generateRandomJsonData();

      await dataset.uploadData(data);

      const loadedDataset = await client.loadDataset(dataset.id);
      expect(loadedDataset.attr.project_name).toBe(datasetName);
      expect(loadedDataset.attr.total_datums_in_project).toBe(data.length);
    });

    it('should upload additional data', async () => {
      const data = generateRandomJsonData();

      await dataset.uploadData(data);

      const loadedDataset = await client.loadDataset(dataset.id);
      expect(loadedDataset.attr.total_datums_in_project).toBe(data.length * 2);
    });

    it('should create a map', async () => {
      const map = await dataset.createMap({
        embeddingField: 'text',
      });
      console.log(map);
    });

    // it('should reject data with different schema', async () => {
    //   const data = generateRandomJsonData();
    //   data.forEach((datum) => {
    //     delete datum.tags;
    //   });

    //   await dataset.uploadData(data);

    //   const loadedDataset = await client.loadDataset(dataset.id);
    //   expect(loadedDataset.attr.total_datums_in_project).toBe(data.length * 3);
    // });
  });
});
