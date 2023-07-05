import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { AtlasUser } from '../dist/user.js';
import { AtlasOrganization } from '../dist/organization.js';

// TODO - should have a dedicated test account here

test('AtlasOrganization test', async () => {
  const user = new AtlasUser({ useEnvToken: true });
  const info = await user.info();
  const organization = new AtlasOrganization(
    info.organizations[0].organization_id,
    user
  );
  assert.is(organization.id, info.organizations[0].organization_id);
});

test('AtlasUser from env variables', async () => {
  // This is using the ATLAS_API_KEY env variable
  // If this isn't found it will break
  const user = new AtlasUser({ useEnvToken: true });
  const info = await user.info();
  assert.type(info, 'object');
});

test('Null user rewrites', async () => {
  const nullUser = new AtlasUser({});
  const user = new AtlasUser({ useEnvToken: true });

  const endpoint =
    '/v1/project/581cb8f8-41e7-4595-b72e-fb70ca6dd2a7/index/projection/0a90f32a-874f-49c2-9ef5-63253d833366/quadtree/1/1/1.feather';
  const endpoint_with_public =
    '/v1/project/public/581cb8f8-41e7-4595-b72e-fb70ca6dd2a7/index/projection/0a90f32a-874f-49c2-9ef5-63253d833366/quadtree/1/1/1.feather';
  assert.is(nullUser.fixEndpointURL(endpoint), endpoint_with_public);
  assert.is(user.fixEndpointURL(endpoint), endpoint);
});

test('AtlasUser from api key', async () => {
  const key = process.env.ATLAS_API_KEY;
  if (key === undefined) {
    throw new Error('ATLAS_API_KEY not set');
  }
  const user = new AtlasUser({ apiKey: key });
  const info = await user.info();
  assert.type(info, 'object');
});

// TODO - tests for bearer token login
// TODO - tests for anon account

test.run();
