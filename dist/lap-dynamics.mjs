export const dynamicsAssumptions = {mass:800, gravity:9.80665, height:.32, wheelbase:3.6, track:1.65, frontShare:.46, mu:1.65};

export function lapDynamics({speed,acceleration,lateral,drag,downforce,power}) {
  const {mass,gravity,height,wheelbase,track,frontShare,mu}=dynamicsAssumptions;
  const weight=mass*gravity, normal=weight+downforce;
  const tyre=mass*acceleration+drag, lateralForce=mass*lateral;
  const forwardTransfer=-tyre*height/wheelbase;
  const outsideTransfer=Math.abs(lateralForce)*height/track;
  const front=normal*frontShare+forwardTransfer, rear=normal-front;
  const grip=mu*normal;
  return {weight,normal,tyre,lateralForce,forwardTransfer,outsideTransfer,front,rear,grip,
    usage:Math.hypot(tyre,lateralForce)/grip,
    radius:Math.abs(lateral)>1e-3?speed**2/Math.abs(lateral):Infinity,
    yawRate:lateral/speed,
    kineticEnergy:.5*mass*speed**2,
    brakingPower:Math.max(0,-tyre*speed), dragPower:power,
    kineticPower:mass*speed*acceleration};
}
