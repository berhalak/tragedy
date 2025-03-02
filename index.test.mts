import assert from 'node:assert';
import { test } from "node:test";

interface Disposable {
  dispose(): void;
  autoDispose<T extends Disposable>(child: T): T;
}

class DisposableImpl implements Disposable {
  private _children: Disposable[] = [];
  dispose(): void {
    this._children.forEach(d => d.dispose());
  }
  autoDispose<T extends Disposable>(child: T) {
    this._children.push(child);
    return child;
  }
}

type Handler = (message: any) => void|Promise<void>;

function spawn(handler: Handler) {
  return new Actor(handler);
}

class Defer {
  private _resolve!: () => void;
  private _reject!: (error: any) => void;
  private _promise = new Promise<void>((resolve, reject) => {
    this._resolve = resolve;
    this._reject = reject;
  });
  resolve() {
    this._resolve();
  }
  reject(error: any) {
    this._reject(error);
  }
  get promise() {
    return this._promise;
  }
}

const DONE = Symbol('done');
const STOP = Symbol('stop');

class Mailbox implements AsyncIterable<any> {

  private _messages: any[] = [];
  private _ready : Defer = new Defer();

  send(message: any) {
    this._messages.push(message);
    this._ready.resolve();    
  }
  [Symbol.asyncIterator](): AsyncIterator<any, any, any> {
    return this;
  }
  async next() {
    if (this._messages.length === 0) {
      await this._ready.promise;
    }
    this._ready = new Defer();
    const value = this._messages.shift();
    return { value, done: value === DONE };
  }
}

class Actor {
  private _mailbox = new Mailbox();
  private _loop: Promise<void>|null = null;
  private _stop = false;
  private _handler: Handler;
  constructor(handler: Handler) {
    this._handler = handler;
  }
  send(message: any) {

    if (message === STOP) {
      this.stop();
      return;
    }

    this._mailbox.send(message);
    if (!this._loop) {
      this.start();
    }
  }
  start() {
    this._loop = (async () => {
      for await (const message of this._mailbox) {
        try {
          await this._handler(message);
        } catch (error) {
          console.error(error);
        }
        if (this._stop) {
          break;
        }
      }
      this._loop = null;
    })();
  }
  stop() {
    this._stop = true;
    return this.wait();
  }
  wait() {
    return this._loop ?? Promise.resolve();
  }
}


test("just works", async () => {

  let nr= 0;

  const bob = spawn((message) => {
    nr++;
  });

  bob.send('hello');
  bob.send('world');
  bob.send(DONE);
  await bob.wait();
  assert.equal(nr, 2);

});