import {inject} from 'overnew';
import {Defer, Disposable} from './utils.mts';
import {Observable, type Observer, Subject, type Subscribable, type Unsubscribable} from 'rxjs';


export interface Context {
  next(message: any): void;
  handler: Handler;
}

type Subscriber = (message: any) => void;
type Handler = (message: any, ctx: Context) => any | Promise<any>;

export function spawn(handler: Handler) {
  return new Consumer(handler);
}

export const STOP = Symbol('stop');
export const PAUSE = Symbol('pause');

export abstract class Mailbox implements AsyncIterable<any> {
  abstract [Symbol.asyncIterator](): AsyncIterator<any, any, any>;
  abstract peek(): any;
  /** Removes all messages  */
  abstract purge(): void;
  abstract send(message: any): void;
}

export class MailboxImpl implements Mailbox {
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
    if (message === PAUSE) {
      this._messages.unshift(PAUSE);
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

    if (value === PAUSE) {
      return {value, done: true};
    }

    this._ready = new Defer();
    return {value, done: value === STOP};
  }
}

export class Consumer extends Disposable implements Subscribable<any> {
  private _handler: Handler;
  private _mailbox: Mailbox = inject(Mailbox) ?? new MailboxImpl();
  private _loop: Promise<void> | null = null;
  private _emitter: Subject<any> = new Subject<any>();
  constructor(handler: Handler) {
    super();
    this._handler = handler;
    this.start();
  }

  next(message: any) {
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
          const result = await this._handler(message, this._toContext());
          if (result) {
            this._emitter.next(result);
          }
        } catch (error) {
          console.error(error);
        }
      }
      this._loop = null;
    })().catch(error => {
      console.error(error);
    }).finally(() => {
      this._emitter.complete();
    });
  }

  async wait() {
    return await (this._loop ?? Promise.resolve());
  }

  pause() {
    this.next(PAUSE);
    return this.wait();
  }

  stop() {
    this.next(STOP);
    return this.wait();
  }

  sync() {
    const defer = new Defer();
    this.next({type: 'sync', promise: defer});
    return defer.promise;
  }

  subscribe(observer: Subscriber | Partial<Observer<any>>): Unsubscribable {
    if (typeof observer === 'function') {
      observer = {next: observer};
    }
    return this._emitter.subscribe(observer);
  }

  sink(stop = false) {
    return (source: Observable<any>) => {
      const sub = source.subscribe({
        next: (message) => {
          this.next(message);
        },
        complete: () => {
          if (stop) {
            this.next(STOP);
          }
        }
      });

      this.autoDispose({
        dispose: () => {
          sub.unsubscribe();
        }
      });

      return this._emitter;
    };
  }

  private _toContext(): Context {
    return {
      next: m => this._emitter.next(m),
      get handler() {
        return this._handler;
      },
      set handler(h) {
        this._handler = h;
      }
    };
  }
}
