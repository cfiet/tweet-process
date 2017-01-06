import { Connection, Channel, Options } from 'amqplib';
import { Observable, Subscriber } from 'rxjs';
import { Url, parse } from 'url';

import { unwrapPromise } from '../common/promise';

import { Logger } from '../common/logging';
import { 
  QueueOptions,
  ChannelOptions,
  createChannel,
  ExchangeType,
  Serializer,
  JsonSerializer,
  TransferMessage,
  Message
} from '../common/queue';

export interface SourceQueueOptions extends QueueOptions, ChannelOptions {
  exchangeName: string;

  queue: {
    name: string;
    options?: Options.AssertQueue
  };

  routingPattern: string;
}

export interface IncomingMessage<TData> {
  readonly messageId: string;
  readonly correlationId: string;
  readonly timestamp: number;
  readonly content: TData;
  ack(): void;
  nack(): void;
}

class IncomingRabbitMessage<TData> implements IncomingMessage<TData> {
  constructor(
    private _channel: Channel,
    private _message: Message,
    private _serializer: Serializer<TData>
  ) { }

  get messageId () {
    return this._message.properties.messageId;
  }

  get correlationId () {
    return this._message.properties.correlationId;
  }

  get timestamp () {
    return this._message.properties.timestamp;;
  }

  private _content: TData;
  get content () {
    if (this._content === undefined) {
      this._content = this._serializer.deserialize({
        contentType: this._message.properties.contentType,
        contentEncoding: this._message.properties.contentEncoding,
        content: this._message.content
      });
    }
    return this._content;
  }

  public ack(): void {
    this._channel.ack(this._message);
  }

  public nack(): void {
    this._channel.nack(this._message);
  }
}
 
export class SourceQueue<TData> {
  private constructor(
    private _connection: Connection,
    private _channel: Channel,
    private _logger: Logger,
    private _options: SourceQueueOptions,
    private _serializer: Serializer<TData> = new JsonSerializer<TData>()
  ) { }

  public getMessage(): Promise<IncomingMessage<TData>> {
    return unwrapPromise(this._channel.get(this._options.queue.name).then(result => {
      if (typeof result === "boolean") {
        return null;
      }
      return this._processMessage(result);
    }));
  }

  public createConsumer(): Observable<IncomingMessage<TData>> {
    return new Observable<IncomingMessage<TData>>((sub: Subscriber<IncomingMessage<TData>>) => {
      this._channel.consume(this._options.queue.name, message => {
        const { messageId, correlationId, timestamp, appId } = message.properties;
        const contentLength = message.content.length;
        try {
          const incomingMessage = this._processMessage(message);
          if (incomingMessage !== null) {
            this._logger.debug(`Consumed message`, { messageId, correlationId, timestamp, contentLength, appId });
            sub.next(incomingMessage);
          } else {
            this._logger.debug(`Skipping message`, { messageId, correlationId, timestamp, contentLength, appId });
          }
        } catch (e) {
          this._logger.error(`Failed to consume the message`, { messageId, correlationId, timestamp, contentLength });
          sub.error(e);
        }
      }).then(consumerReply => {
        this._logger.info(`Consumer created`, consumerReply);
      }).catch((error: Error) => {
        this._logger.error(`Failed to create consumer`, { error });
        sub.error(error);
      });
    })
    
  }

  public async close(closeConnection = false): Promise<void> {
    await this._channel.close();

    if (closeConnection) {
      await this._connection.close();
    }
  }

  private _processMessage(message: Message): IncomingMessage<TData> {
    const { messageId, correlationId, contentType, appId } = message.properties;
    
    if (!message) { 
      return null;
    }

    if (!this._serializer.isSupported(contentType)) {
      this._logger.warn(`Message content type is not supported`, {
        contentType,
        messageId,
        correlationId,
        appId,
        contentLength: message.content.length
      });
      this._channel.nack(message);
      return null;
    }

    return new IncomingRabbitMessage<TData>(this._channel, message, this._serializer);
  }

  public static async create<TData>(options: SourceQueueOptions): Promise<SourceQueue<TData>> {
    const { exchangeName, queue, routingPattern } = options;
    return createChannel(options).then(ctx => {
      const { channel, logger } = ctx;

      const exchangeAssertionPromise = channel.checkExchange(exchangeName)
        .then(() => {
          logger.info(`Exchange is avaliable`, { exchangeName });
        })
        .catch((error: Error) => {
          logger.error(`Exchange is not avaliable`, { exchangeName, error });
          return Promise.reject(error);
        });

      const queueEnsurePromise = channel.assertQueue(queue.name, queue.options)
        .then(() => {
          logger.info(`Queue is avaliable`, { queueName: queue.name });
        }).catch((error: Error) => {
          logger.error(`Queue is not avaliable`, { queueName: queue.name, error });
          return Promise.reject(error);
        });

      return Promise.all([
        unwrapPromise(exchangeAssertionPromise),
        unwrapPromise(queueEnsurePromise),
      ])
      .then(() => ctx);
    }).then(ctx => {
      const { connection, channel, logger } = ctx;
      return unwrapPromise(channel.bindQueue(queue.name, exchangeName, routingPattern).then(() => {
        logger.info(`Queue has been successfully bound to an exchange`, { 
          queue: queue.name,
          exchange: exchangeName,
          routingPattern
        });

        return new SourceQueue<TData>(connection, channel, logger, options);
      })).catch((error: Error) => {
        logger.error(`An error occured while binding queue to an exchange: ${error.message}`, {
          queue: queue.name,
          exchange: exchangeName,
          routingPattern,
          error
        });
        return Promise.reject(error);
      });
    });
  }
}