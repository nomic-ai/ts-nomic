import { AtlasViewer } from './viewer.js';
import { BaseAtlasClass, AtlasUser } from './user.js';

type TaskType =
  | 'search_document'
  | 'search_query'
  | 'clustering'
  | 'classification';
type EmbedderOptions = {
  // The embedding endpoint
  model?: EmbeddingModel;
  maxTokens?: number;
  // The prompt prefix to include in the request.
  // prefix?: string;
  taskType?: TaskType;
};

type EmbeddingModel = 'nomic-embed-text-v1' | 'nomic-embed-text-v1.5';

type Embedding = number[];

type NomicEmbedResponse = {
  embeddings: Embedding[];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
  model: EmbeddingModel;
};

// Uploads on the server may be batched even smaller than this, so there
// are probably not advantages to making this number larger.
const BATCH_SIZE = 400;

/**
 * A class that pools and runs requests to the Nomic embedding API.
 * If you are dispatching dozens or more embedding requests in quick
 * succession, this class handles pooling and backoff to ensure you get
 * your results as quickly as possible.
 *
 * For best results, **do not await your embedding results until they are needed**.
 *
 * For example, if you are embedding 1000 lines of text, you can do the
 * following:
 *
 * GOOD -- Nomic will break down your big request into multiple medium-sized ones.
 * ```js
 * const documents = ["Once upon a time", "there was a girl named Goldilocks", …, "and they all lived happily ever after"]
 * const embedder = new Embedder(myApiKey)
 * const embeddings = await embedder.embed(documents)
 * ```
 *
 * GOOD -- Nomic will combine your small requests into several medium-size ones.
 * ```js
 * const documents = ["Once upon a time", "there was a girl named Goldilocks", …, "and they all lived happily ever after"]
 * const embedder = new Embedder(myApiKey)
 * const promises = []
 * for (let document of documents) {
 *    promises.push(embedder.embed(document))
 * }
 * const embeddings = await Promise.all(promises)
 * ```
 *
 * BAD -- You will generate many small, inefficient requests.
 * ```js
 *  * const documents = ["Once upon a time", "there was a girl named Goldilocks", …, "and they all lived happily ever after"]
 * const embedder = new Embedder(myApiKey)
 * const embeddings = []
 * for (let document of documents) {
 *    const embedding = await embedder.embed(document); // <- premature await.
 *    embeddings.push(embedding);
 * }
 * ```
 */
export class Embedder extends BaseAtlasClass<{}> {
  model: EmbeddingModel;
  // A container of strings and their promise rejections/resolutions. It serves to pool requests
  // together.
  private embedQueue: [
    string,
    (embedding: Embedding) => void,
    (error: any) => void
  ][] = [];
  tokensUsed = 0;
  taskType: TaskType;
  // Track how many times we've failed recently and use it to schedule backoff.
  private backoff: number | null = null;
  private epitaph?: Error;
  private nextScheduledFlush: null | unknown = null; // `Timeout` is a little weird to simultaneously type in node and browser, so I'm just calling it unknown

  // A wrapper around embedding API calls that handles authentication
  // and pools requests in a way that is likely to succeed.

  /**
   *
   * @param apiKey Your nomic API key, beginning with 'nk'.
   * @param user (Optionally)
   * @param options
   */
  constructor(apiKey: string, options: EmbedderOptions);
  constructor(user: AtlasUser, options: EmbedderOptions);
  constructor(viewer: AtlasViewer, options: EmbedderOptions);
  constructor(
    input: string | AtlasUser | AtlasViewer,
    options: EmbedderOptions = {}
  ) {
    const { model, taskType } = {
      // Defaults
      model: 'nomic-embed-text-v1.5' as EmbeddingModel,
      taskType: 'search_document' as TaskType,
      ...options,
    };
    let viewer: AtlasViewer | AtlasUser;
    if (typeof input === 'string') {
      viewer = new AtlasViewer({
        apiKey: input,
      });
    } else {
      viewer = input;
    }
    // Handle authentication the normal way.
    super(viewer);
    this.model = model;
    this.taskType = taskType;
  }

  protected endpoint(): string {
    throw new Error('Embedders do not have info() property.');
  }

  private async _embed(values: string[]): Promise<NomicEmbedResponse> {
    return this.apiCall('/v1/embedding/text', 'POST', {
      model: this.model,
      task_type: this.taskType,
      texts: values,
    }) as Promise<NomicEmbedResponse>;
  }

  private async flushDeferredEmbeddings() {
    // Resolves all outstanding promises.
    if (this.embedQueue.length === 0) {
      return;
    }

    // Pull the first BATCH_SIZE items off and send them into the cloud.
    // Any amounts larger than this will have to wait until the next interval to be embedded.
    const toEmbed = this.embedQueue.splice(0, BATCH_SIZE);
    this._embed(toEmbed.map((d) => d[0]))
      .then(({ embeddings, usage }) => {
        // iterate over the returned embeddings for the batch and resolve the
        // associated promises.
        for (let i = 0; i < embeddings.length; i++) {
          // Resolve all the associated promises.
          toEmbed[i][1](embeddings[i]);
        }
        this.tokensUsed += usage.total_tokens;
      })
      .catch((err) => {
        // TODO: -- not the right way to test the error type!
        if (('' + err).match(/50[0-9]|429/)) {
          this.embedQueue = [...toEmbed, ...this.embedQueue];
          if (this.backoff && this.backoff > 8000) {
            this.epitaph = new Error(
              'Too many requests have failed, disabling embedder. Please try again later.'
            );
          }
          this.backoff = this.backoff ? this.backoff * 2 : 1000;
        } else {
          // Propagate the error to the user for each text.
          for (let [text, resolve, reject] of toEmbed) {
            const failure = new Error(
              `Embedding call for string ${text.slice(
                0,
                30
              )}... failed with error ${err}`
            );
            reject(failure);
          }
        }
        // Put them back onto the front of the queue.
      });
  }

  // Schedule periodic resolutions of all outstanding embedding calls.
  // The logic is that any fresh calls are resolved instantly, but also set up a state
  // so that *subsequent* calls will wait 100ms to allow a backlog of requests to build up
  // so we can batch more efficiently.
  private async periodicallyFlushCache() {
    if (this.nextScheduledFlush === null) {
      // There's no timeout. Immediately flush the queue.
      this.flushDeferredEmbeddings();
      // Now schedule the next flush for 510 ms from now.
      this.nextScheduledFlush = setTimeout(() => {
        // Remove the scheduled flush so the next call will do a quick flush
        this.nextScheduledFlush = null;
        // flush now immediately.
        this.flushDeferredEmbeddings();
        // The API rate limits you to 2 requests per second, so we can't go faster than that.
      }, 510);
    } else {
      // There's a flush scheduled already, we don't need to do anything.
    }
  }

  async embed(value: string): Promise<Embedding>;
  async embed(value: string[]): Promise<Embedding[]>;

  async embed(value: string | string[]): Promise<Embedding | Embedding[]> {
    // Determine if the input is a single string or an array of strings
    const isSingleString = typeof value === 'string';
    if (this.epitaph) {
      throw new Error(
        `This embedder has permanently failed with error ${this.epitaph} `
      );
    }
    if (this.embedQueue.length > 1e5) {
      throw new Error(
        `There are already ${this.embedQueue.length} texts queued up for embedding on this machine. Please slow down and try again!`
      );
    }
    // If it's a single string, wrap it in an array for consistent processing
    const values = isSingleString ? [value] : value;

    const promises = values.map((string) => {
      return new Promise<Embedding>((resolve, reject) => {
        this.embedQueue.push([string, resolve, reject]);
      });
    });

    this.periodicallyFlushCache();
    // Wait for all promises to resolve
    const results = await Promise.all(promises).catch((err) => {
      console.warn(err);
      return [[1]];
    });

    // If the input was a single string, return the first element of the results
    if (isSingleString) {
      return results[0];
    }

    // Otherwise, return the full array of results
    return results;
  }
}

export async function embed(
  value: string,
  options: EmbedderOptions,
  apiKey: string | undefined
): Promise<Embedding>;

export async function embed(
  values: string[],
  options: EmbedderOptions,
  apiKey: string | undefined
): Promise<Embedding[]>;

export async function embed(
  value: string | string[],
  options: EmbedderOptions = {},
  apiKey: string | undefined
): Promise<Embedding | Embedding[]> {
  const machine =
    apiKey === undefined
      ? new Embedder(new AtlasViewer({ useEnvToken: true } as const), options)
      : new Embedder(apiKey, options);

  if (typeof value === 'string') {
    // Handle the case where value is a single string
    return machine.embed([value]).then((arrays) => arrays[0]);
  } else {
    // Handle the case where value is an array of strings
    return machine.embed(value);
  }
}
