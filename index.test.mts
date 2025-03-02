import assert from 'node:assert';
import {test} from "node:test";
import {STOP, HALT, spawn} from './Actor.mts';

test("can receive and stop", async () => {
  let nr = 0;

  const bob = spawn(() => {
    nr++;
  });

  bob.send('hello');
  bob.send('world');
  bob.send(STOP);
  await bob.wait();

  assert.equal(nr, 2);
});

test("can restart and receive messages", async () => {
  let nr = 0;

  const bob = spawn(() => {
    nr++;
  });

  bob.start();

  bob.send('hello');
  bob.send('world');
  bob.send(STOP);
  await bob.wait();

  assert.equal(nr, 2);
});

test("can handle multiple messages and halt", async () => {
  let nr = 0;

  const bob = spawn(() => {
    nr++;
  });

  for (let i = 0; i < 1000; i++) {
    bob.send('hello');
  }
  bob.send(HALT);
  await bob.wait();
  bob.purge();
  assert.equal(nr, 0);
});

test("can sync and continue processing", async () => {
  let nr = 0;

  const bob = spawn(() => {
    nr++;
  });

  for (let i = 1; i <= 1000; i++) {
    bob.send('hello');
    if (i === 500) {
      await bob.sync();
      assert.equal(nr, 500);
    }
  }
  bob.send(STOP);
  await bob.wait();
  assert.equal(nr, 1000);
});