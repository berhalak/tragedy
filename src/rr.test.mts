import assert from 'node:assert';
import {test} from "node:test";
import {STOP, PAUSE, spawn} from './Actor.mts';
import {Subject} from 'rxjs';
import {map, takeUntil} from 'rxjs/operators';

test("just fulling around", async () => {
  const subject = new Subject<any>();

  
  const actor = spawn((m: number, ctx) => {
    ctx.next(m);
  });
  

  actor.subscribe(l => console.log(l));
  actor.subscribe({
    complete: () => console.log('complete'),
    error: e => console.log('error', e),
  });

  subject
    .pipe(map(m => m * 10))
    .pipe(actor.sink())
    .subscribe(actor);

  subject.next(1);
  subject.next(2);
  subject.next(3);

  console.log('Waiting for actor to stop');

  await actor.stop();
});


