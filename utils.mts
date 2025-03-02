export interface Disposable {
  dispose(): void;
  autoDispose<T extends Disposable>(child: T): T;
}

export class DisposableImpl implements Disposable {
  private _children: Disposable[] = [];
  dispose(): void {
    this._children.forEach(d => d.dispose());
  }
  autoDispose<T extends Disposable>(child: T) {
    this._children.push(child);
    return child;
  }
}

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
