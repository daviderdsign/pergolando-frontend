export type StablePoint={xNorm:number;yNorm:number};
export type TouchStability={anchor:StablePoint;since:number;locked:boolean};
export function stabilizeTouch(state:TouchStability,point:StablePoint,now:number,width:number,height:number):StablePoint{
 const distance=Math.hypot((point.xNorm-state.anchor.xNorm)*width,(point.yNorm-state.anchor.yNorm)*height);
 if(!state.locked&&now-state.since>=180&&distance<=12)state.locked=true;
 if(state.locked){
  if(distance<=12)return state.anchor;
  state.locked=false;state.anchor={...point};state.since=now;return point;
 }
 if(distance>2){state.anchor={...point};state.since=now;}
 return point;
}
