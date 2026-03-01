export type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';
export type Axis = 'x' | 'y' | 'z';

type Vec3 = { x: number; y: number; z: number };
type Stickers = Partial<Record<Face, Face>>;

export type CubieState = {
  id: string;
  position: Vec3;
  stickers: Stickers;
};

const FACES: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];

const FACE_VECTORS: Record<Face, Vec3> = {
  U: { x: 0, y: 1, z: 0 },
  D: { x: 0, y: -1, z: 0 },
  L: { x: -1, y: 0, z: 0 },
  R: { x: 1, y: 0, z: 0 },
  F: { x: 0, y: 0, z: 1 },
  B: { x: 0, y: 0, z: -1 },
};

const vectorToFace = (v: Vec3): Face => {
  for (const face of FACES) {
    const fv = FACE_VECTORS[face];
    if (fv.x === v.x && fv.y === v.y && fv.z === v.z) {
      return face;
    }
  }
  throw new Error(`Invalid direction vector: ${JSON.stringify(v)}`);
};

export const parseMove = (move: string): { face: Face; turns: number } => {
  const face = move[0] as Face;
  if (!FACES.includes(face)) {
    throw new Error(`Invalid move: ${move}`);
  }
  if (move.endsWith('2')) {
    return { face, turns: 2 };
  }
  if (move.endsWith("'")) {
    return { face, turns: 3 };
  }
  return { face, turns: 1 };
};

export const moveSpec = (face: Face): { axis: Axis; layer: number; quarterTurns: number } => {
  switch (face) {
    case 'U':
      return { axis: 'y', layer: 1, quarterTurns: 1 };
    case 'D':
      return { axis: 'y', layer: -1, quarterTurns: 3 };
    case 'R':
      return { axis: 'x', layer: 1, quarterTurns: 1 };
    case 'L':
      return { axis: 'x', layer: -1, quarterTurns: 3 };
    case 'F':
      return { axis: 'z', layer: 1, quarterTurns: 1 };
    case 'B':
      return { axis: 'z', layer: -1, quarterTurns: 3 };
  }
};

const rotateVec90 = (v: Vec3, axis: Axis): Vec3 => {
  switch (axis) {
    case 'x':
      return { x: v.x, y: -v.z, z: v.y };
    case 'y':
      return { x: v.z, y: v.y, z: -v.x };
    case 'z':
      return { x: -v.y, y: v.x, z: v.z };
  }
};

const rotateVecQuarterTurns = (v: Vec3, axis: Axis, turns: number): Vec3 => {
  let out = { ...v };
  for (let i = 0; i < turns; i += 1) {
    out = rotateVec90(out, axis);
  }
  return out;
};

const createSolvedCubies = (): CubieState[] => {
  const cubies: CubieState[] = [];
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        const stickers: Stickers = {};
        if (x === -1) stickers.L = 'L';
        if (x === 1) stickers.R = 'R';
        if (y === -1) stickers.D = 'D';
        if (y === 1) stickers.U = 'U';
        if (z === -1) stickers.B = 'B';
        if (z === 1) stickers.F = 'F';
        cubies.push({ id: `${x},${y},${z}`, position: { x, y, z }, stickers });
      }
    }
  }
  return cubies;
};

export class CubeState {
  cubies: CubieState[] = createSolvedCubies();

  reset() {
    this.cubies = createSolvedCubies();
  }

  applyMove(move: string) {
    const { face, turns } = parseMove(move);
    const { axis, layer, quarterTurns } = moveSpec(face);
    const totalTurns = (quarterTurns * turns) % 4;
    if (totalTurns === 0) return;

    this.cubies = this.cubies.map((cubie) => {
      if (cubie.position[axis] !== layer) return cubie;

      const newPosition = rotateVecQuarterTurns(cubie.position, axis, totalTurns);
      const newStickers: Stickers = {};
      for (const [faceKey, color] of Object.entries(cubie.stickers) as [Face, Face][]) {
        const dir = FACE_VECTORS[faceKey];
        const rotatedDir = rotateVecQuarterTurns(dir, axis, totalTurns);
        const newFace = vectorToFace(rotatedDir);
        newStickers[newFace] = color;
      }

      return { ...cubie, position: newPosition, stickers: newStickers };
    });
  }

  applyAlgorithm(moves: string[]) {
    for (const move of moves) this.applyMove(move);
  }

  toFaceletString(): string {
    const findColor = (x: number, y: number, z: number, face: Face): Face => {
      const cubie = this.cubies.find((c) => c.position.x === x && c.position.y === y && c.position.z === z);
      if (!cubie) throw new Error(`Missing cubie at ${x},${y},${z}`);
      const color = cubie.stickers[face];
      if (!color) throw new Error(`Missing sticker for ${face} at ${x},${y},${z}`);
      return color;
    };

    const out: Face[] = [];

    for (const z of [-1, 0, 1]) for (const x of [-1, 0, 1]) out.push(findColor(x, 1, z, 'U'));
    for (const y of [1, 0, -1]) for (const z of [-1, 0, 1]) out.push(findColor(1, y, z, 'R'));
    for (const y of [1, 0, -1]) for (const x of [-1, 0, 1]) out.push(findColor(x, y, 1, 'F'));
    for (const z of [1, 0, -1]) for (const x of [-1, 0, 1]) out.push(findColor(x, -1, z, 'D'));
    for (const y of [1, 0, -1]) for (const z of [1, 0, -1]) out.push(findColor(-1, y, z, 'L'));
    for (const y of [1, 0, -1]) for (const x of [1, 0, -1]) out.push(findColor(x, y, -1, 'B'));

    return out.join('');
  }
}

export const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

export const generateScramble = (length = 25): string[] => {
  const faces: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];
  const suffixes = ['', "'", '2'];
  const scramble: string[] = [];

  while (scramble.length < length) {
    const face = faces[Math.floor(Math.random() * faces.length)];
    const prevFace = scramble.length > 0 ? scramble[scramble.length - 1][0] : null;
    if (face === prevFace) continue;
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    scramble.push(`${face}${suffix}`);
  }

  return scramble;
};
