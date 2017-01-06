export interface TransferMessage {
  contentType: string;
  contentEncoding: string;
  content: Buffer;
}

export interface Serializer<TContent> {
  isSupported(contentType: string): boolean;
  serialize(data: TContent, encoding?: string): TransferMessage;
  deserialize(message: TransferMessage): TContent;
}

const JSON_CONTENT_TYPE = "application/json";

export class JsonSerializer<TContent> implements Serializer<TContent> {
  public prettyfy: boolean = false;

  public isSupported(contentType: string) {
    return JSON_CONTENT_TYPE.toLowerCase() === (contentType || "").toLowerCase();
  }

  public serialize(data: TContent, encoding: string = "utf8"): TransferMessage {
    let textContet = JSON.stringify(data, undefined, !this.prettyfy ? undefined : 2);
    let content = new Buffer(textContet, encoding);

    return {
      contentType: JSON_CONTENT_TYPE,
      contentEncoding: encoding,
      content
    };
  }

  public deserialize(message: TransferMessage): TContent {
    if (!this.isSupported(message.contentType)) {
      throw new Error(`Unsupported content type: ${message.contentType}`);
    }
    let textContent = message.content.toString(message.contentEncoding);
    return JSON.parse(textContent);
  }
}