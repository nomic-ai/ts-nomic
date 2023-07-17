# Nomic-ts

This library provides a TypeScript client for the Nomic API that
allows you to create, upload to, and download from projects
hosted at atlas.nomic.ai.

## Using API keys

All operations require a nomic API key linked to your account.
To generate an API key, visit https://atlas.nomic.ai/cli-login while logged in to your account.

### API key as env variable

Once you have the API key, create a file in project root directory called `.env`
In it, put the following line:

```
ATLAS_API_KEY=your-api-key
```

If running in an environment like Vercel or Heroku, you can set the environment variable through the hosting environment.

### API key as argument

Alternatively, pass the api key as a param to `AtlasUser`:

```js
AtlasUser({ apiKey: 'your-api-key' });
```

## Setting the tenant environment

By default, this will access the production version of Atlas. This is probably what you want.

If you are using a custom tenant of Atlas, you will define the following additional variables:

```
ATLAS_FRONTEND_DOMAIN=your.frontend.domain
ATLAS_API_DOMAIN=your.api.domain
```

# Design

This library is designed to be used in a browser or in Node.js. It is written in TypeScript and compiled to JavaScript.

Since the precise mechanism for calls differs in the browser as opposed to node,
all calls are handler by an `AtlasUser` interface.
