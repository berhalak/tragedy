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

export type MaybePromise<T> = T | Promise<T>;

export class Defer {
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

