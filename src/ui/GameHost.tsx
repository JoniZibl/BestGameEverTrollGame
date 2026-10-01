import { useCallback, useEffect, useRef, useState } from 'react';
import type { Era, GameApi, MiniGame, PopupRequest, WinPayload } from '../core/types';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { TouchPad } from './TouchPad';
import { useGame } from '../core/state';

const FONTS: Record<string, string> = {
  display: "'Rowdies', 'Arial Black', system-ui, sans-serif",
  pixel: "'Press Start 2P', 'Courier New', monospace",
  mono: "'VT323', 'Courier New', monospace",
  ui: "'Inter', system-ui, sans-serif",
};

interface Props {
  era: Era;
  onWin: (payload?: WinPayload) => void;
  onLose: (reason?: string) => void;
  /** Counts up while the player is actually playing, for the SKILL ISSUE check. */
  onPress?: (count: number) => void;
}

export function GameHost({ era, onWin, onLose, onPress }: Props) {
  const { grant } = useGame();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<Input>(new Input());
  const [caption, setCaption] = useState('');
  const [shout, setShout] = useState('');
  const [hud, setHud] = useState('');
  const [popup, setPopup] = useState<PopupRequest | null>(null);
  const popupRef = useRef<PopupRequest | null>(null);
  popupRef.current = popup;
  const doneRef = useRef(false);

  const finishWin = useCallback(
    (p?: WinPayload) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onWin(p);
    },
    [onWin],
  );
  const finishLose = useCallback(
    (reason?: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onLose(reason);
    },
    [onLose],
  );

  useEffect(() => {
    doneRef.current = false;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || era.play.kind !== 'canvas') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const input = inputRef.current;
    input.attach(canvas);

    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(240, Math.round(rect.width));
      h = Math.max(240, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const style = getComputedStyle(wrap);
    const colors = {
      bg: style.getPropertyValue('--bg').trim() || '#f1e7d6',
      fg: style.getPropertyValue('--fg').trim() || '#412f2a',
      dim: style.getPropertyValue('--dim').trim() || '#a8968a',
      accent: style.getPropertyValue('--accent').trim() || '#c4452f',
      warn: style.getPropertyValue('--warn').trim() || '#d08c1e',
    };

    let captionTimer = 0;
    let shoutTimer = 0;

    const api: GameApi = {
      ctx,
      get w() {
        return w;
      },
      get h() {
        return h;
      },
      input,
      audio,
      colors,
      font: (px, kind = 'display') => `${px}px ${FONTS[kind]}`,
      say: (text, ms = 2600) => {
        setCaption(text);
        captionTimer = ms / 1000;
      },
      shout: (text, ms = 1600) => {
        setShout(text);
        shoutTimer = ms / 1000;
      },
      hud: (text) => setHud(text),
      popup: (req) => setPopup(req),
      win: finishWin,
      lose: finishLose,
    };

    const game: MiniGame = era.play.create(api);
    game.start?.();

    let raf = 0;
    let last = performance.now();
    let pressSeen = input.presses;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (input.presses !== pressSeen) {
        onPress?.(input.presses - pressSeen);
        pressSeen = input.presses;
      }
      if (captionTimer > 0) {
        captionTimer -= dt;
        if (captionTimer <= 0) setCaption('');
      }
      if (shoutTimer > 0) {
        shoutTimer -= dt;
        if (shoutTimer <= 0) setShout('');
      }
      if (!popupRef.current && !doneRef.current) game.update(dt);
      game.draw();
      input.endFrame();
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      input.detach();
      game.stop?.();
    };
  }, [era, finishWin, finishLose, onPress]);

  const ReactGame = era.play.kind === 'react' ? era.play.Component : null;

  return (
    <div className="host">
      <div className="hud-line">{hud}</div>
      <div className="stage" ref={wrapRef}>
        {era.play.kind === 'canvas' ? (
          <canvas ref={canvasRef} className="game-canvas" />
        ) : (
          ReactGame && (
            <ReactGame
              onWin={finishWin}
              onLose={finishLose}
              say={(t, ms = 2600) => {
                setCaption(t);
                window.setTimeout(() => setCaption((c) => (c === t ? '' : c)), ms);
              }}
              shout={(t, ms = 1600) => {
                setShout(t);
                window.setTimeout(() => setShout((c) => (c === t ? '' : c)), ms);
              }}
              audio={audio}
              grant={grant}
            />
          )
        )}
        {caption ? <div className="caption">{caption}</div> : null}
        {shout ? (
          <div className="shout" key={shout}>
            {shout}
          </div>
        ) : null}
        {popup ? (
          <div className="popup-layer">
            <div className="popup">
              <h3>{popup.title}</h3>
              {popup.price ? <div className="popup-price">{popup.price}</div> : null}
              {popup.lines?.map((l) => (
                <p key={l}>{l}</p>
              ))}
              <div className="popup-buttons">
                {popup.buttons.map((b) => (
                  <button
                    key={b.value}
                    className={b.primary ? 'btn' : 'btn ghost'}
                    onClick={() => {
                      audio.blip(660, 0.05, 'square', 0.2);
                      setPopup(null);
                      popup.onPick(b.value);
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <TouchPad controls={era.touch} input={inputRef.current} />
    </div>
  );
}
