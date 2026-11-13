export function partFromHit(hit){
 if(!hit?.object)return null;
 let object=hit.object,part=null;
 while(object){if(object.visible===false)return null;if(!part&&object.userData?.system)part=object.userData.system;object=object.parent}
 return part;
}
export function tooltipPosition(x,y,width,height,viewportWidth,viewportHeight){return {left:Math.max(12,Math.min(x+18,viewportWidth-width-12)),top:Math.max(12,Math.min(y+18,viewportHeight-height-12))}}
