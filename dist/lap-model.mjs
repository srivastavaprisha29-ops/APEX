import {samplePath} from './track-math.js';

export function simulateLap(path, length) {
  const count = 480, step = length / count;
  const wrap = i => (i + count) % count;
  const points = Array.from({length:count}, (_,i) => samplePath(path,i/count));
  const curvature = points.map((p,i) => {
    const a = points[wrap(i-3)], b = points[wrap(i+3)];
    const turn = Math.atan2(b.z-p.z,b.x-p.x)-Math.atan2(p.z-a.z,p.x-a.x);
    return Math.atan2(Math.sin(turn),Math.cos(turn))/(3*step);
  });
  const speeds = curvature.map((k,i) => Math.min(88,Math.sqrt(22/Math.max(
    Math.abs(k),Math.abs(curvature[wrap(i-1)]),1e-6))));
  // Sweep the closed loop twice in each direction to enforce acceleration and braking limits.
  for (let i=0;i<count*2;i++) {
    const at=i%count, next=wrap(at+1);
    speeds[next]=Math.min(speeds[next],Math.sqrt(speeds[at]**2+10*step));
  }
  for (let i=count*2-1;i>=0;i--) {
    const at=i%count, next=wrap(at+1);
    speeds[at]=Math.min(speeds[at],Math.sqrt(speeds[next]**2+24*step));
  }
  let duration=0;
  const segments=points.map((point,i)=>{
    const speed=speeds[i], exit=speeds[wrap(i+1)];
    const seconds=2*step/(speed+exit);
    const segment={...point,speed,acceleration:(exit-speed)/seconds,curvature:curvature[i],
      start:duration,distance:i*step};
    duration+=seconds;
    return segment;
  });
  return {segments,duration,step,length};
}

export function sampleLap(lap,time) {
  const t=((time%lap.duration)+lap.duration)%lap.duration;
  let lo=0,hi=lap.segments.length;
  while (hi-lo>1) {
    const mid=(lo+hi)>>1;
    if (lap.segments[mid].start>t) hi=mid;
    else lo=mid;
  }
  const a=lap.segments[lo], b=lap.segments[(lo+1)%lap.segments.length];
  const dt=t-a.start, speed=a.speed+a.acceleration*dt;
  const travelled=a.speed*dt+.5*a.acceleration*dt**2, fraction=travelled/lap.step;
  const pressure=.5*1.225*speed**2, drag=pressure*1.5;
  return {x:a.x+(b.x-a.x)*fraction,z:a.z+(b.z-a.z)*fraction,
    angle:Math.atan2(b.z-a.z,b.x-a.x),distance:a.distance+travelled,speed,
    lateral:speed**2*a.curvature,acceleration:a.acceleration,drag,downforce:pressure*4.5,power:drag*speed};
}
