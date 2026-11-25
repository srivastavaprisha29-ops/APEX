import {dynamicsAssumptions} from './lap-dynamics.mjs';

const angle = degrees => degrees*Math.PI/180;

export function bankedTurn({speed,radius,bank,mu}) {
  const {gravity:g,mass}=dynamicsAssumptions;
  const theta=angle(bank), a=speed**2/radius;
  const normal=mass*(g*Math.cos(theta)+a*Math.sin(theta));
  const friction=mass*(a*Math.cos(theta)-g*Math.sin(theta));
  return {normal,friction,limit:mu*normal,neutralSpeed:Math.sqrt(radius*g*Math.tan(theta))};
}

export function slipAngles({speed,beta,steer,yawRate}) {
  const {wheelbase,frontShare}=dynamicsAssumptions;
  const vx=speed*Math.cos(angle(beta)), vy=speed*Math.sin(angle(beta));
  const frontCourse=Math.atan2(vy+yawRate*wheelbase*(1-frontShare),vx);
  const rearCourse=Math.atan2(vy-yawRate*wheelbase*frontShare,vx);
  return {front:steer-frontCourse*180/Math.PI,rear:-rearCourse*180/Math.PI};
}

export function energyLedger(lap,point) {
  const initialSpeed=lap.segments[0].speed;
  const {mass}=dynamicsAssumptions;
  const deltaK=.5*mass*(point.speed**2-initialSpeed**2);
  let dragLoss=0;
  // Under constant acceleration within each segment, v² is linear in distance.
  for (let i=0; i<lap.segments.length && lap.segments[i].distance<point.distance;i++) {
    const a=lap.segments[i], b=lap.segments[(i+1)%lap.segments.length];
    const length=Math.min(lap.step,point.distance-a.distance);
    const exitSquared=a.speed**2+(b.speed**2-a.speed**2)*length/lap.step;
    dragLoss+=.5*1.225*1.5*(a.speed**2+exitSquared)/2*length;
  }
  return {deltaK,dragLoss,tyreWork:deltaK+dragLoss};
}
