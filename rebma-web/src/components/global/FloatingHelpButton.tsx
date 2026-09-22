// src/components/global/FloatingHelpButton.tsx
//
// Direct instruction: the Help Assistant needed to be more visible than
// one item buried at the end of a ~15-item sidebar tab list. Confirmed
// directly: a fixed, animated chat icon on the screen edge (right by
// default), draggable, always snapping back to an edge, remembered
// across sessions, and visible EVERYWHERE the CEO/admin is logged in —
// not just while viewing the CEO department's own screens, since a CEO
// switches departments constantly and should still be able to reach it.
// Same design as the mobile version
// (rebma-mobile/components/chrome/FloatingHelpButton.tsx).
//
// Built on framer-motion's own `drag` support (already a real
// dependency this whole app uses, see App.tsx's <MotionConfig>) rather
// than hand-rolling pointer-event tracking — its own tap-vs-drag
// disambiguation is what `onClick` vs `onDragEnd` below relies on.
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { Bot } from 'lucide-react';

interface Props {
  isAdmin: boolean;
  onOpen: () => void;
}

const SIZE = 52;
const EDGE_MARGIN = 12;
const STORAGE_KEY = 'floating-help-button-position-v1';

function defaultPosition() {
  return { x: window.innerWidth - SIZE - EDGE_MARGIN, y: window.innerHeight - 140 };
}

export default function FloatingHelpButton({ isAdmin, onOpen }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [loaded, setLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragMoved = useRef(0);

  useEffect(() => {
    if (!isAdmin) return;
    let pos = defaultPosition();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { side: 'left' | 'right'; y: number };
        pos = { x: saved.side === 'left' ? EDGE_MARGIN : window.innerWidth - SIZE - EDGE_MARGIN, y: saved.y };
      }
    } catch {
      // ignore a corrupt/blocked localStorage read, use the default spot
    }
    x.set(pos.x);
    y.set(pos.y);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin || !loaded) return null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      style={{ position: 'fixed', top: 0, left: 0, x, y, width: SIZE, height: SIZE, zIndex: 60 }}
      onDragStart={() => { dragMoved.current = 0; setDragging(true); }}
      onDrag={(_e, info) => { dragMoved.current += Math.abs(info.delta.x) + Math.abs(info.delta.y); }}
      onDragEnd={() => {
        setDragging(false);
        // A near-zero-movement "drag" is really a click framer-motion
        // routed through the drag handlers — onClick below still fires
        // for a genuine tap, so nothing extra is needed here beyond not
        // treating a tiny wiggle as a real edge-snap-worthy drag.
        if (dragMoved.current < 8) return;
        const currentX = x.get();
        const currentY = y.get();
        const goLeft = currentX < window.innerWidth / 2;
        const snappedX = goLeft ? EDGE_MARGIN : window.innerWidth - SIZE - EDGE_MARGIN;
        const minY = EDGE_MARGIN;
        const maxY = window.innerHeight - SIZE - EDGE_MARGIN;
        const clampedY = Math.min(Math.max(currentY, minY), maxY);
        x.set(snappedX);
        y.set(clampedY);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ side: goLeft ? 'left' : 'right', y: clampedY }));
        } catch {
          // best-effort persistence only
        }
      }}
      onClick={() => { if (dragMoved.current < 8) onOpen(); }}
      animate={dragging ? { opacity: 1 } : { opacity: [0.6, 1, 0.6] }}
      transition={dragging ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      whileTap={{ scale: 0.95 }}
      className="cursor-pointer select-none"
    >
      <div
        className="w-full h-full rounded-full flex items-center justify-center shadow-lg"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        <Bot className="w-6 h-6 text-white" />
      </div>
    </motion.div>
  );
}
