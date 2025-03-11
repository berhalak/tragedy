import assert from 'node:assert';
import {test} from "node:test";
import {Signal} from './Signal.mts';

test("works", async () => {
  const signal = new Signal();

  let nr = 0;

  const ds = signal.addListener(a => nr += a);
  await signal.emit(10);
  assert.equal(nr, 10);
  ds.dispose();
  await signal.emit(10);
  assert.equal(nr, 10);  
});

test("can connect", async () => {

  

});
