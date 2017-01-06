import { connect, Connection, Channel } from 'amqplib';
import { Url, parse } from 'url';
import * as when from 'when';

import { createLogger, Logger } from '../logging';
import { QueueOptions, ChannelOptions } from './options';

const DEFAULT_AMQP_PORT = 5672

export { Message } from 'amqplib';

export type ExchangeType = "direct" | "fanout" | "topic";

export * from './options';
export * from './serialization';

export interface ConnectionContext {
  queueUrl: Url;
  connection: Connection;
  logger: Logger;
}

export interface ChannelContext extends ConnectionContext {
  channel: Channel;
}

export function createConnection(options: QueueOptions): Promise<ConnectionContext> {
  const queueUrl = parse(options.queueUrl);
  const hostname = queueUrl.hostname;
  const port = queueUrl.port || DEFAULT_AMQP_PORT;
  const logger = createLogger("common", "queue", `${hostname}:${port}`);

  logger.info("Connecting to queue");
  const connectionPromise = connect(queueUrl.href).then(connection => {
    logger.info("Connected to queue");

    connection.on("close", () =>
      logger.info("Connection closed")
    );

    connection.on("error", (error: Error) => 
      logger.error(`Connection failed: ${error.message}`, { error })
    );

    return {
      queueUrl,
      connection,
      logger
    };
  }).catch(error => {
    logger.error("An error occured while connecting to queue");
    return when.reject<ConnectionContext>(error);
  });

  return new Promise<ConnectionContext>((resolve, reject) => {
    connectionPromise.then(resolve).catch(reject);
  });
}

export function createConnectionChannel(ctx: ConnectionContext, options: ChannelOptions): Promise<ChannelContext> {
    const { logger, connection } = ctx;
    logger.info("Creating channel");
    
    const channelCreationPromise = connection.createChannel().then(channel => {
      logger.info("Channel created");

      channel.on("close", () => 
        logger.info("Channel closed")
      );

      channel.on("error", (error: Error) => 
        logger.error(`Channel failed: ${error.message}`, { error })
      );

      return channel.prefetch(options.prefetch).then(() => {
        logger.info(`Channel prefetch set to: ${options.prefetch}`);
        return <ChannelContext>Object.assign({
          channel
        }, ctx)
      });

    }).catch((error: Error) => {
      logger.error(`An error occured while creating the channel: ${error.message}`, { error });
      return when.reject(error);
    });

    return new Promise<ChannelContext>((resolve, reject) => {
      channelCreationPromise.then(resolve).catch(reject);
    });
}

export function createChannel(options: QueueOptions & ChannelOptions): Promise<ChannelContext> {  
  return createConnection(options).then(ctx => 
    createConnectionChannel(ctx, options)
  );
}