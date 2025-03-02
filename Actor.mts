import {Defer} from './utils.mts';

type Handler = (message: any) => void | Promise<void>;

export function spawn(handler: Handler) {
  return new Actor(handler);
}

export const STOP = Symbol('stop');
export const HALT = Symbol('halt');

export class Mailbox implements AsyncIterable<any> {
  private _messages: any[] = [];
  private _ready: Defer = new Defer();

  peek() {
    return this._messages[0];
  }

  purge() {
    this._messages = [];
    this._ready.resolve();
  }

  send(message: any) {
    if (message === HALT) {
      this._messages.unshift(HALT);
    } else {
      this._messages.push(message);
    }
    this._ready.resolve();
  }

  [Symbol.asyncIterator](): AsyncIterator<any, any, any> {
    return this;
  }

  async next() {
    if (this._messages.length === 0) {
      await this._ready.promise;
    }

    const value = this._messages.shift();

    if (value === HALT) {
      return {value, done: true};
    }

    this._ready = new Defer();
    return {value, done: value === STOP};
  }
}

export class Actor {
  private _mailbox = new Mailbox();
  private _loop: Promise<void> | null = null;
  private _handler: Handler;
  constructor(handler: Handler) {
    this._handler = handler;
    this.start();
  }

  send(message: any) {
    this._mailbox.send(message);
  }

  purge() {
    this._mailbox.purge();
  }

  start() {
    if (this._loop) {
      return;
    }
    this._loop = (async () => {
      for await (const message of this._mailbox) {

        if (typeof message === 'object') {
          if (message.type === 'sync' && message.promise instanceof Defer) {
            message.promise.resolve();
            continue;
          }
        }

        try {
          await this._handler(message);
        } catch (error) {
          console.error(error);
        }
      }
      this._loop = null;
    })().catch(error => {
      console.error(error);
    });
  }
  
  wait() {
    return this._loop ?? Promise.resolve();
  }

  halt() {
    this.send(STOP);
    return this.wait();
  }

  stop() {
    this.send(STOP);
    return this.wait();
  }

  async sync() {
    const defer = new Defer();
    this.send({type: 'sync', promise: defer});
    await defer.promise;
  }

}

