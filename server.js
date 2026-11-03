export const schema = `
CREATE TABLE IF NOT EXISTS scores (user_id TEXT PRIMARY KEY, username TEXT, distance INTEGER NOT NULL DEFAULT 0, seed INTEGER);
CREATE INDEX IF NOT EXISTS scores_distance ON scores(distance DESC);
`;
export function hash(n,seed){const a=Math.sin(n*127.1+seed*.183)*43758.5453;return a-Math.floor(a);}
export const BIOMES=[
 {name:'SUNLIT MEADOW',start:0,ground:'#9cac70',shade:'#60724a',path:'#cab68d',tree:'#365b3a',rock:'#87917e',sky:'#c8dee7',fog:'#d5e0d5',sun:'#fff1ce',kind:'pine'},
 {name:'CEDAR FOREST',start:400,ground:'#6f8551',shade:'#344a37',path:'#a0956d',tree:'#1f4634',rock:'#718175',sky:'#b9d1db',fog:'#bbcfc2',sun:'#ffead0',kind:'pine'},
 {name:'AMBER WOODLAND',start:900,ground:'#a48658',shade:'#6f6548',path:'#d1aa79',tree:'#b6642d',rock:'#8e8275',sky:'#ded3c5',fog:'#decbb1',sun:'#ffd4a0',kind:'broad'},
 {name:'FROST RIDGE',start:1500,ground:'#dee4e6',shade:'#9bafbc',path:'#c0d1d9',tree:'#537579',rock:'#768e9c',sky:'#bed7e5',fog:'#d2e1e8',sun:'#ebf5ff',kind:'frost'},
 {name:'OBSIDIAN FALLS',start:2300,ground:'#63606a',shade:'#33383f',path:'#8b7770',tree:'#6a655e',rock:'#444650',sky:'#9fabbc',fog:'#a5aab9',sun:'#ffd0a2',kind:'stone'}
];
export function biome(z){let i=0;for(let j=1;j<BIOMES.length;j++)if(z>=BIOMES[j].start)i=j;return i;}
export function difficulty(z){return 1+Math.min(4,Math.max(0,z)/700)+.6*Math.log1p(Math.max(0,z-2800)/1800);}
export function pathCenter(z,seed){return Math.sin(z*.008+seed)*Math.min(13,Math.max(0,z)*.04);}
export function height(x,z,seed){const s=(seed%10000)*.017,d=difficulty(z),q=Math.max(0,z),center=pathCenter(z,seed);
 return 110-z*.30-.16*(q-500*(1-Math.exp(-q/500))) + (2.5+.45*(d-1))*(Math.sin(z*.065+s)-Math.sin(s)) + (1.1+.16*(d-1))*(Math.sin(z*.17+s*2)-Math.sin(s*2)) + .0045*(x-center)*(x-center) + Math.sin(x*.13+z*.043+s)*Math.min(2.3,q*.035) + Math.min(1.5,q*.001)*Math.sin(z*.31+x*.24+s);
}
const obstacleCache=new Map();
export function obstacles(index,seed){const key=seed+':'+index;if(obstacleCache.has(key))return obstacleCache.get(key);const out=[],d=difficulty(index*100),b=biome(index*100),count=34+Math.floor(d*5);
 for(let i=0;i<count;i++){const n=index*997+i*23,z=index*100+hash(n+1,seed)*100;let x=(hash(n+2,seed)-.5)*160;const path=pathCenter(z,seed);if(Math.abs(x-path)<7)x+=x<path?-8:8;const scale=.7+hash(n+3,seed)*1.3;const type=hash(n+4,seed)>(b===4?.93:.32)?'tree':'rock';out.push({id:index+':'+i,x,z,scale,type,b,yaw:hash(n+5,seed)*6.28,rx:type==='tree'?.3*scale:1.2*scale,rz:type==='tree'?.3*scale:.9*scale});}
 const hazards=4+Math.floor((d-1)*4);
 for(let i=0;i<hazards;i++){const n=index*1511+i*79+8801,z=index*100+10+hash(n,seed)*80;if(z<38)continue;const x=pathCenter(z,seed)+(hash(n+1,seed)-.5)*(24-Math.min(8,d*1.2)),scale=.65+hash(n+2,seed)*.85,type=hash(n+3,seed)>(b===4?.97:.48)?'tree':'rock';out.push({id:index+':h'+i,x,z,scale,type,b,yaw:hash(n+4,seed)*6.28,rx:type==='tree'?.3*scale:1.2*scale,rz:type==='tree'?.3*scale:.9*scale});}
 obstacleCache.set(key,out);if(obstacleCache.size>100)obstacleCache.delete(obstacleCache.keys().next().value);return out;
}
export function fresh(){return {x:0,z:0,v:0,vx:0,spin:0,lean:.03,wobble:0,flat:0,time:0,status:'idle',pulse:0,yaw:0,hop:0,vy:0,impact:0,hits:0,hitX:0,hitZ:0,progress:0,seq:0};}
export function impulse(p,power,steer,forward=1){if(p.status!=='rolling'||p.flat>1.1)return;const len=Math.hypot(steer,forward)||1,dx=steer/len,dz=forward/len;p.v=Math.max(-9,Math.min(54,p.v+dz*power*7));p.vx=Math.max(-17,Math.min(17,p.vx+dx*power*8));p.spin=Math.min(18,p.spin+power*4.3);p.lean*=.72;p.pulse=1;}
function contact(p,ox,oz,nx,nz,seed){let first=null;for(let index=Math.floor(Math.min(oz,nz)/100)-1;index<=Math.floor(Math.max(oz,nz)/100)+1;index++)for(const o of obstacles(index,seed)){
 if(Math.abs(o.z-nz)>o.rz+3||Math.abs(o.x-nx)>o.rx+3)continue;
 const c=Math.cos(o.yaw),s=Math.sin(o.yaw),rx=o.rx+.62,rz=o.rz+.62;
 const ax=((ox-o.x)*c-(oz-o.z)*s)/rx,az=((ox-o.x)*s+(oz-o.z)*c)/rz;
 const bx=((nx-o.x)*c-(nz-o.z)*s)/rx,bz=((nx-o.x)*s+(nz-o.z)*c)/rz,dx=bx-ax,dz=bz-az,A=dx*dx+dz*dz,B=2*(ax*dx+az*dz),C=ax*ax+az*az-1;let t=null;
 if(C<0)t=0;else if(A>1e-10){let disc=B*B-4*A*C;if(disc>=0){const hit=(-B-Math.sqrt(disc))/(2*A);if(hit>=0&&hit<=1)t=hit;}}
 if(t===null||first&&t>first.t)continue;let hx=ax+dx*t,hz=az+dz*t;if(Math.hypot(hx,hz)<.0001){hx=-dx;hz=-dz;}const norm=Math.hypot(hx,hz)||1;hx/=norm;hz/=norm;let normalX=hx/rx*c+hz/rz*s,normalZ=-hx/rx*s+hz/rz*c;const nlen=Math.hypot(normalX,normalZ);normalX/=nlen;normalZ/=nlen;
 first={t,nx:normalX,nz:normalZ,x:o.x+hx*rx*c+hz*rz*s,z:o.z-hx*rx*s+hz*rz*c};}
 if(first){const dot=p.vx*first.nx+p.v*first.nz;p.x=first.x+first.nx*.015;p.z=first.z+first.nz*.015;if(dot<0){p.vx-=1.36*dot*first.nx;p.v-=1.36*dot*first.nz;p.vx*=.75;p.v*=.75;const impact=Math.min(1,Math.abs(dot)/16);p.impact=impact;p.pulse=1;p.spin=Math.max(0,p.spin-impact*5);p.lean+=(first.nx<0?-1:1)*(.12+impact*.44);p.vy=Math.max(p.vy,impact*2.8);p.hits++;p.hitX=p.x;p.hitZ=p.z;}}else{p.x=nx;p.z=nz;}
}
export function step(p,dt,seed){if(p.status!=='rolling')return;const count=Math.ceil(dt/.02);for(let i=0;i<count;i++)advance(p,dt/count,seed);}
function advance(p,dt,seed){if(p.status!=='rolling')return;p.time+=dt;const d=difficulty(p.z),slope=height(p.x,p.z+.5,seed)-height(p.x,p.z-.5,seed),cross=height(p.x+.5,p.z,seed)-height(p.x-.5,p.z,seed),ice=biome(p.z)===3;
 p.spin=Math.max(0,p.spin-dt*(1.55+(d-1)*.18));p.v+=(-slope*10-1.1-Math.abs(p.v)*.065)*dt;p.v=Math.max(-10,Math.min(54,p.v));p.vx+=(-cross*3-p.vx*(ice?.22:.46))*dt;
 const ox=p.x,oz=p.z;contact(p,ox,oz,ox+p.vx*dt,oz+p.v*dt,seed);if(Math.abs(p.x)>88){p.x=Math.sign(p.x)*88;p.vx*=-.45;p.lean+=Math.sign(p.x)*.15;}
 const rough=Math.sin(p.z*.17+seed)*.7+Math.sin(p.z*.071)*.4;p.lean+=(rough*(.10+(d-1)*.02)+p.vx*.01+(p.spin<1.5?.11:-.25*p.lean))*dt;
 if(p.time>3&&p.spin<.8)p.lean+=(p.lean<0?-1:1)*dt*(.22+(d-1)*.025);p.lean=Math.max(-1.57,Math.min(1.57,p.lean));p.yaw+=(Math.atan2(p.vx,Math.max(2,p.v))-p.yaw)*(1-Math.exp(-dt*6));p.wobble+=Math.hypot(p.v,p.vx)*(p.v<0?-1:1)*dt/1.24;
 p.vy-=14*dt;p.hop=Math.max(0,p.hop+p.vy*dt);if(p.hop===0){if(p.vy<-.8)p.pulse=Math.max(p.pulse,Math.min(1,-p.vy/5));p.vy=0;}
 p.pulse=Math.max(0,p.pulse-dt*2.8);p.impact=Math.max(0,p.impact-dt*2.2);p.progress=Math.max(p.progress,p.z);
 if(Math.abs(p.lean)>1.25){p.v*=Math.exp(-dt*3);p.vx*=Math.exp(-dt*3);p.flat+=dt;}else p.flat=0;
 if(p.flat>1.7&&Math.hypot(p.v,p.vx)<.7){p.status='over';p.v=0;p.vx=0;p.lean=Math.sign(p.lean)*1.57;}}
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
 if(m.type==='push' && Date.now()-p.lastPush>90){p.lastPush=Date.now();impulse(p.state,Math.max(.15,Math.min(1.5,Number(m.power)||0)),Math.max(-1,Math.min(1,Number(m.steer)||0)),Math.max(-1,Math.min(1,Number(m.forward) || (m.forward===0?0:1))));p.state.seq=Math.max(p.state.seq,Math.min(1e9,Math.floor(Number(m.seq)||0))); }
 if(m.type==='world'){if([...players.values()].some(q=>q.state.status==='rolling')){conn.send({type:'notice',text:'The mountain is busy. Try a new world when everyone finishes.'});return;}seed=Math.floor(Math.random()*900000)+100000;for(const q of players.values())q.state=fresh();room.broadcast({type:'world',seed});}
 },
 async onTick(room,env){const now=Date.now(),dt=Math.min(.15,(now-last)/1000);last=now;let changed=false;const writes=[];
 for(const p of players.values()){if(p.state.status!=='rolling')continue;changed=true;step(p.state,dt,seed);if(p.state.status==='over'&&!p.saved){p.saved=true;const c=connections.get(p.id);if(c?.identity==='user'){writes.push(env.DB.prepare('INSERT INTO scores (user_id,username,distance,seed) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET distance=MAX(distance,excluded.distance),seed=CASE WHEN excluded.distance>distance THEN excluded.seed ELSE seed END,username=excluded.username').bind(c.userId,c.username,Math.floor(p.state.progress),seed));}room.broadcast({type:'finished',id:p.id,distance:Math.floor(p.state.progress),saved:c?.identity==='user'});}}
 if(changed)room.broadcast({type:'snapshot',t:now,players:[...players.values()].map(p=>({id:p.id,...Object.fromEntries(Object.entries(p.state).map(([k,v])=>[k,typeof v==='number'?Math.round(v*1000)/1000:v]))}))});if(writes.length)await env.DB.batch(writes);
 },
 async onClose(conn,room,env){players.delete(conn.id);connections.delete(conn.id);room.broadcast({type:'left',id:conn.id});if(players.size===0)seed=Math.floor(Math.random()*900000)+100000;}
};