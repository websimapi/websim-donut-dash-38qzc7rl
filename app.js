import * as THREE from 'three';
import {height,fresh,step,impulse,biome,BIOMES} from './server.js';
import {donutFactory} from './donut.js';
import {landscape} from './landscape.js';
import {atmosphere} from './atmosphere.js';
import {aimControl} from './aim.js';
import {impactEffects} from './effects.js';
const $=id=>document.getElementById(id), low=new URLSearchParams(location.search).get('gpu')==='false'||window.websim?.lowGpu;
let inputSeq=0,pending=[];
let seed=314159, mode='menu', me=fresh(), socket=null, myId=null, connected=false, ghosts=new Map(), focusId=null, toastTimer, lastRender=0, previous=performance.now(), finishShown=false;
const scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({canvas:$('game'),antialias:!low,alpha:false});renderer.setPixelRatio(low?.65:Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;renderer.shadowMap.enabled=!low;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.1,500),air=atmosphere(scene,renderer,low),world=landscape(scene,low),donut=donutFactory(low),player=donut(),impacts=impactEffects(scene,low);scene.add(player);
const mat=(color,roughness=1)=>low?new THREE.MeshLambertMaterial({color}):new THREE.MeshStandardMaterial({color,roughness});
function updateChunks(z){world.update(z);}
const crumbCount=low?0:320,crumbGeo=new THREE.IcosahedronGeometry(.045,0),crumbMat=mat('#ffe6bb',.65),crumbs=new THREE.InstancedMesh(crumbGeo,crumbMat,Math.max(1,crumbCount));crumbs.frustumCulled=false;scene.add(crumbs);const dummy=new THREE.Object3D();let crumbIndex=0,crumbDistance=0,crumbX=0;
function clearCrumbs(){for(let i=0;i<Math.max(1,crumbCount);i++){dummy.position.set(0,-10000,0);dummy.scale.setScalar(0);dummy.updateMatrix();crumbs.setMatrixAt(i,dummy.matrix);}crumbs.instanceMatrix.needsUpdate=true;crumbDistance=0;crumbX=0;}clearCrumbs();
function sugar(p){if(low||p.status!=='rolling'||Math.hypot(p.z-crumbDistance,p.x-crumbX)<.4)return;crumbDistance=p.z;crumbX=p.x;for(let j=0;j<3;j++){dummy.position.set(p.x+(Math.random()-.5)*.8,height(p.x,p.z,seed)+.06,p.z-Math.random()*.6);dummy.rotation.set(Math.random()*6,Math.random()*6,0);dummy.scale.setScalar(.5+Math.random()*1.6);dummy.updateMatrix();crumbs.setMatrixAt(crumbIndex++%crumbCount,dummy.matrix);}crumbs.instanceMatrix.needsUpdate=true;}
function place(obj,p,t){obj.position.set(p.x,height(p.x,p.z,seed)+1.22-Math.abs(Math.sin(p.lean))*.8+(p.hop||0),p.z);obj.rotation.set(0,p.yaw||0,p.lean,'YXZ');obj.userData.wheel.rotation.z=p.wobble;const pulse=p.pulse||0,impact=p.impact||0;obj.scale.set(1+pulse*.09,1-pulse*.10-impact*.06,1+pulse*.05);if(p.status==='rolling')obj.scale.y*=1-Math.sin(p.wobble*2)*.018;}
function setSeed(s){seed=s;world.reset(seed);clearCrumbs();impacts.reset();me=fresh();updateChunks(0);camera.position.set(8,height(0,0,seed)+24,-12);$('world').textContent='MEADOW / '+String(seed).padStart(6,'0');}
function notice(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function send(m){if(connected)socket.send(m);}
function start(){aim.hide();impacts.reset();pending=[];mode='playing';finishShown=false;me=fresh();me.status='rolling';me.v=3;me.spin=4;clearCrumbs();document.body.classList.add('playing');$('menu').hidden=true;$('hud').hidden=false;$('end').hidden=true;send({type:'start'});}
function menu(){aim.hide();impacts.reset();mode='menu';me=fresh();document.body.classList.remove('playing');$('menu').hidden=false;$('hud').hidden=true;$('end').hidden=true;send({type:'menu'});}
function finish(saved){aim.hide();if(finishShown)return;finishShown=true;mode='over';$('end').hidden=false;$('result').textContent=Math.floor(me.progress).toLocaleString();$('save-status').textContent=saved?'Your best roll is saved.':connected?'Finishing your run…':'Solo run · live room is unavailable.';}
function addGhost(p){if(p.id===myId)return;let g=ghosts.get(p.id);if(!g){let mesh=donut();mesh.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.67;}});scene.add(mesh);g={mesh,state:fresh(),target:fresh(),username:p.username};ghosts.set(p.id,g);}Object.assign(g.state,p);Object.assign(g.target,p);}
function liveLabel(){$('live-profile').hidden=true;const rolling=[...ghosts.values()].filter(g=>g.target.status==='rolling');if(rolling.length){let g=rolling.find(g=>g===ghosts.get(focusId))||rolling[0];focusId=[...ghosts.entries()].find(([id,q])=>q===g)?.[0];$('live').textContent=mode==='menu'?'LIVE · WATCHING'+(g.username?'':' A GUEST'):(rolling.length+1)+' ROLLING · GHOSTS ON';if(mode==='menu'&&g.username){$('live-profile').hidden=false;$('live-profile').href='https://websim.com/@'+encodeURIComponent(g.username);$('live-avatar').src='https://images.websim.com/avatar/'+encodeURIComponent(g.username);$('live-name').textContent='@'+g.username;}}else{$('live').textContent=connected?'LIVE · THE MOUNTAIN IS YOURS':'SOLO · THE MOUNTAIN IS YOURS';focusId=null;}}
async function connect(){try{const data=await(await fetch('/api/world')).json();setSeed(data.seed);}catch{setSeed(seed);}try{socket=await WebsimSocket.joinRoom();connected=true;socket.onmessage=event=>{const m=JSON.parse(event.data);
 if(m.type==='welcome'){myId=m.id;setSeed(m.seed);for(const g of ghosts.values())scene.remove(g.mesh);ghosts.clear();m.players.forEach(addGhost);if(mode==='playing')start();liveLabel();}
 if(m.type==='world'){setSeed(m.seed);for(const g of ghosts.values()){g.state=fresh();g.target=fresh();}notice('A fresh mountain. A fresh start.');}
 if(m.type==='join')addGhost(m.player);
 if(m.type==='left'){const g=ghosts.get(m.id);if(g){scene.remove(g.mesh);ghosts.delete(m.id);}}
 if(m.type==='idle'){const g=ghosts.get(m.id);if(g)g.target.status='idle';}
 if(m.type==='started'){if(m.id!==myId){if(!ghosts.has(m.id))addGhost({id:m.id});const g=ghosts.get(m.id);Object.assign(g.state,m.state);Object.assign(g.target,m.state);}}
 if(m.type==='snapshot'){for(const p of m.players){if(p.id===myId){if(mode==='playing'){pending=pending.filter(q=>q.seq>p.seq);const corrected={...p};for(const q of pending)impulse(corrected,q.power,q.steer,q.forward);step(corrected,Math.min(.08,Math.max(0,(Date.now()-m.t)/1000)),seed);for(const k of ['x','z','v','vx','spin','lean','wobble','time','flat','yaw','hop','vy','progress'])me[k]+=(corrected[k]-me[k])*.45;if(p.hits>me.hits){me.hits=p.hits;me.hitX=p.hitX;me.hitZ=p.hitZ;me.impact=p.impact;me.pulse=p.pulse;}if(p.status==='over'){Object.assign(me,p);finish(false);}}}else{if(!ghosts.has(p.id))addGhost(p);Object.assign(ghosts.get(p.id).target,p);}}}
 if(m.type==='finished'&&m.id===myId){me.status='over';me.progress=m.distance;finish(m.saved);$('save-status').textContent=m.saved?'Your best roll is saved.':'Sign in to keep your best roll.';}
 if(m.type==='notice')notice(m.text);liveLabel();};socket.onclose=e=>{connected=false;notice('Live room disconnected. You can still roll solo.');liveLabel();};socket.onreconnect=()=>{connected=true;notice('Reconnected to the mountain.');};liveLabel();}catch(e){connected=false;liveLabel();}}
$('play').onclick=start;$('again').onclick=start;$('back').onclick=menu;$('quit').onclick=menu;$('home').onclick=e=>{e.preventDefault();menu();};$('new-world').onclick=()=>{if(connected)send({type:'world'});else setSeed(Math.floor(100000+Math.random()*900000));};
$('scores').onclick=async()=>{$('leaderboard').showModal();$('score-list').textContent='Loading rolls…';try{const rows=await(await fetch('/api/leaderboard')).json();$('score-list').textContent='';if(!rows.length){const li=document.createElement('li');li.textContent='Fresh tracks. Be the first high roller.';$('score-list').append(li);}rows.forEach((r,i)=>{const li=document.createElement('li'),rank=document.createElement('span'),link=document.createElement('a'),avatar=document.createElement('img'),name=document.createElement('span'),score=document.createElement('strong');rank.className='rank';rank.textContent=String(i+1).padStart(2,'0');link.href='https://websim.com/@'+encodeURIComponent(r.username);link.target='_blank';link.rel='noopener';avatar.src='https://images.websim.com/avatar/'+encodeURIComponent(r.username);avatar.alt='';name.textContent='@'+r.username;link.append(avatar,name);score.textContent=r.distance.toLocaleString()+' m';li.append(rank,link,score);$('score-list').append(li);});}catch{$('score-list').textContent='Couldn’t load the leaderboard. Try again.';}};$('close-scores').onclick=()=>$('leaderboard').close();
const aim=aimControl($('game'),scene,camera,()=>({...me,groundHeight:height}),()=>mode==='playing',vector=>{const input={...vector,seq:++inputSeq};impulse(me,input.power,input.steer,input.forward);if(connected){pending.push(input);send({type:'push',...input});}},low);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let hudTime=0;const camTarget=new THREE.Vector3(),look=new THREE.Vector3();
function keepCameraClear(){
 // Enforce clearance AFTER smoothing and impact shake, at the camera's actual position.
 const pos=camera.position;
 let safeY=height(pos.x,pos.z,seed)+8;
 for(const dx of [-.8,.8])for(const dz of [-.8,.8])safeY=Math.max(safeY,height(pos.x+dx,pos.z+dz,seed)+8);
 // Also keep the whole viewing ray clear of intervening ridges.
 for(let i=1;i<20;i++){
  const t=i/20,x=pos.x+(look.x-pos.x)*t,z=pos.z+(look.z-pos.z)*t;
  const surface=height(x,z,seed)+.85;
  safeY=Math.max(safeY,(surface-look.y*t)/(1-t));
 }
 pos.y=Math.max(pos.y,safeY);
}
function tick(){const now=performance.now(),dt=Math.min(.05,(now-previous)/1000);previous=now;if(mode==='playing'){step(me,dt,seed);sugar(me);if(me.status==='over')finish(false);}for(const g of ghosts.values()){for(const k of ['x','z','lean','wobble','pulse','yaw','hop','impact'])g.state[k]+=(g.target[k]-g.state[k])*(1-Math.exp(-dt*13));g.state.status=g.target.status;g.mesh.visible=g.target.status!=='idle';place(g.mesh,g.state,now);}
 let p=me;const watching=mode==='menu'&&focusId&&ghosts.get(focusId);if(watching)p=watching.state;
 player.visible=!watching;place(player,p,now);updateChunks(p.z);impacts.update(me,dt,seed);air.update(p,now/1000,seed);aim.update(now,seed);
 const y=height(p.x,p.z,seed);if(mode==='menu'&&!watching){camTarget.set(p.x+8,y+24,p.z-12);look.set(p.x-4.5,height(p.x-4.5,p.z+2,seed)+1.4,p.z+2);player.rotation.z=.05+Math.sin(now*.0008)*.04;player.userData.wheel.rotation.z=now*.00007;}else{camTarget.set(p.x+3,y+22,p.z-10);look.set(p.x,height(p.x,p.z+2,seed)+1.4+(p.hop||0)*.3,p.z+2);}camTarget.y=Math.max(camTarget.y,height(camTarget.x,camTarget.z,seed)+12);camera.position.lerp(camTarget,1-Math.exp(-dt*5.5));if(!low&&p.impact>0){camera.position.x+=Math.sin(now*.052)*p.impact*.13;camera.position.y+=Math.cos(now*.045)*p.impact*.08;}keepCameraClear();camera.lookAt(look);
 hudTime+=dt;if(hudTime>.1){hudTime=0;$('world').textContent=BIOMES[biome(p.z)].name+' / '+seed;$('distance').textContent=Math.floor(me.progress).toLocaleString();$('speed').textContent=Math.round(Math.hypot(me.v,me.vx)*3.6);$('balance').style.width=Math.max(0,100-Math.abs(me.lean)/1.57*100)+'%';$('balance').style.background=Math.abs(me.lean)>.8?'#b96842':'#385b40';}
 if(!low||now-lastRender>1000){renderer.render(scene,camera);lastRender=now;}}
setSeed(seed);connect();if(low)setInterval(tick,16);else{function loop(){tick();requestAnimationFrame(loop);}requestAnimationFrame(loop);}
