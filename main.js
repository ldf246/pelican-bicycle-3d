import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe8f7, 60, 220);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);
camera.position.set(6, 3.5, 8);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 2.5; controls.maxDistance = 80;

const rand = (a, b) => a + Math.random() * (b - a);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
function shadowAll(obj) { obj.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return obj; }

// ---------- Sky dome (gradient shader) ----------
const skyUniforms = {
  top: { value: new THREE.Color(0x4a9be0) }, bottom: { value: new THREE.Color(0xdff1fb) },
  sunDir: { value: new THREE.Vector3(0.5, 0.6, 0.3).normalize() }, night: { value: 0 }
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform float night; varying vec3 vP;
    void main(){ float h = max(vP.y,0.); vec3 c = mix(bottom, top, pow(h,0.6));
      float s = max(dot(vP, sunDir),0.); c += vec3(1.,.8,.5)*pow(s,24.)*0.6*(1.-night) + vec3(1.,.95,.85)*pow(s,600.)*(1.-night);
      gl_FragColor = vec4(c,1.); }`
}));
scene.add(sky);

// Stars
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 1500; i++) {
  const v = new THREE.Vector3(rand(-1, 1), rand(0.05, 1), rand(-1, 1)).normalize().multiplyScalar(380);
  starPos.push(v.x, v.y, v.z);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, transparent: true, opacity: 0, fog: false, sizeAttenuation: false }));
scene.add(stars);

// Sun / moon disc
const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 12), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }));
scene.add(sunMesh);

// ---------- Lights ----------
const hemi = new THREE.HemisphereLight(0xcfe9ff, 0x6b8f4e, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dd, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 120 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// ---------- World ----------
const TRACK_R = 26;
const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 64), mat(0x86c06c, { roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// gentle vertex-colored meadow patches
const patchGeo = new THREE.CircleGeometry(1, 10);
for (let i = 0; i < 70; i++) {
  const p = new THREE.Mesh(patchGeo, mat(new THREE.Color().setHSL(rand(0.22, 0.3), 0.45, rand(0.38, 0.5)), { roughness: 1 }));
  const r = rand(5, 120), a = rand(0, Math.PI * 2);
  if (Math.abs(r - TRACK_R) < 3.5) continue;
  p.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r); p.rotation.x = -Math.PI / 2;
  p.scale.setScalar(rand(1.5, 6)); p.receiveShadow = true; scene.add(p);
}

// Road
const road = new THREE.Mesh(new THREE.RingGeometry(TRACK_R - 2, TRACK_R + 2, 160, 1), mat(0x5d6168, { roughness: 0.9 }));
road.rotation.x = -Math.PI / 2; road.position.y = 0.02; road.receiveShadow = true; scene.add(road);
for (const edge of [TRACK_R - 1.9, TRACK_R + 1.9]) {
  const e = new THREE.Mesh(new THREE.RingGeometry(edge - 0.06, edge + 0.06, 160, 1), mat(0xf4f4f0));
  e.rotation.x = -Math.PI / 2; e.position.y = 0.03; scene.add(e);
}
const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.02, 0.12), mat(0xf6d24a), 60);
const dm = new THREE.Object3D();
for (let i = 0; i < 60; i++) {
  const a = i / 60 * Math.PI * 2;
  dm.position.set(Math.cos(a) * TRACK_R, 0.035, Math.sin(a) * TRACK_R);
  dm.rotation.y = -a; dm.updateMatrix(); dash.setMatrixAt(i, dm.matrix);
}
scene.add(dash);

// Lake in the middle
const lakeMat = new THREE.MeshStandardMaterial({ color: 0x3f8fd0, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.9 });
const lake = new THREE.Mesh(new THREE.CircleGeometry(14, 64), lakeMat);
lake.rotation.x = -Math.PI / 2; lake.position.y = 0.04; scene.add(lake);
const shore = new THREE.Mesh(new THREE.RingGeometry(14, 15.2, 64), mat(0xe8d9a8, { roughness: 1 }));
shore.rotation.x = -Math.PI / 2; shore.position.y = 0.03; scene.add(shore);
// lily pads
for (let i = 0; i < 14; i++) {
  const pad = new THREE.Mesh(new THREE.CircleGeometry(rand(0.4, 0.8), 12, 0.3, Math.PI * 1.85), mat(0x3e8e3e));
  const r = rand(4, 12.5), a = rand(0, Math.PI * 2);
  pad.position.set(Math.cos(a) * r, 0.06, Math.sin(a) * r); pad.rotation.set(-Math.PI / 2, 0, rand(0, 6)); scene.add(pad);
}
// ripples
const ripples = [];
for (let i = 0; i < 6; i++) {
  const rp = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
  rp.rotation.x = -Math.PI / 2; rp.position.set(rand(-9, 9), 0.07, rand(-9, 9)); rp.userData.t = rand(0, 3);
  scene.add(rp); ripples.push(rp);
}

// Trees (instanced low-poly)
const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.4, 6);
const crownGeo = new THREE.ConeGeometry(1.1, 2.6, 7);
const roundGeo = new THREE.IcosahedronGeometry(1.2, 0);
const N_TREES = 170;
const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x7a5232), N_TREES);
const crowns = new THREE.InstancedMesh(crownGeo, mat(0xffffff, { flatShading: true }), N_TREES);
const rounds = new THREE.InstancedMesh(roundGeo, mat(0xffffff, { flatShading: true }), N_TREES);
let ci = 0, ri = 0;
const treeData = [];
for (let i = 0; i < N_TREES; i++) {
  let r, a;
  do { r = rand(16.5, 110); a = rand(0, Math.PI * 2); } while (Math.abs(r - TRACK_R) < 7);
  const s = rand(0.7, 1.6), x = Math.cos(a) * r, z = Math.sin(a) * r;
  dm.position.set(x, 0.7 * s, z); dm.rotation.set(0, rand(0, 6), 0); dm.scale.setScalar(s); dm.updateMatrix(); trunks.setMatrixAt(i, dm.matrix);
  const col = new THREE.Color().setHSL(rand(0.24, 0.36), rand(0.4, 0.6), rand(0.25, 0.4));
  if (Math.random() < 0.6) { dm.position.y = (1.4 + 1.2) * s; dm.updateMatrix(); crowns.setMatrixAt(ci, dm.matrix); crowns.setColorAt(ci++, col); }
  else { dm.position.y = (1.4 + 0.8) * s; dm.updateMatrix(); rounds.setMatrixAt(ri, dm.matrix); rounds.setColorAt(ri++, col.offsetHSL(0.03, 0, 0.05)); }
  treeData.push({ x, z, s });
}
crowns.count = ci; rounds.count = ri;
[trunks, crowns, rounds].forEach(m => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });

// Flowers
const flowerColors = [0xff6b8a, 0xffd34e, 0xffffff, 0xb784f5, 0xff9447];
const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0xffffff), 600);
for (let i = 0; i < 600; i++) {
  let r, a; do { r = rand(15.5, 60); a = rand(0, Math.PI * 2); } while (Math.abs(r - TRACK_R) < 2.6);
  dm.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r); dm.scale.setScalar(rand(0.6, 1.4)); dm.rotation.set(0, 0, 0); dm.updateMatrix();
  flowers.setMatrixAt(i, dm.matrix); flowers.setColorAt(i, new THREE.Color(flowerColors[i % flowerColors.length]));
}
scene.add(flowers);

// Distant mountains
for (let i = 0; i < 28; i++) {
  const a = i / 28 * Math.PI * 2 + rand(-0.05, 0.05), r = rand(150, 190), h = rand(25, 60);
  const m = new THREE.Mesh(new THREE.ConeGeometry(rand(25, 40), h, 6), mat(new THREE.Color().setHSL(0.58, 0.18, rand(0.45, 0.6)), { flatShading: true }));
  m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r); m.rotation.y = rand(0, 6); scene.add(m);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(m.geometry.parameters.radius * 0.28, h * 0.28, 6), mat(0xffffff, { flatShading: true }));
  cap.position.set(m.position.x, h - 2 - h * 0.14, m.position.z); cap.rotation.y = m.rotation.y; scene.add(cap);
}

// Lamp posts (light up at night)
const lamps = [];
for (let i = 0; i < 12; i++) {
  const a = i / 12 * Math.PI * 2 + 0.13, r = TRACK_R + 5.2;
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), mat(0x333840, { metalness: 0.6, roughness: 0.4 }));
  pole.position.y = 1.6; g.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd88a, emissiveIntensity: 0 }));
  bulb.position.y = 3.3; g.add(bulb);
  const pl = new THREE.PointLight(0xffc870, 0, 12, 1.6); pl.position.y = 3.2; g.add(pl);
  g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); shadowAll(pole); scene.add(g);
  lamps.push({ bulb, pl });
}

// Clouds
const clouds = [];
const cloudMat = mat(0xffffff, { roughness: 1, flatShading: true, transparent: true, opacity: 0.95 });
for (let i = 0; i < 14; i++) {
  const c = new THREE.Group();
  const n = 4 + Math.floor(Math.random() * 4);
  for (let j = 0; j < n; j++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(2, 4), 1), cloudMat);
    puff.position.set(j * 2.6 - n * 1.3, rand(-0.6, 0.8), rand(-1.4, 1.4)); c.add(puff);
  }
  c.position.set(rand(-140, 140), rand(32, 55), rand(-140, 140));
  c.userData.v = rand(1, 3); scene.add(c); clouds.push(c);
}

// Seagull-ish birds
const birds = [];
const wingGeo = new THREE.BufferGeometry();
wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.3, 0, 1.2, 0.4, 0, 0.2], 3));
wingGeo.computeVertexNormals();
for (let i = 0; i < 9; i++) {
  const b = new THREE.Group();
  const bm = new THREE.MeshStandardMaterial({ color: 0x2f3338, side: THREE.DoubleSide });
  const l = new THREE.Mesh(wingGeo, bm), r = new THREE.Mesh(wingGeo, bm); r.scale.z = -1;
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 6), bm); body.rotation.z = -Math.PI / 2;
  b.add(l, r, body);
  b.userData = { l, r, rad: rand(20, 45), h: rand(14, 22), sp: rand(0.15, 0.3) * (Math.random() < 0.5 ? 1 : -1), ph: rand(0, 6), fl: rand(6, 9) };
  scene.add(b); birds.push(b);
}

// ---------- Bicycle ----------
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
function rod(a, b, r, material, seg = 8) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, seg), material);
  setRod(m, a, b); return m;
}
function setRod(m, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(1, d.length(), 1);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
}
const frameMat = mat(0xe2463a, { metalness: 0.35, roughness: 0.35 });
const chromeMat = mat(0xd9dde2, { metalness: 0.95, roughness: 0.18 });
const blackMat = mat(0x1d1f22, { roughness: 0.75 });

const WR = 0.36;
const P = { rear: V(-0.52, WR), front: V(0.56, WR), bb: V(0, 0.3), seatC: V(-0.14, 0.86), headT: V(0.42, 0.92), headB: V(0.47, 0.72), seatTop: V(-0.18, 1.0) };

const bikeRoot = new THREE.Group();      // follows the track
const lean = new THREE.Group(); bikeRoot.add(lean);   // leans into the corner
const bob = new THREE.Group(); lean.add(bob);
scene.add(bikeRoot);

function makeWheel() {
  const w = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(WR - 0.025, 0.03, 10, 40), blackMat); w.add(tire);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WR - 0.06, 0.012, 6, 40), chromeMat); w.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12), chromeMat); hub.rotation.x = Math.PI / 2; w.add(hub);
  const spokeMat = mat(0xcfd3d8, { metalness: 0.8, roughness: 0.3 });
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, side = i % 2 ? 0.04 : -0.04;
    w.add(rod(V(0, 0, side), V(Math.cos(a) * (WR - 0.065), Math.sin(a) * (WR - 0.065), 0), 0.004, spokeMat, 4));
  }
  // colored reflector on spokes
  const refl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.01), mat(0xffa21a, { emissive: 0xff7a00, emissiveIntensity: 0.4 }));
  refl.position.set(0.18, 0, 0.02); w.add(refl);
  return w;
}
const rearWheel = makeWheel(); rearWheel.position.copy(P.rear); bob.add(rearWheel);

// frame
const frame = new THREE.Group(); bob.add(frame);
frame.add(rod(P.bb, P.seatC, 0.024, frameMat));
frame.add(rod(P.seatC, P.headT, 0.022, frameMat));
frame.add(rod(P.bb, P.headB, 0.028, frameMat));
frame.add(rod(P.headB, P.headT, 0.032, frameMat));
for (const s of [-1, 1]) {
  frame.add(rod(P.bb, V(P.rear.x, P.rear.y, 0.055 * s), 0.014, frameMat));
  frame.add(rod(P.seatC, V(P.rear.x, P.rear.y, 0.055 * s), 0.012, frameMat));
}
frame.add(rod(P.seatC, P.seatTop, 0.015, chromeMat));
const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8), mat(0x3a2a20, { roughness: 0.5 }));
saddle.scale.set(1.5, 0.35, 0.7); saddle.position.copy(P.seatTop).add(V(0.01, 0.02)); frame.add(saddle);
// rear fender + rack + little basket
const fender = new THREE.Mesh(new THREE.TorusGeometry(WR + 0.04, 0.035, 6, 30, Math.PI * 0.75), chromeMat);
fender.scale.z = 0.9; fender.position.copy(P.rear); fender.rotation.z = Math.PI * 0.2; frame.add(fender);
// rear light
const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 0.3 }));
tail.position.set(-0.86, 0.66, 0); frame.add(tail);

// steering assembly (rotates about head-tube axis)
const headAxis = new THREE.Vector3().subVectors(P.headT, P.headB).normalize();
const headMid = P.headB.clone().lerp(P.headT, 0.5);
const steer = new THREE.Group(); steer.position.copy(headMid); bob.add(steer);
const st = new THREE.Group(); st.position.copy(headMid).negate(); steer.add(st);
const frontWheel = makeWheel(); frontWheel.position.copy(P.front); st.add(frontWheel);
for (const s of [-1, 1]) st.add(rod(V(P.headB.x, P.headB.y, 0.04 * s), V(P.front.x, P.front.y, 0.055 * s), 0.014, chromeMat));
const stemTop = V(0.40, 1.05);
st.add(rod(P.headT, stemTop, 0.016, chromeMat));
const barL = V(0.36, 1.07, 0.27), barR = V(0.36, 1.07, -0.27);
st.add(rod(V(0.42, 1.05, 0.12), barL, 0.013, chromeMat), rod(V(0.42, 1.05, -0.12), barR, 0.013, chromeMat), rod(V(0.42, 1.05, 0.12), V(0.42, 1.05, -0.12), 0.015, chromeMat));
for (const b of [barL, barR]) { const g = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), blackMat); g.position.copy(b).add(V(0, 0, Math.sign(b.z) * -0.03)); g.rotation.x = Math.PI / 2; st.add(g); }
// bell
const bell = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffd34e, { metalness: 0.9, roughness: 0.2 }));
bell.position.set(0.41, 1.08, 0.18); st.add(bell);
// front basket with fish
const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.16, 12, 1, true), mat(0xb98a4e, { side: THREE.DoubleSide, roughness: 0.9, wireframe: false }));
basket.position.set(0.66, 0.98, 0); st.add(basket);
const basketBottom = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), mat(0x9c7340)); basketBottom.rotation.x = -Math.PI / 2; basketBottom.position.set(0.66, 0.91, 0); st.add(basketBottom);
const fishMat = mat(0x8fb3c9, { metalness: 0.6, roughness: 0.3 });
for (let i = 0; i < 3; i++) {
  const f = new THREE.Group();
  const fb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6), fishMat); fb.scale.set(2.2, 0.8, 0.5); f.add(fb);
  const ft = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.07, 4), fishMat); ft.rotation.z = Math.PI / 2; ft.position.x = -0.13; f.add(ft);
  f.position.set(0.66 + (i - 1) * 0.04, 1.05 + i * 0.01, (i - 1) * 0.06); f.rotation.set(rand(-0.3, 0.3), rand(0, 3), 0.8 + i * 0.3); st.add(f);
}
st.add(rod(V(0.47, 0.86), V(0.6, 0.92), 0.01, chromeMat));
// headlight
const lampHead = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c0, emissiveIntensity: 0.2 }));
lampHead.rotation.z = Math.PI / 2; lampHead.position.set(0.5, 0.82, 0); st.add(lampHead);
const headLight = new THREE.SpotLight(0xfff1c8, 0, 22, 0.45, 0.5, 1.2);
headLight.position.copy(lampHead.position); st.add(headLight);
const hlTarget = new THREE.Object3D(); hlTarget.position.set(5, 0, 0); st.add(hlTarget); headLight.target = hlTarget;
steer.quaternion.setFromAxisAngle(headAxis, 0);

// drivetrain
const crank = new THREE.Group(); crank.position.copy(P.bb); bob.add(crank);
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 32), chromeMat); ring.position.z = -0.05; crank.add(ring);
for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; crank.add(rod(V(0, 0, -0.05), V(Math.cos(a) * 0.1, Math.sin(a) * 0.1, -0.05), 0.008, chromeMat, 4)); }
const CR = 0.17;
const armR = rod(V(0, 0, -0.07), V(CR, 0, -0.07), 0.014, chromeMat); crank.add(armR);
const armL = rod(V(0, 0, 0.07), V(-CR, 0, 0.07), 0.014, chromeMat); crank.add(armL);
const pedalR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.08), blackMat); bob.add(pedalR);
const pedalL = pedalR.clone(); bob.add(pedalL);
// chain (two straight runs)
const chainMat = mat(0x55595e, { metalness: 0.8, roughness: 0.4 });
bob.add(rod(V(0, 0.4, -0.05), V(P.rear.x, P.rear.y + 0.05, -0.05), 0.006, chainMat, 4));
bob.add(rod(V(0, 0.2, -0.05), V(P.rear.x, P.rear.y - 0.05, -0.05), 0.006, chainMat, 4));
const cog = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 20), chromeMat); cog.position.set(P.rear.x, P.rear.y, -0.05); bob.add(cog);

// ---------- Pelican ----------
const pel = new THREE.Group(); bob.add(pel);
const white = mat(0xf7f5ef, { roughness: 0.85 });
const cream = mat(0xf1e6c8, { roughness: 0.85 });
const greyFeather = mat(0x2d2f33, { roughness: 0.8 });
const beakMat = mat(0xf2a33a, { roughness: 0.45 });
const pouchMat = new THREE.MeshPhysicalMaterial({ color: 0xf28a5b, roughness: 0.35, clearcoat: 0.6, sheen: 0.5, transparent: true, opacity: 0.96 });
const legMat = mat(0xf08a36, { roughness: 0.55 });

const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 28, 18), white);
body.scale.set(1.55, 1.05, 1.0); body.position.set(-0.08, 1.24, 0); body.rotation.z = 0.35; pel.add(body);
const belly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), cream); belly.scale.set(1.2, 0.9, 0.95); belly.position.set(0.02, 1.16, 0); pel.add(belly);
// tail feathers
for (let i = -2; i <= 2; i++) {
  const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), white);
  t.position.set(-0.52, 1.1, i * 0.05); t.rotation.set(i * 0.12, 0, Math.PI / 2 + 0.5); pel.add(t);
}
// neck (S-curve tube)
const neckCurve = new THREE.CatmullRomCurve3([V(0.12, 1.4), V(0.2, 1.58), V(0.1, 1.76), V(0.14, 1.92), V(0.22, 2.0)]);
const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 24, 0.075, 12), white); pel.add(neck);
const head = new THREE.Group(); head.position.set(0.24, 2.02, 0); pel.add(head);
const skull = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), white); skull.scale.set(1.25, 1, 0.95); head.add(skull);
// crest
for (let i = 0; i < 4; i++) {
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 5), mat(0xfff6dd)); c.position.set(-0.1 - i * 0.02, 0.07 + i * 0.01, 0); c.rotation.z = 1.1 + i * 0.12; head.add(c);
}
// eyes
for (const s of [-1, 1]) {
  const ring = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), mat(0xf4c7a1)); ring.position.set(0.05, 0.03, 0.095 * s); head.add(ring);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 8), mat(0x101010, { roughness: 0.1 })); eye.position.set(0.058, 0.032, 0.112 * s); head.add(eye);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); glint.position.set(0.066, 0.04, 0.127 * s); head.add(glint);
}
// beak: long flattened upper mandible + hook + pouch
const beak = new THREE.Group(); beak.position.set(0.1, -0.02, 0); beak.rotation.z = -0.28; head.add(beak);
const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.05, 0.78, 12), beakMat);
upper.rotation.z = -Math.PI / 2; upper.scale.z = 0.8; upper.position.set(0.39, 0.0, 0); beak.add(upper);
const hook = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(0xe2602c)); hook.position.set(0.78, -0.015, 0); beak.add(hook);
const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.008, 0.012), mat(0xd9842a)); ridge.position.set(0.39, 0.03, 0); beak.add(ridge);
const pouchGroup = new THREE.Group(); pouchGroup.position.set(0.36, -0.03, 0); beak.add(pouchGroup);
const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), pouchMat);
pouch.scale.set(1.9, 0.75, 0.42); pouchGroup.add(pouch);
const lower = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.012, 6, 30, Math.PI), beakMat); lower.scale.set(1, 0.05, 0.12); lower.rotation.x = Math.PI / 2; pouchGroup.add(lower);

// wings reaching to handlebars (segments updated each frame)
const wings = [];
for (const s of [-1, 1]) {
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), white); pel.add(shoulder);
  const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1, 12), white); pel.add(upperArm);
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1, 12), white); pel.add(fore);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), white); pel.add(elbow);
  const tipFeathers = new THREE.Group(); pel.add(tipFeathers);
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.3 - i * 0.03, 0.012, 0.06), greyFeather);
    f.position.set(-0.12 - i * 0.04, -0.03 - i * 0.025, 0); f.rotation.z = 0.5 + i * 0.12; tipFeathers.add(f);
  }
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), greyFeather); pel.add(hand);
  wings.push({ s, shoulder, upperArm, fore, elbow, hand, tipFeathers });
}
// legs (two-bone IK to pedals)
const legs = [];
const L1 = 0.42, L2 = 0.44;
for (const s of [-1, 1]) {
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 1, 10), white); pel.add(thigh);
  const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1, 8), legMat); pel.add(shin);
  const knee = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), legMat); pel.add(knee);
  const foot = new THREE.Group(); pel.add(foot);
  const web = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.17, 3), legMat); web.scale.set(1, 1, 0.18); web.rotation.set(Math.PI / 2, 0, -Math.PI / 2); web.position.x = 0.05;
  web.rotation.order = 'ZXY'; foot.add(web);
  legs.push({ s, thigh, shin, knee, foot });
}
shadowAll(bikeRoot);

// ---------- Particles: dust & feathers ----------
const dustTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
const dust = [];
for (let i = 0; i < 40; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, color: 0xd8cdb5, transparent: true, opacity: 0, depthWrite: false }));
  sp.userData.life = 0; scene.add(sp); dust.push(sp);
}
let dustIdx = 0;
function spawnDust(pos) {
  const d = dust[dustIdx++ % dust.length];
  d.position.copy(pos).add(V(rand(-0.1, 0.1), 0.05, rand(-0.1, 0.1)));
  d.userData = { life: 1, v: V(rand(-0.3, 0.3), rand(0.3, 0.7), rand(-0.3, 0.3)) };
  d.scale.setScalar(0.15);
}
const featherGeo = new THREE.PlaneGeometry(0.05, 0.16);
const feathers = [];
function spawnFeathers(n = 12) {
  const origin = new THREE.Vector3(); body.getWorldPosition(origin);
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(featherGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true }));
    f.position.copy(origin); f.userData = { v: V(rand(-1.2, 1.2), rand(0.8, 2.2), rand(-1.2, 1.2)), spin: V(rand(-4, 4), rand(-4, 4), rand(-4, 4)), life: rand(2, 3.5) };
    f.castShadow = true; scene.add(f); feathers.push(f);
  }
}
// speed lines during boost
const speedLines = new THREE.Group(); scene.add(speedLines);

// ---------- Audio ----------
let actx;
function audio() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
function ringBell() {
  const a = audio(), t = a.currentTime;
  for (const [hit, dt] of [[0, 0], [1, 0.16]]) {
    for (const [f, g] of [[2093, 0.22], [2793, 0.12], [4186, 0.06], [5588, 0.03]]) {
      const o = a.createOscillator(), gn = a.createGain(); o.type = 'sine'; o.frequency.value = f * (1 + hit * 0.003);
      gn.gain.setValueAtTime(0, t + dt); gn.gain.linearRampToValueAtTime(g, t + dt + 0.005); gn.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.2);
      o.connect(gn).connect(a.destination); o.start(t + dt); o.stop(t + dt + 1.3);
    }
  }
  bellShake = 1;
}
function honk() { // pelicans grunt: low filtered sawtooth
  const a = audio(), t = a.currentTime, o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.35);
  f.type = 'lowpass'; f.frequency.value = 700; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(f).connect(g).connect(a.destination); o.start(t); o.stop(t + 0.45);
}
function whoosh() {
  const a = audio(), t = a.currentTime, len = a.sampleRate * 0.8, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); src.buffer = buf;
  f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2500, t + 0.7); g.gain.value = 0.35;
  src.connect(f).connect(g).connect(a.destination); src.start(t);
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
const toastEl = $('toast'); let toastTimer;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1400); }
let targetSpeed = +$('speed').value / 3.6, speed = 0, paused = false, boost = 0, nightTarget = 0, night = 0, bellShake = 0, pouchPuff = 0;
const camModes = [['chase', '追随'], ['orbit', '自由'], ['side', '侧拍'], ['cine', '电影'], ['pov', '鹈鹕视角']];
let camIdx = 0;
$('speed').oninput = e => { targetSpeed = +e.target.value / 3.6; };
$('btnBell').onclick = () => { ringBell(); toast('叮铃铃～ 🔔'); };
$('btnBoost').onclick = doBoost;
function doBoost() { boost = 3; whoosh(); spawnFeathers(14); toast('⚡ 鹈鹕全力冲刺！'); }
$('btnCam').onclick = nextCam;
function nextCam() {
  camIdx = (camIdx + 1) % camModes.length; $('btnCam').textContent = '🎥 视角：' + camModes[camIdx][1];
  controls.enabled = camModes[camIdx][0] === 'orbit';
  if (controls.enabled) { controls.target.copy(bikeRoot.position).add(V(0, 1, 0)); }
}
$('btnNight').onclick = toggleNight;
function toggleNight() { nightTarget = nightTarget ? 0 : 1; $('btnNight').textContent = nightTarget ? '☀️ 白天' : '🌙 夜晚'; document.body.classList.toggle('night', !!nightTarget); toast(nightTarget ? '夜骑模式 · 车灯已打开' : '早上好 ☀️'); }
$('btnPause').onclick = togglePause;
function togglePause() { paused = !paused; $('btnPause').textContent = paused ? '▶️ 继续' : '⏸ 暂停'; $('btnPause').classList.toggle('on', paused); }
$('btnShot').onclick = () => { renderer.render(scene, camera); const a = document.createElement('a'); a.download = 'pelican-bicycle.png'; a.href = renderer.domElement.toDataURL('image/png'); a.click(); toast('📸 截图已保存'); };
addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); ringBell(); }
  else if (e.key === 'b' || e.key === 'B') doBoost();
  else if (e.key === 'c' || e.key === 'C') nextCam();
  else if (e.key === 'n' || e.key === 'N') toggleNight();
  else if (e.key === 'p' || e.key === 'P') togglePause();
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const s = $('speed'); s.value = +s.value + (e.key === 'ArrowUp' ? 3 : -3); s.oninput({ target: s }); }
});
// click the pelican
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
renderer.domElement.addEventListener('click', e => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mouse, camera);
  if (ray.intersectObject(pel, true).length) { pouchPuff = 1; honk(); toast('咕～ 喉囊鼓起来了！'); }
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- Animation ----------
const clock = new THREE.Clock();
let phi = 0, crankA = 0, dist = 0, lastLap = 0, wheelA = 0, elapsed = 0;
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), camGoal = new THREE.Vector3(), lookGoal = new THREE.Vector3();
const dayTop = new THREE.Color(0x4a9be0), dayBot = new THREE.Color(0xdff1fb), nightTop = new THREE.Color(0x050b1f), nightBot = new THREE.Color(0x1b2a4a);
const dayFog = new THREE.Color(0xcfe8f7), nightFog = new THREE.Color(0x101a30);

function updateRider(t, effort) {
  // pedals in bike-local coords
  const pr = V(P.bb.x + Math.cos(crankA) * CR, P.bb.y + Math.sin(crankA) * CR, -0.12);
  const pl = V(P.bb.x - Math.cos(crankA) * CR, P.bb.y - Math.sin(crankA) * CR, 0.12);
  pedalR.position.copy(pr); pedalL.position.copy(pl);
  crank.rotation.z = crankA;
  const bounce = Math.sin(crankA * 2) * 0.012 * (0.5 + effort);
  pel.position.y = bounce; pel.rotation.x = Math.sin(crankA) * 0.03 * (0.5 + effort);
  pel.rotation.z = -0.05 * effort; // tuck forward when sprinting
  for (const L of legs) {
    const hip = V(-0.12, 1.06 - bounce, 0.11 * L.s);
    const target = (L.s < 0 ? pr : pl).clone().add(V(0, 0.03, 0)); target.y -= pel.position.y;
    const d = Math.min(hip.distanceTo(target), L1 + L2 - 0.001);
    const dir = new THREE.Vector3().subVectors(target, hip);
    const base = Math.atan2(dir.y, dir.x);
    const a = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const kneeAng = base + a; // knee forward/up
    const knee = V(hip.x + Math.cos(kneeAng) * L1, hip.y + Math.sin(kneeAng) * L1, hip.z * 0.5 + target.z * 0.5 + 0.03 * L.s);
    setRod(L.thigh, hip, knee); setRod(L.shin, knee, target); L.knee.position.copy(knee);
    L.foot.position.copy(target); L.foot.rotation.z = -0.1 + Math.sin(crankA + (L.s < 0 ? 0 : Math.PI)) * 0.25;
  }
  // wings to handlebar grips (in pel-local space)
  steer.updateMatrixWorld(true);
  for (const W of wings) {
    const grip = (W.s > 0 ? barL : barR).clone(); st.localToWorld(grip); pel.worldToLocal(grip);
    const sh = V(0.06, 1.42, 0.27 * W.s);
    const mid = sh.clone().lerp(grip, 0.5).add(V(-0.06, 0.12 + Math.sin(t * 3) * 0.01, 0.1 * W.s));
    W.shoulder.position.copy(sh); W.elbow.position.copy(mid); W.hand.position.copy(grip);
    setRod(W.upperArm, sh, mid); setRod(W.fore, mid, grip);
    W.tipFeathers.position.copy(mid); W.tipFeathers.lookAt(pel.localToWorld(grip.clone()));
    W.tipFeathers.rotateY(-Math.PI / 2);
  }
  // head: looks around, bobs; pouch jiggles
  head.rotation.z = Math.sin(t * 0.7) * 0.06 - effort * 0.08;
  head.rotation.y = Math.sin(t * 0.43) * 0.25;
  head.position.y = 2.02 + Math.sin(crankA * 2 + 0.6) * 0.012;
  const jig = Math.sin(t * 14) * 0.04 * (0.3 + speed / 10);
  pouchPuff = Math.max(0, pouchPuff - 0.012);
  const puff = 1 + Math.sin(Math.min(pouchPuff, 1) * Math.PI) * 0.9;
  pouch.scale.set(1.9, 0.75 * puff * (1 + jig), 0.42 * (1 + (puff - 1) * 1.6));
  beak.rotation.z = -0.28 + (puff - 1) * 0.06;
}

function frame_() {
  requestAnimationFrame(frame_);
  const dt = Math.min(clock.getDelta(), 0.05); elapsed += dt; const t = elapsed;
  // speed
  const goal = paused ? 0 : targetSpeed * (boost > 0 ? 1.8 : 1);
  speed += (goal - speed) * Math.min(1, dt * (boost > 0 ? 3 : 1.2));
  boost = Math.max(0, boost - dt);
  const effort = THREE.MathUtils.clamp((speed - 3) / 9, 0, 1) + (boost > 0 ? 0.4 : 0);
  // motion along track
  const ds = speed * dt;
  phi += ds / TRACK_R; dist += ds;
  const pos = V(Math.cos(phi) * TRACK_R, 0, Math.sin(phi) * TRACK_R);
  bikeRoot.position.copy(pos); bikeRoot.rotation.y = -phi - Math.PI / 2;
  const leanAng = Math.atan(speed * speed / (9.81 * TRACK_R));
  lean.rotation.x = leanAng + Math.sin(crankA) * 0.02 * effort;
  const steerAng = -Math.atan(1.08 / TRACK_R) * 1.4 + Math.sin(t * 1.3) * 0.03;
  steer.quaternion.setFromAxisAngle(headAxis, steerAng + Math.sin(bellShake * 20) * bellShake * 0.05);
  bellShake = Math.max(0, bellShake - dt * 2);
  wheelA -= ds / WR; rearWheel.rotation.z = wheelA; frontWheel.rotation.z = wheelA;
  crankA -= ds / WR / 2.2; // gear ratio
  updateRider(t, effort);
  // dust
  if (speed > 4 && Math.random() < speed / 25) { rearWheel.getWorldPosition(tmp); tmp.y = 0.05; spawnDust(tmp); }
  for (const d of dust) {
    if (d.userData.life > 0) {
      d.userData.life -= dt * 1.2; d.position.addScaledVector(d.userData.v, dt);
      d.scale.setScalar(0.15 + (1 - d.userData.life) * 0.6); d.material.opacity = Math.max(0, d.userData.life) * 0.45 * (1 - night * 0.7);
    }
  }
  for (let i = feathers.length - 1; i >= 0; i--) {
    const f = feathers[i], u = f.userData; u.life -= dt;
    u.v.y = Math.max(u.v.y - 2.5 * dt, -0.4); u.v.x *= 0.98; u.v.z *= 0.98;
    f.position.addScaledVector(u.v, dt); f.rotation.x += u.spin.x * dt; f.rotation.y += u.spin.y * dt; f.position.x += Math.sin(t * 3 + i) * dt * 0.3;
    if (f.position.y < 0.05) { f.position.y = 0.05; u.v.set(0, 0, 0); u.spin.set(0, 0, 0); }
    f.material.opacity = Math.min(1, u.life);
    if (u.life <= 0) { scene.remove(f); f.material.dispose(); feathers.splice(i, 1); }
  }
  // day / night
  night += (nightTarget - night) * Math.min(1, dt * 1.5);
  skyUniforms.top.value.copy(dayTop).lerp(nightTop, night); skyUniforms.bottom.value.copy(dayBot).lerp(nightBot, night); skyUniforms.night.value = night;
  scene.fog.color.copy(dayFog).lerp(nightFog, night);
  stars.material.opacity = night;
  hemi.intensity = THREE.MathUtils.lerp(0.9, 0.18, night);
  sun.intensity = THREE.MathUtils.lerp(2.4, 0.35, night);
  sun.color.setHSL(THREE.MathUtils.lerp(0.1, 0.62, night), THREE.MathUtils.lerp(0.4, 0.5, night), THREE.MathUtils.lerp(0.93, 0.8, night));
  const sunDir = V(0.5, THREE.MathUtils.lerp(0.6, 0.45, night), 0.3).normalize();
  if (night > 0.5) sunDir.set(-0.4, 0.5, -0.5).normalize();
  skyUniforms.sunDir.value.copy(sunDir);
  sunMesh.position.copy(sunDir).multiplyScalar(300); sunMesh.material.color.set(night > 0.5 ? 0xe8eefc : 0xfff3c4);
  sun.position.copy(pos).addScaledVector(sunDir, 50); sun.target.position.copy(pos);
  headLight.intensity = night * 30; lampHead.material.emissiveIntensity = 0.2 + night * 3; tail.material.emissiveIntensity = 0.3 + night * 3;
  for (const l of lamps) { l.pl.intensity = night * 6; l.bulb.material.emissiveIntensity = night * 2.5; }
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 1.25, night);
  lakeMat.color.setHSL(0.57, 0.55, THREE.MathUtils.lerp(0.53, 0.18, night));
  // environment animation
  for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 160) c.position.x = -160; }
  for (const b of birds) {
    const u = b.userData, a = t * u.sp + u.ph;
    b.position.set(Math.cos(a) * u.rad, u.h + Math.sin(t + u.ph) * 1.5, Math.sin(a) * u.rad);
    b.rotation.y = -a + (u.sp > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI / 2;
    const flap = Math.sin(t * u.fl + u.ph) * 0.6; u.l.rotation.x = flap; u.r.rotation.x = -flap;
  }
  for (const r of ripples) {
    r.userData.t += dt; const k = (r.userData.t % 3) / 3; r.scale.setScalar(0.3 + k * 2.5); r.material.opacity = (1 - k) * 0.5;
    if (r.userData.t % 3 < dt) r.position.set(rand(-9, 9), 0.07, rand(-9, 9));
  }
  // camera
  const mode = camModes[camIdx][0];
  const fwd = V(-Math.sin(phi), 0, Math.cos(phi)), inward = V(-Math.cos(phi), 0, -Math.sin(phi));
  if (mode === 'orbit') {
    controls.target.lerp(tmp.copy(pos).add(V(0, 1, 0)), 0.1);
    // keep camera offset relative while bike moves
    controls.update();
  } else {
    if (mode === 'chase') { camGoal.copy(pos).addScaledVector(fwd, -4.2).addScaledVector(inward, -1.6).add(V(0, 2.1, 0)); lookGoal.copy(pos).addScaledVector(fwd, 1.5).add(V(0, 1.1, 0)); }
    else if (mode === 'side') { camGoal.copy(pos).addScaledVector(inward, -4.6).addScaledVector(fwd, 0.4).add(V(0, 1.3, 0)); lookGoal.copy(pos).add(V(0.0, 1.1, 0)); }
    else if (mode === 'pov') { pel.getWorldPosition(tmp); camGoal.copy(pos).addScaledVector(fwd, -0.15).add(V(0, 2.45, 0)); lookGoal.copy(pos).addScaledVector(fwd, 6).add(V(0, 0.9, 0)); }
    else { // cinematic: slow sweep around the rider
      const a = t * 0.25, r = 4.2 + Math.sin(t * 0.3) * 0.6;
      camGoal.copy(pos).add(V(Math.cos(a) * r, 1.4 + Math.sin(t * 0.4) * 0.9, Math.sin(a) * r)); lookGoal.copy(pos).add(V(0, 1.1, 0));
    }
    camera.position.lerp(camGoal, mode === 'pov' ? 0.5 : Math.min(1, dt * 3));
    tmp2.copy(lookGoal); camera.lookAt(tmp2);
  }
  camera.fov += ((boost > 0 ? 62 : 50) - camera.fov) * dt * 3; camera.updateProjectionMatrix();
  // HUD
  const kmh = speed * 3.6; $('spd').textContent = kmh.toFixed(0); $('odo').textContent = (dist / 1000).toFixed(2);
  const laps = Math.floor(phi / (Math.PI * 2)); $('laps').textContent = laps;
  if (laps > lastLap) { lastLap = laps; toast(`🏁 第 ${laps} 圈完成！`); }
  $('cad').textContent = Math.round(speed / WR / 2.2 / (Math.PI * 2) * 60);
  renderer.render(scene, camera);
}
frame_();
// expose for debugging / tests
window.__pelican = { scene, camera, setCam: i => { camIdx = (i - 1 + camModes.length) % camModes.length; nextCam(); }, toggleNight, doBoost };
requestAnimationFrame(() => { const l = $('loader'); l.style.opacity = 0; setTimeout(() => l.remove(), 900); });
