import { expect, test } from 'vitest';

import { AtlasUser } from '../dist/user.js';
import { AtlasViewer } from '../dist/viewer.js';

test('AtlasUser from env variables', async () => {
  // This is using the ATLAS_API_KEY env variable
  // If this isn't found it will break
  const user = await new AtlasUser({
    useEnvToken: true,
  }).withLoadedAttributes();
  expect(user.attr).toBeInstanceOf(Object);
});

test('AtlasUser from api key', async () => {
  const key = process.env.ATLAS_API_KEY;
  if (key === undefined) {
    throw new Error('ATLAS_API_KEY not set');
  }
  const user = await new AtlasUser({
    useEnvToken: true,
  }).withLoadedAttributes();
  expect(user.attr).toBeInstanceOf(Object);
});

test('AtlasUser from AtlasViewer', async () => {
  const key = process.env.ATLAS_API_KEY;
  if (key === undefined) {
    throw new Error('ATLAS_API_KEY not set');
  }
  const viewer = new AtlasViewer({
    useEnvToken: true,
  });
  const user = await new AtlasUser(viewer).withLoadedAttributes();
  expect(user.attr).toBeInstanceOf(Object);
});

// TODO - tests for bearer token login
// TODO - tests for anon account
