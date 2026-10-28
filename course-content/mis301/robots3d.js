import { Scene, Group, Object3D, OrthographicCamera, WebGLRenderer, HemisphereLight, DirectionalLight,
  SphereGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, InstancedMesh,
  MeshStandardMaterial, MeshBasicMaterial, Plane, Vector3, Color, SRGBColorSpace, MathUtils } from 'three';

// Guardian-inspired: ivory armour, navy visor, cyan LEDs and gold accents.
// Ten robot variants, built from shared low-poly geometry; no textures/models/CDN.
const styles = [
  ['#e7edf2','#b39159',0], ['#7fb8da','#f4dfb0',1], ['#415569','#e9b854',2],
  ['#eef2ed','#d77e79',3], ['#123f68','#e9ca8b',4], ['#68a89d','#e7c76f',5],
  ['#b4a4d3','#8fddcf',6], ['#d8bd87','#df8e58',7], ['#d6eff1','#53c7d2',8], ['#293e56','#b39159',9],
];
const clamp = MathUtils.clamp, lerp = MathUtils.lerp;
const smooth = (a,b,x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };

export function create(stage) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new Scene(), actors = [], batches = new Map(), colors = new Map();
  const geometries = {
    sphere: new SphereGeometry(1,12,8), box: new BoxGeometry(1,1,1),
    cylinder: new CylinderGeometry(1,1,1,8), cone: new ConeGeometry(1,1,8),
    ring: new TorusGeometry(1,.10,5,20),
  };
  const camera = new OrthographicCamera(-1,1,1,-1,.1,100);
  camera.position.set(0,6,22); camera.lookAt(0,0,0); camera.updateMatrixWorld();
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  const probe = new Vector3();
  scene.add(new HemisphereLight('#f4f8ff','#b2a087',2));
  const key = new DirectionalLight('#fff4de',2.4); key.position.set(-4,8,9); scene.add(key);
  const fill = new DirectionalLight('#b9e2ff',.8); fill.position.set(5,3,-2); scene.add(fill);
  let renderer = null, unavailable = false, raf = 0, dirty = true, disposed = false;
  let width = 1, height = 1, ppu = 40, stageRect = null;
  function init() {
    if (renderer || unavailable) return Boolean(renderer);
    try {
      renderer = new WebGLRenderer({ alpha:true, antialias:true, stencil:false, powerPreference:'low-power' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1,1.25));
      renderer.outputColorSpace = SRGBColorSpace; renderer.localClippingEnabled = true;
      renderer.setClearColor('#ffffff',0); renderer.domElement.className = 'ground-webgl';
      renderer.domElement.setAttribute('aria-hidden','true');
      renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(raf); raf=0; });
      renderer.domElement.addEventListener('webglcontextrestored', () => { dirty=true; wake(); });
      stage.appendChild(renderer.domElement);
      return true;
    } catch { unavailable = true; return false; }
  }
  function batch(kind,row,floor,led=false,ground=false) {
    const id = `${kind}:${ground?'ground':row}:${led?'led':'shell'}`;
    if (batches.has(id)) return batches.get(id);
    const material = led ? new MeshBasicMaterial({ color:'#a1eaff' }) : new MeshStandardMaterial({ color:'#ffffff',roughness:ground ? .95 : .5,metalness:ground ? 0 : .35 });
    if (!ground) material.clippingPlanes = [new Plane(new Vector3(0,1,0),-floor+.005)];
    const mesh = new InstancedMesh(geometries[kind],material,512);
    mesh.count = 0; mesh.frustumCulled = false; scene.add(mesh);
    const result = { mesh,material,floor }; batches.set(id,result); return result;
  }
  function part(actor,parent,kind,color,position,scale,row,led=false,ground=false,rx=0) {
    const node = new Object3D(); node.position.set(...position); node.scale.set(...scale); node.rotation.x=rx; parent.add(node);
    const group = batch(kind,row,actor.base.y,led,ground), index=group.mesh.count++;
    if (!colors.has(color)) colors.set(color,new Color(color));
    group.mesh.setColorAt(index,colors.get(color)); group.mesh.instanceColor.needsUpdate=true;
    actor.parts.push({ node,group,index,ground }); return node;
  }
  function joint(parent,x,y,z=0) { const node = new Group(); node.position.set(x,y,z); parent.add(node); return node; }
  function make(actor,index) {
    const [shell,accent,variant] = styles[index%10], dark='#082945', metal='#778b9c';
    const root=actor.root, row=actor.row;
    const p=(parent,kind,color,pos,size,led=false,ground=false,rx=0)=>part(actor,parent,kind,color,pos,size,row,led,ground,rx);
    const torso=joint(root,0,1.25); actor.torso=torso;
    p(torso,'sphere',shell,[0,0,0],[.48,.55,.32]);
    p(torso,'box',accent,[0,-.12,.3],[.49,.13,.07]);
    p(torso,'ring',accent,[0,.17,.31],[.16,.16,.07]);
    p(torso,'sphere','#a1eaff',[0,.17,.34],[.095,.095,.035],true);
    p(root,'sphere',dark,[0,.79,0],[.34,.19,.25]);
    const head=joint(root,0,2.35); actor.head=head;
    p(head,'sphere',shell,[0,0,0],[.74,.65,.54]);
    p(head,'sphere',dark,[0,.01,.37],[.62,.37,.2]);
    p(head,'box','#a1eaff',[-.25,.07,.56],[.18,.10,.045],true);
    p(head,'box','#a1eaff',[.25,.07,.56],[.18,.10,.045],true);
    p(head,'box',accent,[0,-.14,.56],[.18,.035,.03]);
    for (const side of [-1,1]) {
      p(head,'cylinder',accent,[side*.72,0,0],[.14,.17,.14],false,false,Math.PI/2);
      const shoulder=joint(root,side*.55,1.6,.1), elbow=joint(shoulder,0,-.46), hand=joint(elbow,0,-.44);
      p(shoulder,'sphere',dark,[0,0,0],[.15,.15,.15]);
      p(shoulder,'cylinder',shell,[0,-.23,0],[.12,.38,.12]);
      p(elbow,'sphere',accent,[0,0,0],[.13,.13,.13]);
      p(elbow,'cylinder',shell,[0,-.22,0],[.10,.35,.10]);
      p(hand,'box',dark,[0,0,.02],[.24,.17,.2]);
      const finger=joint(hand,side*.09,-.06,.09);
      p(finger,'box',shell,[0,-.07,0],[.065,.18,.065]);
      p(hand,'box',shell,[-side*.09,-.10,.08],[.065,.18,.065]);
      const hip=joint(root,side*.25,.72), knee=joint(hip,0,-.32);
      p(hip,'sphere',dark,[0,0,0],[.12,.12,.12]);
      p(hip,'cylinder',shell,[0,-.16,0],[.13,.27,.13]);
      p(knee,'sphere',accent,[0,0,0],[.13,.13,.13]);
      p(knee,'cylinder',shell,[0,-.16,0],[.11,.26,.11]);
      p(knee,'box',dark,[0,-.31,.1],[.32,.17,.44]);
      actor.limbs.push({side,shoulder,elbow,finger,hip,knee});
    }
    if ([0,1,6,8].includes(variant)) for(const side of variant===1?[-1,1]:[0]) {
      p(head,'cylinder',metal,[side*.35,.73,0],[.035,.28,.035]);
      p(head,'sphere','#a1eaff',[side*.35,.9,0],[.085,.085,.085],true);
    }
    if ([2,5].includes(variant)) {
      p(root,'box',accent,[0,1.4,-.37],[.7,.65,.24]);
      p(head,'box',accent,[0,.57,.1],[.56,.16,.3]);
    }
    if (variant===3) { p(torso,'box','#d77e79',[0,.02,.34],[.12,.36,.045]); p(torso,'box','#d77e79',[0,.02,.36],[.36,.12,.045]); }
    if (variant===4) for(const side of [-1,1]) p(head,'cone',accent,[side*.79,.17,-.05],[.13,.42,.16],false,false,.4);
    if (variant===6) for(const side of [-1,1]) p(head,'box',accent,[side*.73,0,0],[.15,.38,.32]);
    if (variant===7) for(const x of [-.3,0,.3]) p(head,'box',accent,[x,.61,0],[.14,.25,.27]);
    if (variant===8) for(const x of [-.3,0,.3]) p(head,'sphere','#a1eaff',[x,.6,.25],[.065,.065,.065],true);
    if (variant===9) { p(torso,'box',accent,[0,.08,.31],[.62,.32,.09]); for(const side of [-1,1]) p(root,'box',accent,[side*.57,1.62,0],[.25,.27,.36]); }
    actor.anchor=joint(head,0,.78,.05);
    const soil=joint(scene,actor.base.x,actor.base.y,actor.base.z);
    actor.soil=soil;
    p(soil,'ring','#b39159',[0,.008,0],[.86,.86,.45],false,true,-Math.PI/2);
    actor.hole=p(soil,'cylinder','#243b46',[0,.001,0],[.75,.012,.75],false,true);
  }
  function pose(actor,t) {
    const root=actor.root;
    const pull=smooth(.2,.74,t), stand=smooth(.72,1,t);
    const rise=t<.2?lerp(-3.45,-2.22,smooth(0,.2,t)):t<.74?lerp(-2.22,-.38,pull):lerp(-.38,0,stand);
    root.position.copy(actor.base); root.position.y+=rise+(t<1?Math.sin(pull*Math.PI*4)*.035*(1-stand):0);
    actor.torso.rotation.x=-.17*Math.sin(pull*Math.PI)*(1-stand);
    actor.head.rotation.x=.08*Math.sin(pull*Math.PI*2)*(1-stand);
    actor.head.rotation.y=.05*Math.sin(pull*Math.PI*2)*(1-stand);
    for(const limb of actor.limbs) {
      const release=smooth(.58,.84,t);
      const x=lerp(limb.side*.28,limb.side*.18,release);
      const y=lerp(.09-rise-1.6,-.74,release);
      const d=clamp(Math.hypot(x,y),.05,.895), a=.46,b=.44;
      const bend=-limb.side;
      const phi=Math.atan2(y,x)+bend*Math.acos(clamp((d*d+a*a-b*b)/(2*d*a),-1,1));
      const lower=Math.atan2(y,x)-bend*Math.acos(clamp((d*d+b*b-a*a)/(2*d*b),-1,1));
      limb.shoulder.rotation.z=phi+Math.PI/2; limb.elbow.rotation.z=lower-phi;
      limb.finger.rotation.x=-.45*Math.sin(pull*Math.PI)*(1-release);
      limb.hip.rotation.x=(-.85+.14*Math.sin(pull*Math.PI*3+limb.side))*(1-stand);
      limb.knee.rotation.x=1.35*(1-stand);
    }
    const close=smooth(.84,1,t); actor.hole.scale.x=.75*Math.max(.001,1-close); actor.hole.scale.z=.75*Math.max(.001,1-close);
    root.updateMatrixWorld(true); actor.soil.updateMatrixWorld(true);
    for(const part of actor.parts) { part.group.mesh.setMatrixAt(part.index,part.node.matrixWorld); part.group.mesh.instanceMatrix.needsUpdate=true; }
  }
  function layout() {
    stageRect=stage.getBoundingClientRect(); width=Math.max(1,stageRect.width);height=Math.max(1,stageRect.height);
    const avatar=parseFloat(getComputedStyle(stage).getPropertyValue('--avatar'))||12;
    ppu=Math.max(.5,avatar*innerWidth/100/2.9);
    camera.left=-width/ppu/2;camera.right=width/ppu/2;camera.top=height/ppu/2;camera.bottom=-height/ppu/2;camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    for(const actor of actors) {
      const rect=actor.slot.getBoundingClientRect();
      actor.slotRect=rect;actor.nameHeight=actor.name.offsetHeight;actor.relayout=true;
      const y=(height-(rect.bottom-stageRect.top)+3)/ppu-height/ppu/2;
      actor.base.copy(up).multiplyScalar(y); actor.base.x=(rect.left+rect.width/2-stageRect.left-width/2)/ppu;
      actor.row=actor.slot.dataset.row;
      actor.soil.position.copy(actor.base);
      for(const part of actor.parts) if(!part.ground) part.group.material.clippingPlanes[0].constant=-actor.base.y+.005;
    }
    dirty=false;
  }
  function label(actor,t) {
    actor.anchor.getWorldPosition(probe); const visible=probe.y>actor.base.y+.15;
    actor.name.style.visibility=visible?'visible':'hidden';
    probe.project(camera);
    const slot=actor.slotRect;
    const x=(probe.x*.5+.5)*width-(slot.left-stageRect.left)-slot.width/2;
    const y=(-probe.y*.5+.5)*height-(slot.top-stageRect.top)-actor.nameHeight-3;
    actor.name.style.transform=`translate(${x.toFixed(2)}px,${Math.max(0,y).toFixed(2)}px)`;
  }
  function frame(now) {
    raf=0;if(disposed||!renderer||document.hidden)return;
    if(dirty)layout();
    let active=false;
    for(const actor of actors) {
      const t=actor.saved||reduced?1:clamp((now-actor.start)/2450,0,1);
      if(actor.last!==t||actor.relayout) {pose(actor,t);label(actor,t);actor.last=t;actor.relayout=false;}
      if(t<1)active=true;
    }
    renderer.render(scene,camera);
    if(active)raf=requestAnimationFrame(frame);
  }
  function wake() {if(!raf&&!disposed)raf=requestAnimationFrame(frame);}
  const resize=new ResizeObserver(()=>{dirty=true;for(const a of actors)a.relayout=true;wake();});resize.observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{dirty=true;for(const a of actors)a.relayout=true;wake();}});
  function reset() {
    cancelAnimationFrame(raf);raf=0;
    for(const actor of actors){scene.remove(actor.root);scene.remove(actor.soil);}
    actors.length=0;
    for(const batch of batches.values()){scene.remove(batch.mesh);batch.mesh.dispose();batch.material.dispose();}batches.clear();
    if(renderer){renderer.clear();renderer.domElement.remove();}dirty=true;
  }
  return {
    add(slot,name,index,saved=false) {
      if(!init()){name.style.visibility='visible';slot.dataset.renderError='true';stage.dispatchEvent(new CustomEvent('eiu-3d-unavailable'));return;}
      if(!renderer.domElement.isConnected)stage.appendChild(renderer.domElement);
      if(dirty)layout();
      const rect=slot.getBoundingClientRect(), y=(height-(rect.bottom-stageRect.top)+3)/ppu-height/ppu/2;
      const base=up.clone().multiplyScalar(y);base.x=(rect.left+rect.width/2-stageRect.left-width/2)/ppu;
      const actor={slot,name,slotRect:rect,nameHeight:name.offsetHeight,root:new Group(),base,row:slot.dataset.row,parts:[],limbs:[],start:performance.now(),saved,last:-1,relayout:true};
      scene.add(actor.root);make(actor,index);actors.push(actor);wake();
    },
    reset,
    dispose(){reset();disposed=true;resize.disconnect();for(const g of Object.values(geometries))g.dispose();renderer?.dispose();},
  };
}
