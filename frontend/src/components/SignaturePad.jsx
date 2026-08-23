import { useRef, useEffect } from 'react';
import { useT } from '../lib/i18n.jsx';

/**
 * A small canvas the approver draws their signature on (mouse or touch).
 * Exposes the drawing as a PNG data URL via onChange. Returns null when blank.
 */
export default function SignaturePad({ onChange, height = 140 }) {
  const t = useT();
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasInk = useRef(false); // ref, not state — avoids stale closure in end()

  // Keep the canvas BITMAP width in sync with its CSS (100%) width. The bitmap is
  // separate from the displayed size; if the container resizes after mount (window
  // resize, layout shift, orientation) but the bitmap doesn't, pos() — computed from
  // the live rect — maps strokes to the wrong bitmap coordinates and the ink no
  // longer follows the pointer. A ResizeObserver re-sizes the bitmap and rescales
  // any existing ink so the drawn signature is preserved across the resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const applyCtx = () => {
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1e3a8a';
    };
    const sizeTo = (w) => {
      const nextW = Math.max(1, Math.round(w));
      if (nextW === canvas.width && canvas.height === height) return;
      const prev = document.createElement('canvas');
      prev.width = canvas.width; prev.height = canvas.height;
      if (prev.width && prev.height) prev.getContext('2d').drawImage(canvas, 0, 0);
      canvas.width = nextW;
      canvas.height = height;
      applyCtx();
      if (prev.width && prev.height) canvas.getContext('2d').drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, canvas.width, canvas.height);
    };
    sizeTo(canvas.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => { const w = entries[0]?.contentRect?.width; if (w) sizeTo(w); });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [height]);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(hasInk.current ? canvasRef.current.toDataURL('image/png') : null);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onChange?.(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height, touchAction: 'none' }}
        className="rounded-xl border-2 border-dashed border-slate-300 bg-white cursor-crosshair"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex justify-between mt-1">
        <span className="text-xs text-slate-400">{t('เซ็นลายเซ็นในกรอบ (ใช้เมาส์หรือนิ้ว)')}</span>
        <button type="button" onClick={clear} className="text-xs text-slate-500 hover:text-red-600">{t('ล้าง')}</button>
      </div>
    </div>
  );
}
