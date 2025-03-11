import type {MaybePromise} from './utils.mts';

export interface IDisposable {
  dispose(): void;
}

export class Disposable implements IDisposable {
  private _children: IDisposable[] = [];
  dispose(): void {
    this._children.forEach(d => d.dispose());
  }
  autoDispose<T extends IDisposable>(child: T): T {
    this._children.push(child);
    return child;
  }
}

type Listener<T = any> = (arg: T) => MaybePromise<void>;
type Transformer<T, U> = (arg: T) => MaybePromise<U>;

export class Signal<T = any> extends Disposable {
  private _listeners:Listener<T>[] = [];

  dispose() {
    this._listeners = [];
    super.dispose();
  }

  async emit(arg: T) {
    for (const listener of this._listeners) {
      await listener(arg);
    }
  }
  addListener(listener: (arg: T) => void) {
    this._listeners.push(listener);
    return {
      dispose: () => {
        const index = this._listeners.indexOf(listener);
        this._listeners.splice(index, 1);
      }
    };
  }

  map<U>(owner: Disposable, fn: Transformer<T, U>) {
    const signal = owner.autoDispose(new Signal<U>());
    owner.autoDispose(this.addListener(async arg => {
      const value = await fn(arg);
      await signal.emit(value);
    }));
    return signal;
  }
}