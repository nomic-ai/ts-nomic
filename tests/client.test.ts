import { describe, it, expect } from 'vitest';
import { Atlas } from '../src/client';
import { AtlasViewer } from '../src/viewer';

describe('NomicClient', () => {
  it('should create a client instance with a valid API key', () => {
    const client = new Atlas(process.env.ATLAS_API_KEY!);
    expect(client).toBeInstanceOf(Atlas);
  });

  it('should throw an error when no API key is provided', () => {
    expect(() => new Atlas('')).toThrow('API key is required');
  });

  it('should use the provided API domain when specified', () => {
    const customDomain = 'https://custom-api.example.com';
    const client = new Atlas(process.env.ATLAS_API_KEY!, {
      apiDomain: customDomain,
    });
    // Using any to access private property for testing
    expect((client as any).apiDomain).toBe(customDomain);
  });

  it('should use the default API domain when not specified', () => {
    const client = new Atlas(process.env.ATLAS_API_KEY!);
    // Using any to access private property for testing
    expect((client as any).apiDomain).toBe('https://api-atlas.nomic.ai');
  });

  it('should create a viewer instance', () => {
    const client = new Atlas(process.env.ATLAS_API_KEY!);
    expect(client.viewer).toBeInstanceOf(AtlasViewer);
  });

  it('should create a viewer instance with a custom API domain', () => {
    const customDomain = 'https://custom-api.example.com';
    const client = new Atlas(process.env.ATLAS_API_KEY!, {
      apiDomain: customDomain,
    });
    expect(client.viewer).toBeInstanceOf(AtlasViewer);
    expect((client.viewer as any).apiLocation).toBe(
      customDomain.replace('https://', '').replace('http://', '')
    );
  });
});
