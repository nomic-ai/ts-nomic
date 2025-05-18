import { Nomic } from '../dist/main';
import { expect, test, describe } from 'vitest';

describe('Nomic API v2 Client', () => {
  test('should initialize with API key', () => {
    const client = new Nomic(process.env.ATLAS_API_KEY!);
    expect(client).toBeInstanceOf(Nomic);
  });

  test('should initialize with custom domain', () => {
    const client = new Nomic(process.env.ATLAS_API_KEY!, {
      apiDomain: 'https://staging-api-atlas.nomic.ai',
    });
    expect(client).toBeInstanceOf(Nomic);
  });

  test('should fetch user information', async () => {
    const client = new Nomic(process.env.ATLAS_API_KEY!, {
      apiDomain: 'https://staging-api-atlas.nomic.ai',
    });
    const user = await client.user.load();

    expect(user).toBeDefined();
    expect(user.sub).toBeDefined();
  });
});
