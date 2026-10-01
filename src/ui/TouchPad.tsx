import { useEffect, useState } from 'react';
import type { TouchControlSet } from '../core/types';
import type { Input, VirtualButton } from '../core/input';

/** On-screen controls. Only shown where there is no keyboard to speak of. */
export function TouchPad({ controls, input }: { controls: TouchControlSet; input: Input }) {
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    setTouch(coarse || 'ontouchstart' in window);
  }, []);

  if (!touch) return null;
  if (!controls.dpad && !controls.horizontal && !controls.action) return null;

  const hold = (btn: VirtualButton) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      input.setVirtual(btn, true);
    },
    onPointerUp: () => input.setVirtual(btn, false),
    onPointerLeave: () => input.setVirtual(btn, false),
    onPointerCancel: () => input.setVirtual(btn, false),
  });

  return (
    <div className="touchpad">
      <div className="touch-left">
        {(controls.dpad || controls.horizontal) && (
          <>
            <button className="tbtn" {...hold('left')} aria-label="left">
              ◀
            </button>
            <button className="tbtn" {...hold('right')} aria-label="right">
              ▶
            </button>
          </>
        )}
        {controls.dpad && (
          <button className="tbtn" {...hold('down')} aria-label="down">
            ▼
          </button>
        )}
      </div>
      <div className="touch-right">
        {controls.dpad && (
          <button className="tbtn" {...hold('up')} aria-label="up">
            ▲
          </button>
        )}
        {controls.action ? (
          <button className="tbtn big" {...hold('action')} aria-label="action">
            {controls.action}
          </button>
        ) : null}
      </div>
    </div>
  );
}
