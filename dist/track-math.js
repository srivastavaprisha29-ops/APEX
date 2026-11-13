export const raceCars=[{id:'rb19',name:'Red Bull RB19',year:2023,constructor:'red_bull',color:'#70c8ed'},{id:'rb20',name:'Red Bull RB20',year:2024,constructor:'red_bull',color:'#6eb8ff'},{id:'rb21',name:'Red Bull RB21',year:2025,constructor:'red_bull',color:'#87a7ff'},{id:'rb22',name:'Red Bull RB22',year:2026,constructor:'red_bull',color:'#a1bbff'},{id:'mcl38',name:'McLaren MCL38',year:2024,constructor:'mclaren',color:'#ffb264'}];
export const layoutIds={albert_park:'au-1953',bahrain:'bh-2002',shanghai:'cn-2004',catalunya:'es-1991',monaco:'mc-1929',villeneuve:'ca-1978',ricard:'fr-1969',red_bull_ring:'at-1969',silverstone:'gb-1948',hockenheimring:'de-1932',hungaroring:'hu-1986',spa:'be-1925',monza:'it-1922',marina_bay:'sg-2008',sochi:'ru-2014',suzuka:'jp-1962',americas:'us-2012',rodriguez:'mx-1962',interlagos:'br-1940',yas_marina:'ae-2009',imola:'it-1953',nurburgring:'de-1927',portimao:'pt-2008',mugello:'it-1914',sepang:'my-1999',istanbul:'tr-2005',zandvoort:'nl-1948',magny_cours:'fr-1960',estoril:'pt-1972',jacarepagua:'br-1977',jeddah:'sa-2021',miami:'us-2022',losail:'qa-2004',madring:'es-2026',baku:'az-2016',vegas:'us-2023',indianapolis:'us-1909',galvez:'ar-1952',kyalami:'za-1961',watkins_glen:'us-1956'};
export function lapMilliseconds(value) {
  const match = typeof value === 'string' && /^(\d{1,3}):([0-5]\d)\.(\d{3})$/.exec(value);
  if (!match) return null;
  const milliseconds = Number(match[1]) * 60000 + Number(match[2]) * 1000 + Number(match[3]);
  return milliseconds || null;
}

export function lapSeconds(value) {
  const milliseconds = lapMilliseconds(value);
  return milliseconds === null ? null : milliseconds / 1000;
}

export function formatLap(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Unavailable';
  const milliseconds = Math.round(seconds * 1000);
  const minutes = Math.floor(milliseconds / 60000);
  return minutes + ':' + ((milliseconds % 60000) / 1000).toFixed(3).padStart(6, '0');
}

export function bestLap(snapshot, circuitId, car) {
  let best = null;
  for (const race of snapshot.seasons[String(car.year)] || []) {
    if (race.circuitId !== circuitId) continue;
    for (const result of race.results || []) {
      if (result.constructor !== car.constructor) continue;
      const milliseconds = lapMilliseconds(result.fastestLap?.Time?.time);
      if (milliseconds === null || (best && milliseconds >= best.milliseconds)) continue;
      const speed = result.fastestLap.AverageSpeed;
      const kph = speed?.units === 'kph' ? Number(speed.speed) : NaN;
      best = {
        ...result, race, date: race.date, milliseconds, seconds: milliseconds / 1000,
        averageSpeed: Number.isFinite(kph) && kph > 0 ? kph : null
      };
    }
  }
  return best;
}

export function compareLaps(a, b) {
  if (!a || !b) return null;
  const difference = a.milliseconds - b.milliseconds;
  const sameEvent = a.race.season === b.race.season && a.race.round === b.race.round;
  return {
    milliseconds: Math.abs(difference),
    leader: difference === 0 ? null : difference < 0 ? 'A' : 'B',
    sameEvent
  };
}

export function normalizedPath(feature){const coords=feature.geometry.coordinates;if(feature.geometry.type!=='LineString'||coords.length<3)throw Error('A circuit LineString is required');const lat=coords.reduce((a,p)=>a+p[1],0)/coords.length*Math.PI/180,lon0=coords[0][0],lat0=coords[0][1];let points=coords.map(([lon,y])=>[(lon-lon0)*Math.cos(lat)*111320,-(y-lat0)*110540]);points=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>.01);if(Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])>.1)points.push([...points[0]]);const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),scale=190/Math.max(maxX-minX,maxZ-minZ);points=points.map(([x,z])=>[(x-(maxX+minX)/2)*scale,(z-(maxZ+minZ)/2)*scale]);const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));return {points,distances,length:distances.at(-1)}}
export function samplePath(path,fraction){const d=((fraction%1)+1)%1*path.length;let lo=0,hi=path.distances.length-1;while(hi-lo>1){const mid=(hi+lo)>>1;if(path.distances[mid]>d)hi=mid;else lo=mid}const a=path.points[lo],b=path.points[hi],span=path.distances[hi]-path.distances[lo],t=span?(d-path.distances[lo])/span:0;return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,heading:Math.atan2(b[0]-a[0],b[1]-a[1])}}
export function apiRacesToSnapshot(races){return races.map(r=>({season:r.season,round:r.round,date:r.date,raceName:r.raceName,circuitId:r.Circuit.circuitId,url:r.url,results:(r.Results||[]).map(x=>({driver:x.Driver.givenName+' '+x.Driver.familyName,code:x.Driver.code||'',constructor:x.Constructor.constructorId,constructorName:x.Constructor.name,position:x.position,status:x.status,laps:x.laps,fastestLap:x.FastestLap}))}))}
