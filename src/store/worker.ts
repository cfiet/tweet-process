import * as clusterService from 'cluster-service';
clusterService.workerReady(false);

import { createLogger } from '../common/logging';
import { DefaultMetricsOptions } from '../common/metrics';
import { startStoreService } from './index';

const logger = createLogger("store", "worker");

logger.info("Starting store service");
startStoreService({
  queue: {
    queueUrl: process.env.TWEET_PROCESS_RABBITMQ_URL,
    appId: process.env.TWEET_PROCESS_QUEUE_APP_ID,
    exchangeName: process.env.TWEET_FETCH_EXCHANGE_NAME,
    prefetch: parseInt(process.env.TWEET_STORE_PREFETCH, 10),
    routingPattern: process.env.TWEET_STORE_ROUTING_PATTERN,
    queue: {
      name: process.env.TWEET_STORE_QUEUE_NAME
    }
  },

  database: {
    connectionString: process.env.TWEET_PROCESS_DATABASE_CONNECTION_STRING
  },

  metrics: new DefaultMetricsOptions(
    process.env.TWEET_PROCESS_METRICS_PUSHGATEWAY_URL,
    process.env.TWEET_STORE_METRICS_JOB_NAME
  )
})
.then(service => {
  logger.info(`Service started`);
  clusterService.workerReady({
    onWorkerStop: () => {
      logger.info(`Cleaning up service`);
      service.stop().then(() => {
        logger.info(`Cleanup completed, exiting`);
        process.exit(0);
      });
    }
  });
})
.catch((error: Error) => {
  logger.error(`An error occured while running store service: ${error.message}`, { error });
  process.exit(-1);
});