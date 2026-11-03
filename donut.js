import * as THREE from 'three';
export function donutFactory(low){
 const loader=new THREE.TextureLoader(),doughTexture=loader.load('img/dough.webp');doughTexture.colorSpace=THREE.SRGBColorSpace;doughTexture.wrapS=doughTexture.wrapT=THREE.RepeatWrapping;doughTexture.repeat.set(4,2);doughTexture.anisotropy=4;
 const doughMat=low?new THREE.MeshLambertMaterial({color:'#ddb479',map:doughTexture,vertexColors:true}):new THREE.MeshStandardMaterial({color:'#f0ce98',map:doughTexture,bumpMap:doughTexture,bumpScale:.014,roughness:.58,vertexColors:true});
 const glazeMat=low?new THREE.MeshLambertMaterial({color:'#e8b878',transparent:true,opacity:.88,side:THREE.DoubleSide}):new THREE.MeshPhysicalMaterial({color:'#f5d5a2',roughness:.19,metalness:0,clearcoat:1,clearcoatRoughness:.065,ior:1.46,transparent:true,opacity:.88,envMapIntensity:1.2,side:THREE.DoubleSide});
 const sugarMat=new THREE.MeshPhysicalMaterial({color:'#fff1d0',roughness:.3,clearcoat:.8});
 const ring=(u)=>.83+.018*Math.sin(u*3+.4)+.012*Math.sin(u*7);
 const tube=(u,v)=>.4+.012*Math.sin(u*5+v*2)+.006*Math.sin(u*13-v*7);
 const base=new THREE.TorusGeometry(.83,.4,low?16:48,low?56:144),pos=base.attributes.position,uv=base.attributes.uv,colors=[];
 for(let i=0;i<pos.count;i++){const u=uv.getX(i)*Math.PI*2,v=uv.getY(i)*Math.PI*2,t=tube(u,v),r=ring(u);pos.setXYZ(i,(r+t*Math.cos(v))*Math.cos(u),(r+t*Math.cos(v))*Math.sin(u),t*Math.sin(v));const pale=Math.pow(1-Math.abs(Math.sin(v)),7),c=new THREE.Color('#fff1d4').lerp(new THREE.Color('#d39351'),1-pale*.8);colors.push(c.r,c.g,c.b);}base.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));base.computeVertexNormals();
 const n=low?56:144,m=low?12:36,p=[],idx=[];
 for(let i=0;i<=n;i++){const u=i/n*Math.PI*2,edge=-.12+.19*Math.sin(u*7+.2)+.10*Math.sin(u*11);for(let j=0;j<=m;j++){const v=edge+(Math.PI-edge+.12*Math.sin(u*9))*j/m,t=tube(u,v)+.026+.005*Math.sin(u*17+v*4),r=ring(u);p.push((r+t*Math.cos(v))*Math.cos(u),(r+t*Math.cos(v))*Math.sin(u),t*Math.sin(v));}}
 for(let i=0;i<n;i++)for(let j=0;j<m;j++){const a=i*(m+1)+j,b=a+m+1;idx.push(a,b,a+1,b,b+1,a+1);}const glazeGeo=new THREE.BufferGeometry();glazeGeo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));glazeGeo.setIndex(idx);glazeGeo.computeVertexNormals();
 const beadGeo=new THREE.SphereGeometry(1,low?6:12,low?4:8);
 return function donut(){const root=new THREE.Group(),axle=new THREE.Group(),wheel=new THREE.Group();axle.rotation.y=Math.PI/2;root.add(axle);axle.add(wheel);const dough=new THREE.Mesh(base,doughMat);dough.castShadow=true;dough.receiveShadow=true;wheel.add(dough);const glaze=new THREE.Mesh(glazeGeo,glazeMat);glaze.castShadow=true;wheel.add(glaze);
 // The opposite face gets a fine translucent glaze; the heavier dripped face faces the camera.
 const back=new THREE.Mesh(glazeGeo,glazeMat);back.rotation.y=Math.PI;back.scale.setScalar(.997);wheel.add(back);
 if(!low){for(let i=0;i<18;i++){const u=i/18*Math.PI*2+.03*Math.sin(i*7),v=.04+.08*Math.sin(i*4),r=ring(u),t=tube(u,v)+.024;const bead=new THREE.Mesh(beadGeo,glazeMat);bead.position.set((r+t*Math.cos(v))*Math.cos(u),(r+t*Math.cos(v))*Math.sin(u),t*Math.sin(v));bead.scale.set(.028,.05+.022*Math.sin(i*3),.025);bead.rotation.z=u;wheel.add(bead);}const crystals=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.014,0),sugarMat,42),dummy=new THREE.Object3D();for(let i=0;i<42;i++){const u=i*2.399963,v=.3+((Math.sin(i*17)*.5+.5)*2.5),r=ring(u),t=tube(u,v)+.032;dummy.position.set((r+t*Math.cos(v))*Math.cos(u),(r+t*Math.cos(v))*Math.sin(u),t*Math.sin(v));dummy.rotation.set(i,i*2,i*.7);dummy.scale.setScalar(.6+(Math.sin(i*7)*.5+.5)*.8);dummy.updateMatrix();crystals.setMatrixAt(i,dummy.matrix);}wheel.add(crystals);}
 root.userData={axle,wheel};return root;};
}
