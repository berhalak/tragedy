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

  ownedBy(owner: Disposable) {
    owner.autoDispose(this);
  }
}

class Mailbox extends DisposableImpl {

}

class Actor extends DisposableImpl {
  public mailBox = new Mailbox();



  
  public async sayHello() {}
}

class ActorSystem extends DisposableImpl {
  public get(type, name: string) {
    return new type();
  }
}

test("just works", () => {

  const system = new ActorSystem();
  const bob = system.get(Actor, 'bob');

  bob.sayHello();

});