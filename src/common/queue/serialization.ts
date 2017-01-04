export interface TransferMessage {
  contentType: string;
  contentEncoding: string;
  content: Buffer;
}

export interface Serializer<TContent> {
  contentType: string;
  serialize(data: TContent, encoding?: string): TransferMessage;
  deserialize(message: TransferMessage): TContent;
}

export class JsonSerializer<TContent> implements Serializer<TContent> {
  public contentType: string = "application/json";
  public prettyfy: boolean = false;

  public serialize(data: TContent, encoding: string = "utf8"): TransferMessage {
    let textContet = JSON.stringify(data, undefined, !this.prettyfy ? undefined : 2);
    let content = new Buffer(textContet, encoding);

    return {
      contentType: this.contentType,
      contentEncoding: encoding,
      content
    };
  }

  public deserialize(message: TransferMessage): TContent {
    if (message.contentType.toLowerCase() !== this.contentType) {
      throw new Error(`Unsupported content type: ${message.contentType}`);
    }
    let textContent = message.content.toString(message.contentEncoding);
    return JSON.parse(textContent);
  }
}