import {samplePath} from './track-math.js';

export const zoneConcepts = {
  braking: {
    title: 'Braking into a bend', color: '#ffc984', equation: 'a = (v₂ − v₁) / Δt',
    explanation: 'The tyre force points back along the path as the car slows. The chassis pitches forward and the front axle carries more vertical load. Braking while turning shares the tyre’s available grip between two jobs.',
    example: 'Slowing from 240 to 120 km/h in 3 s gives an average longitudinal acceleration of −11.1 m/s² in this example.',
    diagram: [['Velocity', 236, 83, '#8ce4ff'], ['Tyre force', 44, 83, '#ffc984']]
  },
  cornering: {
    title: 'Cornering and lateral grip', color: '#9fe0a7', equation: 'aᵧ = v² / R',
    explanation: 'Velocity points along the tangent. Lateral acceleration points toward the centre of the bend. The tyres supply the lateral force that changes the direction of travel.',
    example: 'At 144 km/h (40 m/s) around an 80 m radius, the required lateral acceleration is 20 m/s², about 2.04 g.',
    diagram: [['Velocity', 236, 83, '#8ce4ff'], ['Lateral force', 140, 32, '#9fe0a7']]
  },
  traction: {
    title: 'Traction on corner exit', color: '#f4add3', equation: 'aₓ = Fₓ,net / m',
    explanation: 'As the steering opens, lateral demand drops and the driven tyres can allocate more of their grip to acceleration. If throttle demand exceeds available grip, the driven wheels can slip.',
    example: 'A net forward force of 4,000 N on an 800 kg car gives 5 m/s² of longitudinal acceleration.',
    diagram: [['Velocity', 236, 83, '#8ce4ff'], ['Drive force', 224, 117, '#f4add3']]
  },
  straight: {
    title: 'Drag and downforce on a straight', color: '#8ce4ff', equation: 'D = ½ρv²CᴅA · P = Dv',
    explanation: 'Aerodynamic drag opposes motion. Downforce acts toward the road. At fixed air density and coefficients, doubling speed quadruples both forces and multiplies the power needed to overcome drag by eight.',
    example: 'With ρ = 1.225 kg/m³ and CᴅA = 1.5 m², 216 km/h (60 m/s) requires about 198 kW to overcome aerodynamic drag.',
    diagram: [['Velocity', 236, 83, '#8ce4ff'], ['Drag', 44, 83, '#ffc984'], ['Downforce', 140, 139, '#9fe0a7']]
  }
};

export function trackPhysicsZones(path) {
  const count = 120;
  const gap = (a,b) => Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  const curvature = Array.from({length:count},(_,i) => {
    const fraction = i / count;
    const here = samplePath(path,fraction);
    const before = samplePath(path,fraction-.015);
    const after = samplePath(path,fraction+.015);
    return gap(Math.atan2(here.x-before.x,here.z-before.z),
      Math.atan2(after.x-here.x,after.z-here.z));
  });
  const bend = curvature.indexOf(Math.max(...curvature)) / count;
  const separation = (a,b) => Math.abs(((a-b+1.5)%1)-.5);
  let straight = -1;
  for (let i=0;i<count;i++) {
    if (separation(i/count,bend)<.16) continue;
    if (straight<0 || curvature[i]<curvature[straight]) straight=i;
  }
  return [
    ['braking',bend-.065], ['cornering',bend], ['traction',bend+.065], ['straight',straight/count]
  ].map(([id,fraction]) => ({id,fraction:(fraction+1)%1,...zoneConcepts[id]}));
}

export function zoneDiagram(zone) {
  const sideView = zone.id === 'straight';
  const car = sideView
    ? '<path d="M103 81h22l12-10h19l11 10h13v12h-77z" fill="#405460"/><circle cx="117" cy="96" r="8"/><circle cx="169" cy="96" r="8"/>'
    : '<path d="M110 72h64v22h-64z" fill="#405460"/><path d="M120 67v32m44-32v32" stroke="#9bb0b7" stroke-width="6"/>';
  const vectors = zone.diagram.map(([label,x,y,color],i) => {
    const ox = i === 1 && zone.id === 'traction' ? 140 : x < 140 ? 99 : x > 140 ? 180 : 140;
    const oy = zone.id==='traction' && i===1 ? y : y < 60 ? 67 : y > 115 ? 99 : 83;
    const id = 'zone-arrow-'+i;
    const labelX = Math.max(44, Math.min(x,235));
    const labelY = y === 139 ? 158 : y > 115 ? y + 17 : y - 12;
    return `<defs><marker id="${id}" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="${color}"/></marker></defs>
<line x1="${ox}" y1="${oy}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="2.5" marker-end="url(#${id})"/>
<text x="${labelX}" y="${labelY}" fill="${color}" text-anchor="middle">${label}</text>`;
  }).join('');
  return `<svg viewBox="0 0 280 166" role="img" aria-label="${zone.title} diagram. Vectors show directions only.">
<rect width="280" height="166" rx="5" fill="#14232d"/>
<text x="12" y="17" fill="#a8bdc7">${sideView?'SIDE VIEW':'TOP VIEW'}</text>
${zone.id==='cornering'?'<path d="M14 43Q65 95 142 95T266 43" fill="none" stroke="#56717b" stroke-dasharray="5 5"/>':''}${car}${vectors}</svg>`;
}
