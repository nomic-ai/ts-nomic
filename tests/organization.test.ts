import { describe, it, expect, assert } from 'vitest';
import { Atlas } from '../src/client';
import { AtlasOrganization } from '../src/organization';
import { AtlasViewer } from '../src/viewer';
import { AtlasUser } from '../src/user';

describe('Atlas Organization', () => {
  it('should be loadable from nomic client', async () => {
    const client = new Atlas(process.env.ATLAS_API_KEY!, {
      apiDomain: process.env.ATLAS_API_DOMAIN!,
    });
    const org = await client.loadOrganization();
    expect(org).toBeInstanceOf(AtlasOrganization);
    expect(org.attr.slug).toBeDefined();
  });

  it('should be loadable from the Atlas Viewer alone', async () => {
    const viewer = new AtlasViewer({
      useEnvToken: true,
    });
    const user = await new AtlasUser(viewer).withLoadedAttributes();

    const info = user.attr;

    assert(info.organizations !== undefined);

    const organization = await new AtlasOrganization(
      info.organizations[0].organization_id,
      viewer
    ).withLoadedAttributes();
    expect(info.organizations[0].organization_id).toBe(organization.id);
  });
});
