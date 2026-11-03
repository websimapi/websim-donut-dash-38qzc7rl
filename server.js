export const schema = `
CREATE TABLE IF NOT EXISTS scores (user_id TEXT PRIMARY KEY, username TEXT, distance INTEGER NOT NULL DEFAULT 0, seed INTEGER);
CREATE INDEX IF NOT EXISTS scores_distance ON scores(distance DESC);
`;
export function height(x,z,seed){
 const s=(seed%10000)*0.017;
 return 110-z*.30 + 2.5*(Math.sin(z*.065+s)-Math.sin(s)) + 1.1*(Math.sin(z*.17+s*2)-Math.sin(s*2)) + .0045*x*x + Math.sin(x*.13+z*.043+s)*Math.min(2,z*.035);
}
export function fresh(){return {x:0,z:0,v:0,vx:0,spin:0,lean:0.03,wobble:0,flat:0,time:0,status:'idle',pulse:0};}
export function impulse(p,power,steer){if(p.status!=='rolling')return;p.v=Math.min(42,p.v+power*6);p.spin=Math.min(15,p.spin+power*5);p.vx+=steer*2.5;p.lean*=.7;p.pulse=1;}
export function step(p,dt,seed){
 if(p.status!=='rolling')return;
 p.time+=dt;
 const slope=(height(p.x,p.z+.5,seed)-height(p.x,p.z-.5,seed));
 p.spin=Math.max(0,p.spin-dt*1.65);
 p.v+=(-slope*11-1.4-p.v*.08)*dt;
 p.v=Math.max(0,Math.min(42,p.v));
 p.vx+=(-p.x*.038-p.vx*.7)*dt;p.x+=p.vx*dt;p.z+=p.v*dt;
 const rough=Math.sin(p.z*.17+seed)*.7+Math.sin(p.z*.071)*.4;
 p.lean+=(rough*.11+ p.vx*.018 + (p.spin<1.5 ? .13 : -.19*p.lean))*dt;
 p.lean=Math.max(-1.57,Math.min(1.57,p.lean));
 if(p.time>3 && p.spin<.8)p.lean+=(p.lean<0?-1:1)*dt*.22;
 p.wobble+=p.v*dt/1.24;p.pulse=Math.max(0,p.pulse-dt*3);
 if(Math.abs(p.lean)>1.25){p.v*=Math.exp(-dt*3);p.flat+=dt;}else p.flat=0;
 if(p.flat>1.7 && p.v<.7){p.status='over';p.v=0;p.lean=Math.sign(p.lean)*1.57;}
}
let seed=Math.floor(Math.random()*900000)+100000;
const players=new Map(), connections=new Map();let last=Date.now();
function publicPlayer(p){return {id:p.id,username:p.username,...p.state};}
export default {async fetch(req,env){const path=new URL(req.url).pathname;
 if(path==='/api/world')return Response.json({seed});
 if(path==='/api/leaderboard'){const {results}=await env.DB.prepare('SELECT username,distance,seed FROM scores ORDER BY distance DESC LIMIT 20').all();return Response.json(results);}
 return Response.json({error:'Not found'},{status:404});
}};
export const room={tickMs:50,
 async onConnect(conn,room,env){if(players.size===0){seed=Math.floor(Math.random()*900000)+100000;last=Date.now();}const p={id:conn.id,username:conn.username,state:fresh(),lastPush:0,saved:false};players.set(conn.id,p);connections.set(conn.id,conn);conn.send({type:'welcome',id:conn.id,seed,players:[...players.values()].map(publicPlayer)});room.broadcast({type:'join',player:publicPlayer(p)},{except:[conn.id]});},
 async onMessage(conn,message,room,env){let m;try{m=JSON.parse(message)}catch{return}const p=players.get(conn.id);if(!p)return;
 if(m.type==='start'){p.state=fresh();p.state.status='rolling';p.state.v=3;p.state.spin=4;p.saved=false;room.broadcast({type:'started',id:p.id,state:p.state});}
 if(m.type==='menu'){p.state.status='idle';room.broadcast({type:'idle',id:p.id});}
 if(m.type==='push' && Date.now()-p.lastPush>90){p.lastPush=Date.now();impulse(p.state,Math.max(.15,Math.min(1.5,Number(m.power)||0)),Math.max(-1,Math.min(1,Number(m.steer)||0)));}
 if(m.type==='world'){if([...players.values()].some(q=>q.state.status==='rolling')){conn.send({type:'notice',text:'The mountain is busy. Try a new world when everyone finishes.'});return;}seed=Math.floor(Math.random()*900000)+100000;for(const q of players.values())q.state=fresh();room.broadcast({type:'world',seed});}
 },
 async onTick(room,env){const now=Date.now(),dt=Math.min(.15,(now-last)/1000);last=now;let changed=false;const writes=[];
 for(const p of players.values()){if(p.state.status!=='rolling')continue;changed=true;step(p.state,dt,seed);if(p.state.status==='over'&&!p.saved){p.saved=true;const c=connections.get(p.id);if(c?.identity==='user'){writes.push(env.DB.prepare('INSERT INTO scores (user_id,username,distance,seed) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET distance=MAX(distance,excluded.distance),seed=CASE WHEN excluded.distance>distance THEN excluded.seed ELSE seed END,username=excluded.username').bind(c.userId,c.username,Math.floor(p.state.z),seed));}room.broadcast({type:'finished',id:p.id,distance:Math.floor(p.state.z),saved:c?.identity==='user'});}}
 if(changed)room.broadcast({type:'snapshot',t:now,players:[...players.values()].map(p=>({id:p.id,...Object.fromEntries(Object.entries(p.state).map(([k,v])=>[k,typeof v==='number'?Math.round(v*1000)/1000:v]))}))});if(writes.length)await env.DB.batch(writes);
 },
 async onClose(conn,room,env){players.delete(conn.id);connections.delete(conn.id);room.broadcast({type:'left',id:conn.id});if(players.size===0)seed=Math.floor(Math.random()*900000)+100000;}
};