# Nomic-ts

This library provides a TypeScript client for the Nomic API that
allows you to create, upload to, and download from projects
hosted at atlas.nomic.ai.

## Setting API keys

All operations require a nomic API key linked to your account.
To generate an API key, visit [https://atlas.nomic.ai/cli-login] while
logged in to your account.

### In a file in yoiur project root directory

Create a file in project root directory called `.env`
In it, put the following line:

```
ATLAS_API_KEY=your-api-key
```

### As an environment variable

```bash
export ATLAS_API_KEY=your-api-key
```

### Through your hosting environment

If running in an environment like Vercel or Heroku, you can set the environment variable through the hosting environment.

# Design

This library is designed to be used in a browser or in Node.js. It is written in TypeScript and compiled to JavaScript.

Since the precise mechanism for calls differs in the browser as opposed to node,
all calls are handler by an `AtlasUser` interface.
