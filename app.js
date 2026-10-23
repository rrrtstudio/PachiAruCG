import * as THREE from 'three';

// PachiAruCG prototype 01. All devices, cabinet art and symbols are fictional.
const stage = document.getElementById('stage');
const loading = document.getElementById('loading');
const status = document.getElementById('status');
const speedSlider = document.getElementById('speed');
const speedValue = document.getElementById('speed-value');
const actionButtons = [...document.querySelectorAll('[data-action]')];
const demoButton = document.getElementById('demo');
const pauseButton = document.getElementById('pause');
const glassesInput = document.getElementById('glasses');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (e) {
  loading.textContent = 'このブラウザではWebGLを開始できませんでした。Chromeなどでお試しください。';
  status.textContent = 'WebGL初期化失敗';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x121a2b, 1);
stage.insertBefore(renderer.domElement, loading);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1c31);
scene.fog = new THREE.Fog(0x202336, 10, 24);
const camera = new THREE.PerspectiveCamera(35, 9 / 16, 0.1, 50);
camera.position.set(3.3, 2.85, 8.05);
camera.lookAt(0.30, 1.60, -0.18);
scene.add(new THREE.HemisphereLight(0xe5edff, 0x4b3b4e, 2.1));
const key = new THREE.DirectionalLight(0xffefd9, 2.1);
key.position.set(-3.5, 6.0, 5.0);
scene.add(key);
const fill = new THREE.DirectionalLight(0x8ca4ff, 0.8);
fill.position.set(4.5, 2, 3);
scene.add(fill);

const mat = (hex, roughness = 0.82, metalness = 0.02) => new THREE.MeshStandardMaterial({color: hex, roughness, metalness});
const metal = mat(0x242a39, .32, .55);
const trim = mat(0x34394c, .3, .55);
const floorMat = mat(0x442834, .91);
function box(group, w, h, d, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  group.add(m);
  return m;
}
function sphere(group, r, x, y, z, material, scale = [1,1,1]) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), material);
  m.position.set(x, y, z);
  m.scale.set(...scale);
  group.add(m);
  return m;
}
function cylinder(group, top, bottom, height, x, y, z, material, segments = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material);
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

// A gently lit, functional stage: not an advertisement for gambling.
box(scene, 30, .12, 25, 0, -.07, 0, floorMat);
box(scene, 30, 7, .20, 0, 3.05, -4.1, mat(0x3e3542));
box(scene, 30, .1, 8, 0, 3.56, -1.7, mat(0x6c5b64));
for (let i = 0; i < 22; i++) {
  const z = -2.8 + i*.35;
  box(scene, .025, .006, 8, -5 + i*.9, -.002, z, mat(i%2 ? 0x61313e : 0x3d2a3e));
}
for (let i = -2; i <= 2; i++) {
  box(scene, .75, .018, .23, i * 1.85, 3.48, -.9, new THREE.MeshBasicMaterial({color:0xffdec3}));
}

// Cabinet art uses abstract landscapes and silhouettes. No real machine names/logos.
function screenTexture(theme, winning = false) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 352;
  const g = c.getContext('2d');
  const themes = {
    night:['#050c29','#263d6b','#0e193c'],
    forest:['#081d27','#2a5963','#123d3d'],
    cosmos:['#1b102e','#4a2d76','#15152e'],
    sunset:['#12213b','#c16b70','#efb36d']
  };
  const p = winning ? ['#9f4004','#ffe584','#ffae30'] : themes[theme] || themes.night;
  const grad=g.createLinearGradient(0,0,0,c.height);
  grad.addColorStop(0,p[0]);grad.addColorStop(.57,p[1]);grad.addColorStop(1,p[2]);
  g.fillStyle=grad;g.fillRect(0,0,512,352);
  if (winning) {
    for(let n=0;n<28;n++){
      g.save();g.translate(256,163);g.rotate(n*Math.PI/14);
      g.fillStyle=n%2 ? '#fff2b119' : '#fffce33b';g.fillRect(-11,0,22,350);g.restore();
    }
    // Two anonymous fantasy figures drawn with elementary shapes.
    g.fillStyle='#53425b';g.beginPath();g.ellipse(198,246,66,94,0,0,7);g.fill();
    g.fillStyle='#24376b';g.beginPath();g.arc(198,137,51,0,7);g.fill();
    g.fillStyle='#eaa5c8';g.beginPath();g.ellipse(324,253,60,82,0,0,7);g.fill();
    g.fillStyle='#f4a7a7';g.beginPath();g.arc(326,149,54,0,7);g.fill();
    for (let n=0;n<28;n++){
      const x=(n*151+35)%512, y=(n*67+29)%352;
      g.fillStyle=n%2?'#ffffffcc':'#ffe67bcc';g.fillRect(x,y,3+(n%3)*2,3+(n%3)*2);
    }
  } else {
    g.fillStyle='#fff8d6aa';g.beginPath();g.arc(386,81,37,0,7);g.fill();
    for (let n=0;n<20;n++) {
      const x=(n*91+23)%512,y=(n*63+27)%194;
      g.fillStyle=n%3 ? '#eef4ff88' : '#ffffffcc';g.fillRect(x,y,2+(n%2),2+(n%2));
    }
    const horizon=245;
    g.fillStyle='#0a1631a8';g.beginPath();g.moveTo(0,270);
    for(let x=0;x<=512;x+=32)g.lineTo(x,horizon-25*Math.sin(x*.017)-11*Math.sin(x*.065));
    g.lineTo(512,352);g.lineTo(0,352);g.fill();
    g.fillStyle='#6386b055';g.fillRect(0,300,512,52);
  }
  const texture=new THREE.CanvasTexture(c);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=2;
  return texture;
}

function sevenTexture(){
  const c=document.createElement('canvas');c.width=128;c.height=128;
  const g=c.getContext('2d');
  g.textAlign='center';g.textBaseline='middle';g.font='900 116px system-ui';
  g.shadowColor='#fff5b6';g.shadowBlur=15;g.lineWidth=8;g.strokeStyle='#ffe5a3';g.strokeText('7',64,69);
  g.fillStyle='#bd2927';g.fillText('7',64,69);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
const sevenMap=sevenTexture();
const symbolColors=[0x3d98db,0xa43dbe,0xebbb44,0x2fb686,0xdd656a,0x7891cd,0xf38f47];
const slotBoxes=[];
function createSlot(x, theme, ledColor){
  const root=new THREE.Group();root.position.set(x,0,-.97);scene.add(root);
  box(root,1.35,3.13,.73,0,1.56,0,metal);
  box(root,1.40,.22,.80,0,3.03,0,trim);
  box(root,1.20,.16,.05,0,3.04,.425,mat(0x10151f));
  const baseMap=screenTexture(theme);
  const screenMaterial=new THREE.MeshBasicMaterial({map:baseMap, toneMapped:false});
  const winMap=screenTexture(theme,true);
  box(root,1.17,.88,.028,0,2.31,.414,mat(0x111620));
  const upper=new THREE.Mesh(new THREE.PlaneGeometry(1.12,.82),screenMaterial);
  upper.position.set(0,2.31,.436);root.add(upper);
  box(root,1.19,.95,.018,0,1.38,.412,mat(0xf1e7db));
  const symbolSets=[];
  for(let col=0;col<3;col++){
    const colMeshes=[];
    for(let row=0;row<3;row++){
      const color = symbolColors[(col*2+row*3+(x>1?1:0))%symbolColors.length];
      const sym=box(root,.295,.195,.023,(col-1)*.37,1.60-row*.225,.433,new THREE.MeshBasicMaterial({color}));
      const number = new THREE.Mesh(new THREE.PlaneGeometry(.25,.19),new THREE.MeshBasicMaterial({map:sevenMap,transparent:true,depthWrite:false}));
      number.position.set((col-1)*.37,1.60-row*.225,.451);
      number.visible=false;root.add(number);
      colMeshes.push({sym,number});
    }
    symbolSets.push(colMeshes);
  }
  box(root,1.15,.08,.12,0,.997,.43,mat(0x101724));
  for(let i=-1;i<=1;i++){
    const b=cylinder(root,.082,.082,.027,i*.32,.79,.446,mat(0xcc3f48,.25,.3));
    b.rotation.x=Math.PI/2;
  }
  const ledMat=new THREE.MeshBasicMaterial({color:ledColor});
  box(root,.052,2.58,.05,-.66,1.62,.43,ledMat);
  box(root,.052,2.58,.05,.66,1.62,.43,ledMat);
  box(root,1.33,.055,.04,0,2.84,.43,ledMat);
  const indicator=[];
  for(let i=0;i<3;i++)indicator.push(box(root,.10,.047,.013,-.2+i*.2,3.035,.454,new THREE.MeshBasicMaterial({color:0x3a9b75})));
  box(root,1.18,.28,.12,0,.33,.425,mat(0x101720));
  let won=false;
  return {
    setWin(value){
      if(value===won)return;
      won=value;
      screenMaterial.map=value?winMap:baseMap;
      screenMaterial.needsUpdate=true;
      for(let col=0;col<3;col++){
        symbolSets[col][1].number.visible=value;
        symbolSets[col][1].sym.material.color.setHex(value?0xffe2a5:symbolColors[(col*2+3+(x>1?1:0))%symbolColors.length]);
      }
      for(const light of indicator)light.material.color.setHex(value?0xffdc76:0x3a9b75);
    }
  };
}
slotBoxes.push(createSlot(-1.08,'forest',0x5468b7));
slotBoxes.push(createSlot(.43,'night',0x9a3b88));
slotBoxes.push(createSlot(1.94,'cosmos',0x614d9c));

function curvedMouth(group, happy, material){
  const pts=[];
  for(let i=0;i<=18;i++){
    const t=i/18,x=(t-.5)*.25;
    const y=-.17+(happy? .085 : -.065)*(4*(t-.5)*(t-.5)-1);
    pts.push(new THREE.Vector3(x,y,.572));
  }
  const geom=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),18,.014,5,false);
  const obj=new THREE.Mesh(geom,material);
  group.add(obj);return obj;
}

function createCharacter(){
  const root=new THREE.Group();root.position.set(-.73,0,1.34);root.rotation.y=.75;scene.add(root);
  const skin=mat(0xecc4a4,.92);
  const shirt=mat(0xefedf0,.95);
  const pant=mat(0x26364e,.88);
  const shoes=mat(0x161a25,.8);
  const tie=mat(0x4e6996,.85);
  const eyeMat=mat(0x21212a,.7);
  const mouthMat=new THREE.MeshBasicMaterial({color:0x74323b,transparent:true,depthWrite:false});
  const chair=new THREE.Group();root.add(chair);
  box(chair,1.03,.15,.89,0,.81,-.14,mat(0xa82c38,.6));
  box(chair,1.08,1.04,.14,0,1.39,-.56,mat(0x252c37,.86));
  box(chair,1.11,.09,.17,0,1.81,-.56,mat(0xad3847));
  cylinder(chair,.09,.09,.80,0,.44,-.15,mat(0x5c606c,.32,.6));
  cylinder(chair,.41,.41,.07,0,.07,-.15,mat(0x2c3440));
  // Pants and legs remain seated while upper-body gestures animate.
  sphere(root,.38,0,1.00,.1,pant,[1.10,.62,.88]);
  for(const side of [-1,1]){
    const x=side*.24;
    box(root,.34,.31,.66,x,.73,.36,pant);
    cylinder(root,.16,.14,.56,x,.43,.62,pant);
    sphere(root,.18,x,.12,.80,shoes,[1,.57,1.47]);
  }
  const torso=new THREE.Group();torso.position.set(0,1.02,0);root.add(torso);
  const body=sphere(torso,.52,0,.52,0,shirt,[.87,1.12,.72]);
  sphere(torso,.19,0,.95,.03,skin,[.85,.80,.85]);
  // A tie provides a recognizable everyday outfit, but no brand reference.
  const tieShape=new THREE.Shape();
  tieShape.moveTo(-.065,.78);tieShape.lineTo(.065,.78);tieShape.lineTo(.044,.54);
  tieShape.lineTo(0,.42);tieShape.lineTo(-.044,.54);tieShape.closePath();
  const tieMesh=new THREE.Mesh(new THREE.ShapeGeometry(tieShape),tie);
  tieMesh.position.z=.379;torso.add(tieMesh);
  const shoulders=[];
  for(const side of [-1,1]){
    const sh=new THREE.Group();sh.position.set(side*.44,.78,.035);torso.add(sh);
    cylinder(sh,.15,.125,.52,0,-.26,0,shirt);
    const el=new THREE.Group();el.position.y=-.51;sh.add(el);
    cylinder(el,.13,.11,.45,0,-.23,0,shirt);
    sphere(el,.12,0,-.46,0,skin,[1,1,1]);
    shoulders.push({sh,el,side});
  }
  const head=new THREE.Group();head.position.set(0,1.31,0);torso.add(head);
  sphere(head,.585,0,0,0,skin,[1,1,1]);
  // No hair, nose, eyebrows or detailed anatomy: eyes and mouth only.
  const eyes=[];
  for(const side of [-1,1]){
    const eye=sphere(head,.055,side*.223,.085,.542,eyeMat,[.85,1.21,.37]);
    eyes.push(eye);
  }
  const neutral=sphere(head,.019,0,-.17,.581,mouthMat,[4.1,.52,.5]);
  const happy=curvedMouth(head,true,new THREE.MeshBasicMaterial({color:0x74323b,transparent:true,opacity:0,depthWrite:false}));
  const frown=curvedMouth(head,false,new THREE.MeshBasicMaterial({color:0x74323b,transparent:true,opacity:0,depthWrite:false}));
  const open=sphere(head,.105,0,-.17,.58,mouthMat.clone(),[.78,.02,.1]);
  const glasses=new THREE.Group();head.add(glasses);glasses.visible=false;
  const rim=mat(0x30343c,.30,.12);
  for(const side of [-1,1]){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.18,.018,8,32),rim);
    ring.position.set(side*.218,.091,.623);ring.scale.set(1,.77,1);glasses.add(ring);
    box(glasses,.27,.022,.02,side*.42,.085,.568,rim);
  }
  box(glasses,.10,.018,.02,0,.11,.646,rim);
  return {root,torso,head,eyes,neutral,happy,frown,open,glasses,shoulders};
}
const person=createCharacter();
// Placeholder for the adjacent strangers; they never congratulate the protagonist.
function makeNeighbor(x,shirtColor){
  const group=new THREE.Group();group.position.set(x,0,1.08);group.rotation.y=.04;
  const skin=mat(0xebc1a1),clothes=mat(shirtColor);
  sphere(group,.50,0,1.5,0,clothes,[.9,1.10,.67]);
  sphere(group,.53,0,2.38,0,skin);
  for(const side of [-1,1])sphere(group,.10,side*.19,2.44,.48,mat(0x1e1f23),[.40,.65,.14]);
  box(group,.16,.025,.023,0,2.18,.52,mat(0x492a30));
  scene.add(group);
  return group;
}
const neighbor = makeNeighbor(2.37,0x465a6d);

const poses={
  idle:{head:0,chin:0,lean:0,eye:1,tilt:0,open:0,smile:0,sad:0,reach:.15,raise:0},
  play:{head:0,chin:0,lean:.08,eye:1,tilt:0,open:0,smile:0,sad:0,reach:.88,raise:0},
  look:{head:.61,chin:.04,lean:.06,eye:1.14,tilt:0,open:0,smile:0,sad:0,reach:.41,raise:0},
  shock:{head:.58,chin:.04,lean:-.03,eye:1.38,tilt:0,open:.88,smile:0,sad:0,reach:.27,raise:0},
  sad:{head:-.12,chin:-.18,lean:-.16,eye:.62,tilt:0,open:0,smile:0,sad:.93,reach:.22,raise:0},
  angry:{head:.03,chin:-.06,lean:.19,eye:.83,tilt:.24,open:.55,smile:0,sad:0,reach:.20,raise:0},
  smile:{head:.10,chin:.09,lean:.13,eye:.85,tilt:0,open:.38,smile:.80,sad:0,reach:.11,raise:1},
  pretend:{head:-.06,chin:0,lean:.05,eye:.73,tilt:0,open:0,smile:.07,sad:.10,reach:.76,raise:0}
};
const poseNow={...poses.idle};
const clock=new THREE.Clock();
let mode='demo', sceneTime=0, totalTime=0, paused=false, speed=1;
const labels={idle:'無表情',play:'通常遊技',look:'隣をちら見',shock:'驚き',sad:'落胆',angry:'怒り',smile:'喜び',pretend:'平静を装う',demo:'一連の動作テスト'};
function switchMode(next){
  mode=next;sceneTime=0;paused=false;pauseButton.textContent='一時停止';
  for(const b of actionButtons)b.setAttribute('aria-pressed',String(b.dataset.action===next));
  status.textContent='再生中：'+labels[next];
}
function smoothstep(x){x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);}
function lerpPose(a,b,f){const o={};for(const k in a)o[k]=THREE.MathUtils.lerp(a[k],b[k],f);return o;}
function scenarioPose(t){
  const frames=[
    [0,poses.play],
    [1.9,poses.play],
    [2.3,poses.shock],
    [3.15,poses.look],
    [4.2,poses.sad],
    [5.25,poses.pretend],
    [6.65,poses.play],
    [7.3,poses.play]
  ];
  for(let i=0;i<frames.length-1;i++){
    const a=frames[i],b=frames[i+1];
    if(t<=b[0])return lerpPose(a[1],b[1],smoothstep((t-a[0])/(b[0]-a[0])));
  }
  return poses.play;
}
function updateFaceAndBody(p,dt){
  const alpha=1-Math.exp(-dt*7.8);
  for(const k in poseNow)poseNow[k]=THREE.MathUtils.lerp(poseNow[k],p[k],alpha);
  const f=poseNow;
  const blinkPhase=totalTime%4.0;
  const blink=blinkPhase>3.50&&blinkPhase<3.65 ? 1-(Math.sin(Math.PI*(blinkPhase-3.50)/.15)*.93) : 1;
  person.head.rotation.y=f.head;
  person.head.rotation.x=-f.chin;
  person.torso.rotation.x=-f.lean;
  for(let i=0;i<2;i++){
    const eye=person.eyes[i],side=i===0?-1:1;
    eye.scale.y=Math.max(.07,1.21*f.eye*blink);
    eye.rotation.z=side*f.tilt;
    eye.position.x=side*.223+f.head*.016;
  }
  person.neutral.material.opacity=Math.max(0,1-f.open*1.6-f.smile-f.sad);
  person.happy.material.opacity=Math.max(0,f.smile*(1-f.open*.45));
  person.frown.material.opacity=Math.max(0,f.sad*(1-f.open*.7));
  person.open.material.opacity=Math.min(1,f.open*1.65);
  person.open.scale.y=Math.max(.001,f.open*.89);
  for(const arm of person.shoulders){
    const tapping=(mode==='play'||mode==='demo'||mode==='pretend')?Math.sin(totalTime*7)*.11:0;
    arm.sh.rotation.x=-.18-f.reach*.88-f.raise*1.15+(arm.side>0?tapping:0);
    arm.sh.rotation.z=arm.side*(.16-f.raise*.27);
    arm.el.rotation.x=-.23+f.reach*.40;
  }
  person.root.position.y=Math.sin(totalTime*1.4)*.005;
  neighbor.rotation.y=.04+Math.sin(totalTime*.4)*.008;
}
function updateMachines(){
  const active=mode==='demo' ? (sceneTime>2.05&&sceneTime<6.65) : ['look','shock','sad','angry','pretend'].includes(mode);
  const characterWin=mode==='smile';
  slotBoxes[0].setWin(false);
  slotBoxes[1].setWin(characterWin);
  slotBoxes[2].setWin(active);
}
function resize(){
  const w=stage.clientWidth, h=stage.clientHeight;
  if(!w||!h)return;
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
}
new ResizeObserver(resize).observe(stage);
window.addEventListener('orientationchange',resize);
for(const b of actionButtons)b.addEventListener('click',()=>switchMode(b.dataset.action));
demoButton.addEventListener('click',()=>switchMode('demo'));
pauseButton.addEventListener('click',()=>{
  paused=!paused;
  pauseButton.textContent=paused?'再開':'一時停止';
  status.textContent=(paused?'停止中：':'再生中：')+labels[mode];
});
glassesInput.addEventListener('change',()=>{person.glasses.visible=glassesInput.checked;});
speedSlider.addEventListener('input',()=>{speed=Number(speedSlider.value);speedValue.textContent=speed.toFixed(1)+'×';});
resize();
function animate(){
  requestAnimationFrame(animate);
  const delta=Math.min(clock.getDelta(),.060);
  if(!paused){sceneTime+=delta*speed;totalTime+=delta*speed;}
  if(mode==='demo'&&sceneTime>7.3)sceneTime=0;
  const target=mode==='demo'?scenarioPose(sceneTime):poses[mode];
  updateFaceAndBody(target,paused?0:delta);
  updateMachines();
  renderer.render(scene,camera);
  if(loading.style.display!=='none'){
    loading.style.display='none';
    status.textContent='再生中：'+labels[mode];
  }
}
for(const b of actionButtons)b.setAttribute('aria-pressed','false');
animate();
