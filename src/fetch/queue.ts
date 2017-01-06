import { Url, parse } from 'url';
import { connect, Connection, Channel, Message } from 'amqplib';

import * as When from 'when';

import { Tweet } from '../common/data';
import { createLogger } from '../common/logging';
import { Counter } from '../common/metrics';
import { Serializer, JsonSerializer, QueueOptions, ChannelOptions, createChannel, ExchangeType } from '../common/queue';

export type PromiseOrWhen<T> = Promise<T> | When.Promise<T>;

export interface ExchangeSinkOptions extends QueueOptions, ChannelOptions {
  exchangeName: string;
  type: ExchangeType;
  assert: boolean;
  messageType: string;
}

export class DefaultExchangeSinkOptions implements ExchangeSinkOptions {
  public type: ExchangeType = "topic";
  public assert = true;
  public prefetch: number;
  
  constructor(
    public queueUrl: string,
    public exchangeName: string,
    public messageType: string = null,
    public appId: string = "tweet-process"
  ) { }
}

export interface PublishOptions {
  correlationId?: string;
  headers?: { [key: string]: string|number|boolean };
}

export class ExchangeSink<TData> {
  constructor(
    private _connection: Connection,
    private _channel: Channel,
    private _options: ExchangeSinkOptions,
    private _serializer: Serializer<TData> = new JsonSerializer<TData>()
  ) {
  }

  public publish(data: TData, routingKey: string, messageId: string, options: PublishOptions = {}) {
    const message = this._serializer.serialize(data);
    const { headers, correlationId } = options;
    this._channel.publish(this._options.exchangeName, routingKey, message.content, {
      contentType: message.contentType,
      contentEncoding: message.contentEncoding,
      timestamp: Date.now(),
      appId: this._options.appId,
      type: this._options.messageType,
      messageId,
      correlationId,
      headers
    });
  }

  public async close(closeConnection = false): Promise<void> {
    await this._channel.close();

    if (closeConnection) {
      await this._connection.close();
    }
  }

  public static create<TData>(options: ExchangeSinkOptions): Promise<ExchangeSink<TData>> {
    return createChannel(options).then((ctx) => {
        if (options.assert) {
          ctx.logger.info("Ensuring target exchange exists", { exchangeName: options.exchangeName });
          return ctx.channel.assertExchange(options.exchangeName, options.type)
            .then(() => ctx);
        }

        ctx.logger.info("Checking, if target exchange exists", { exchangeName: options.exchangeName });
        return ctx.channel.checkExchange(options.exchangeName)
          .then(() => ctx);
    })
    .then(({ connection, channel, logger }) => {
      return new ExchangeSink<TData>(connection, channel, options);
    });
  }
}
