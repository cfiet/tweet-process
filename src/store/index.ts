import { config } from 'dotenv';
import * as pgpromise from 'pg-promise';

import { Tweet } from '../common/data';
import { createLogger } from '../common/logging';
import { MetricsClient, MetricsOptions, DefaultMetricsOptions, Counter } from '../common/metrics';

import { DatabaseOptions } from '../options';
import { SourceQueue, SourceQueueOptions, IncomingMessage } from './queue';

export { SourceQueueOptions } from './queue';

config({ silent: true, path: process.env.TWEET_STORE_DOTENV_FILE });

type TweetStatus = "inserted" | "ignored";

export interface TweetStoreOptions {
  queue: SourceQueueOptions;
  database: DatabaseOptions;
  metrics: MetricsOptions;
}

const storeServiceInstanceCounter = new Counter(
  "tweetprocess_services_store",
  "Number of running store services",
);

const storeServiceTweetsCounter = new Counter(
  "tweetprocess_tweets_stored",
  "Number of tweets stored",
  ["userId", "screenName", "storeStatus"]
);

const logger = createLogger("store", "index");

function handleTweet(
  tweet: Tweet,
  screenName: string,
  database: pgpromise.IConnected<any>
): Promise<TweetStatus> {
  return database.tx(async (trans: pgpromise.ITask<any>) => {
    const result = await trans.one({
      name: "check-tweet",
      text: "SELECT CAST(COUNT(tweet_id) AS INT) FROM raw_tweets WHERE tweet_id = $1",
      values: [tweet.id],
    });

    const status: TweetStatus = result.count
      ? "ignored"
      : "inserted";

    if (status === "inserted") {
      await trans.query({
        name: "insert-tweet",
        text: "INSERT INTO raw_tweets (tweet_id, screen_name, content) VALUES ($1, $2, $3)",
        values: [tweet.id, screenName, tweet]
      });
    }
    return status;
  }).then((status) => {
    storeServiceTweetsCounter.labels(tweet.user.id.toString(), screenName, status).inc();
    const context = { tweetId: tweet.id, userId: tweet.user.id };
    switch (status) {
    case "inserted":
      logger.info("Tweet has been inserted", context);
      break;

    case "ignored":
      logger.info("Tweet already exists in the database, ignoring", context);
      break;

    default:
      logger.warn(`Unknown tweet insertion status: ${status}`, context);
      break;
    }

    return status;
  }).catch(error => {
    logger.error(`Error while processing tweet ${tweet.id}: ${error.message}`, { error });
    return Promise.reject(error);
  })
}

export function startStoreService(options: TweetStoreOptions): Promise<{ stop: () => Promise<void>}> {
  const connectionFactory = pgpromise({
    capSQL: true
  });
  const database = connectionFactory(options.database.connectionString);

  MetricsClient.start(options.metrics);
  storeServiceInstanceCounter.inc();

  return Promise.all([
    database.connect(),
    SourceQueue.create<Tweet>(options.queue),
  ]).then(([database, source]) => {
    storeServiceInstanceCounter.inc();

    const consumer = source.createConsumer();
    const processor = consumer
      .finally(async () => 
        await source.close()
      ).flatMap(tweetMessage => 
        handleTweet(tweetMessage.content, <string>tweetMessage.headers["screenName"], database).then(status => {
          tweetMessage.ack();
          return tweetMessage;
        })
      ).publish();

    const processingSub = processor.connect();

    return {
      stop: (): Promise<any> =>
        Promise.all([
          processingSub.unsubscribe(),
          database.done(),
          MetricsClient.stop()
        ])
    };
  });
}
