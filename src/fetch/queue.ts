import { Url, parse } from 'url';
import { connect, Connection, Channel, Message } from 'amqplib';

import * as When from 'when';

import { Tweet } from '../common/data';
import { createLogger } from '../common/logging';
import { Counter } from '../common/metrics';
import { Serializer, JsonSerializer } from '../common/queue/serialization';

export type PromiseOrWhen<T> = Promise<T> | When.Promise<T>;
export type ExchangeType = "direct" | "fanout" | "topic";
export interface ExchangeSinkOptions {
  queueUrl: string;
  appId: string;
  name: string;
  type: ExchangeType;
  assert: boolean;
  messageType: string;
}

export class DefaultExchangeSinkOptions implements ExchangeSinkOptions {
  public type: ExchangeType = "topic";
  public assert = true;
  
  constructor(
    public queueUrl: string,
    public name: string,
    public messageType: string = null,
    public appId: string = "tweet-process"
  ) { }
}

export class ExchangeSink<TData> {
  constructor(
    private _connection: Connection,
    private _channel: Channel,
    private _options: ExchangeSinkOptions,
    private _serializer: Serializer<TData> = new JsonSerializer<TData>()
  ) {
  }

  public publish(data: TData, routingKey: string, messageId: string, correlationId?: string) {
    const message = this._serializer.serialize(data);
    this._channel.publish(this._options.name, routingKey, message.content, {
      contentType: message.contentType,
      contentEncoding: message.contentEncoding,
      timestamp: Date.now(),
      messageId: messageId,
      correlationId: correlationId,
      appId: this._options.appId,
      type: this._options.messageType
    });
  }

  public async close(closeConnection = false): Promise<void> {
    await this._channel.close();

    if (closeConnection) {
      await this._connection.close();
    }
  }

  public static create<TData>(options: ExchangeSinkOptions): PromiseOrWhen<ExchangeSink<TData>> {
    const { hostname, port, href } =  parse(options.queueUrl);
    const logger = createLogger("fetch", "queue", `${hostname}:${port}`);

    logger.info("Connectiong to queue", { hostname, port });
    return connect(options.queueUrl).then(conn => {
      logger.info("Connected to queue, creating channel");
      return conn.createChannel().then(chan => {
        if (options.assert) {
          logger.info("Ensuring target exchange exists", { exchangeName: options.name });
          return chan.assertExchange(options.name, options.type)
            .then(() => chan);
        }

        logger.info("Checking, if target exchange exists", { exchangeName: options.name });
        return chan.checkExchange(options.name)
          .then(() => chan);
      })
      .then(chan => {
        return new ExchangeSink<TData>(conn, chan, options);
      });
    }).catch(error => {
      logger.error(`An error occured while creating tweets target: ${error.message}`, { error });
      return When.reject<ExchangeSink<TData>>(error);
    });
  }
  
}
