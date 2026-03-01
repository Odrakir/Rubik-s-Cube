import { useEffect, useMemo, useRef, useState } from 'react';
import Cube from 'cubejs';
import { CubeState, generateScramble, SOLVED_FACELETS } from './cube';
import { RubiksScene } from './rubiksScene';
import './styles.css';

Cube.initSolver();

const splitMoves = (alg: string): string[] =>
  alg
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RubiksScene | null>(null);
  const cubeStateRef = useRef(new CubeState());
  const [scrambleText, setScrambleText] = useState('');
  const [busy, setBusy] = useState(false);

  const faceletString = useMemo(() => cubeStateRef.current.toFaceletString(), [scrambleText]);

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new RubiksScene(mountRef.current);
    sceneRef.current = scene;
    return () => scene.dispose();
  }, []);

  const runMoves = async (moves: string[], animated = true) => {
    if (!sceneRef.current || moves.length === 0) return;
    for (const move of moves) {
      await sceneRef.current.queueMove(move, animated);
      cubeStateRef.current.applyMove(move);
    }
  };

  const onScramble = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const moves = generateScramble(25);
      setScrambleText(moves.join(' '));
      await runMoves(moves, true);
    } finally {
      setBusy(false);
    }
  };

  const onSolve = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const state = cubeStateRef.current.toFaceletString();
      if (state === SOLVED_FACELETS) {
        setScrambleText('Already solved.');
        return;
      }
      const solverCube = Cube.fromString(state);
      const solution = solverCube.solve();
      const moves = splitMoves(solution);
      setScrambleText(`Solve: ${solution}`);
      await runMoves(moves, true);
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    if (busy) return;
    setBusy(true);
    try {
      cubeStateRef.current.reset();
      setScrambleText('');
      await sceneRef.current?.reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="panel">
        <h1>Rubik&apos;s Cube (Three.js + cubejs)</h1>
        <p className="status">Facelets: {faceletString}</p>
        <div className="buttons">
          <button disabled={busy} onClick={onScramble}>
            Scramble
          </button>
          <button disabled={busy} onClick={onSolve}>
            Solve
          </button>
          <button disabled={busy} onClick={onReset}>
            Reset
          </button>
        </div>
        <p className="scramble">{scrambleText || 'No scramble yet.'}</p>
      </div>
      <div className="viewport" ref={mountRef} />
    </div>
  );
}
