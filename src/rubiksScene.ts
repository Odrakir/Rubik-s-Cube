import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Axis, moveSpec, parseMove } from './cube';

export type RenderCubie = {
  mesh: THREE.Mesh;
  position: { x: number; y: number; z: number };
};

const CUBIE_SIZE = 0.96;
const GAP = 0.04;
const SPACING = CUBIE_SIZE + GAP;
const TURN_DURATION_MS = 220;

const COLORS = {
  U: 0xffffff,
  D: 0xf1c40f,
  L: 0xe67e22,
  R: 0xc0392b,
  F: 0x27ae60,
  B: 0x2980b9,
  I: 0x181818,
};

const faceMaterialsForPosition = (x: number, y: number, z: number): THREE.MeshStandardMaterial[] => {
  const mk = (key: keyof typeof COLORS) =>
    new THREE.MeshStandardMaterial({ color: COLORS[key], roughness: 0.55, metalness: 0.05 });

  return [
    mk(x === 1 ? 'R' : 'I'),
    mk(x === -1 ? 'L' : 'I'),
    mk(y === 1 ? 'U' : 'I'),
    mk(y === -1 ? 'D' : 'I'),
    mk(z === 1 ? 'F' : 'I'),
    mk(z === -1 ? 'B' : 'I'),
  ];
};

const snap = (n: number) => Math.round(n);

const snapQuaternionToRightAngles = (q: THREE.Quaternion): THREE.Quaternion => {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
  const e = m.elements;
  const r = [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]].map((v) =>
    Math.abs(v) < 0.5 ? 0 : Math.sign(v),
  );
  const snapped = new THREE.Matrix4().set(
    r[0],
    r[3],
    r[6],
    0,
    r[1],
    r[4],
    r[7],
    0,
    r[2],
    r[5],
    r[8],
    0,
    0,
    0,
    0,
    1,
  );
  return new THREE.Quaternion().setFromRotationMatrix(snapped);
};

export class RubiksScene {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private cubies: RenderCubie[] = [];
  private pendingMove: Promise<void> = Promise.resolve();

  constructor(private mount: HTMLDivElement) {
    const { clientWidth, clientHeight } = mount;

    this.scene.background = new THREE.Color(0x121212);
    this.camera = new THREE.PerspectiveCamera(45, clientWidth / clientHeight, 0.1, 100);
    this.camera.position.set(6.5, 6.5, 7.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(clientWidth, clientHeight);
    mount.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 0.95);
    dir.position.set(6, 9, 8);
    this.scene.add(ambient, dir);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 18;

    this.controls.addEventListener('start', () => {
      document.body.style.userSelect = 'none';
    });
    this.controls.addEventListener('end', () => {
      document.body.style.userSelect = '';
    });

    this.createCubies();
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    this.animate();
  }

  private createCubies() {
    const geometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          const mesh = new THREE.Mesh(geometry, faceMaterialsForPosition(x, y, z));
          mesh.position.set(x * SPACING, y * SPACING, z * SPACING);
          this.scene.add(mesh);
          this.cubies.push({ mesh, position: { x, y, z } });
        }
      }
    }
  }

  private onResize() {
    const { clientWidth, clientHeight } = this.mount;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  private animate = () => {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.animate);
  };

  private layerCubies(axis: Axis, layer: number): RenderCubie[] {
    return this.cubies.filter((c) => c.position[axis] === layer);
  }

  queueMove(move: string, animated = true): Promise<void> {
    this.pendingMove = this.pendingMove.then(() => this.applyMove(move, animated));
    return this.pendingMove;
  }

  queueAlgorithm(moves: string[], animated = true): Promise<void> {
    return moves.reduce((p, move) => p.then(() => this.queueMove(move, animated)), Promise.resolve());
  }

  private async applyMove(move: string, animated: boolean): Promise<void> {
    const { face, turns } = parseMove(move);
    const { axis, layer, quarterTurns } = moveSpec(face);
    const totalTurns = (quarterTurns * turns) % 4;
    if (totalTurns === 0) return;

    for (let i = 0; i < totalTurns; i += 1) {
      await this.applyQuarterTurn(axis, layer, animated);
    }
  }

  private applyQuarterTurn(axis: Axis, layer: number, animated: boolean): Promise<void> {
    const cubies = this.layerCubies(axis, layer);
    const pivot = new THREE.Object3D();
    this.scene.add(pivot);
    cubies.forEach(({ mesh }) => pivot.attach(mesh));

    const target = Math.PI / 2;

    return new Promise((resolve) => {
      if (!animated) {
        pivot.rotation[axis] = target;
        this.finishPivotTurn(pivot, cubies, axis);
        resolve();
        return;
      }

      const start = performance.now();
      const tick = () => {
        const elapsed = performance.now() - start;
        const t = Math.min(elapsed / TURN_DURATION_MS, 1);
        const eased = 1 - (1 - t) * (1 - t);
        pivot.rotation[axis] = target * eased;

        if (t < 1) {
          requestAnimationFrame(tick);
          return;
        }

        this.finishPivotTurn(pivot, cubies, axis);
        resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  private finishPivotTurn(pivot: THREE.Object3D, cubies: RenderCubie[], axis: Axis) {
    cubies.forEach((c) => {
      this.scene.attach(c.mesh);
      c.mesh.position.set(snap(c.mesh.position.x / SPACING) * SPACING, snap(c.mesh.position.y / SPACING) * SPACING, snap(c.mesh.position.z / SPACING) * SPACING);
      c.position = {
        x: snap(c.mesh.position.x / SPACING),
        y: snap(c.mesh.position.y / SPACING),
        z: snap(c.mesh.position.z / SPACING),
      };
      c.mesh.quaternion.copy(snapQuaternionToRightAngles(c.mesh.quaternion));
    });
    this.scene.remove(pivot);
    pivot.clear();
  }

  async reset() {
    await this.pendingMove;
    this.cubies.forEach((c) => {
      this.scene.remove(c.mesh);
      c.mesh.geometry.dispose();
      const mats = c.mesh.material as THREE.Material[];
      mats.forEach((m) => m.dispose());
    });
    this.cubies = [];
    this.createCubies();
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.mount) {
      this.mount.removeChild(this.renderer.domElement);
    }
  }
}
