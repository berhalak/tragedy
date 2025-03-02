import assert from 'node:assert';
import {test} from "node:test";

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

type Handler = (message: any) => void | Promise<void>;

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

const STOP = Symbol('stop');
const HALT = Symbol('halt');

class Mailbox implements AsyncIterable<any> {
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

class Actor {
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
    this._loop = (async () => {
      for await (const message of this._mailbox) {
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

}


test("just works", async () => {

  let nr = 0;

  const bob = spawn(() => {
    nr++;
  });

  bob.send('hello');
  bob.send('world');
  bob.send(STOP);
  await bob.wait();

  bob.start();

  bob.send('hello');
  bob.send('world');
  bob.send(STOP);
  await bob.wait();

  assert.equal(nr, 4);

  bob.start();
  for (let i = 0; i < 1000; i++) {
    bob.send('hello');
  }
  bob.send(HALT);
  await bob.wait();
  bob.purge();
  assert.equal(nr, 4);


  bob.start();
  for (let i = 0; i < 1000; i++) {
    bob.send('hello');
  }
  bob.send(STOP);
  await bob.wait();
  assert.equal(nr, 1004);
});