import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { AtlasUser } from '../dist/user.js';
import { AtlasOrganization } from '../dist/organization.js';

// TODO - should have a dedicated test account here

test('AtlasOrganization test', async () => {
  const user = await new AtlasUser({
    useEnvToken: true,
  }).withLoadedAttributes();

  const info = user.attr;

  const organization = new AtlasOrganization(
    info.organizations[0].organization_id,
    user
  );
  assert.is(organization.id, info.organizations[0].organization_id);
});

test('AtlasUser from env variables', async () => {
  // This is using the ATLAS_API_KEY env variable
  // If this isn't found it will break
  const user = await new AtlasUser({
    useEnvToken: true,
  }).withLoadedAttributes();
  assert.type(user.attr, 'object');
});

test('AtlasUser from api key', async () => {
  const key = process.env.ATLAS_API_KEY;
  if (key === undefined) {
    throw new Error('ATLAS_API_KEY not set');
  }
  const user = await new AtlasUser({
    useEnvToken: true,
  }).withLoadedAttributes();
  assert.type(user.attr, 'object');
});

// TODO - tests for bearer token login
// TODO - tests for anon account

test.run();
