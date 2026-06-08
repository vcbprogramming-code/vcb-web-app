import { useRef, useState, useEffect } from 'react';

/**
 * A small canvas the approver draws their signature on (mouse or touch).
 * Exposes the drawing as a PNG data URL via onChange. Returns empty when blank.
 */
export default function SignaturePad({ onChange, height = 140 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    // size the backing store to the displayed size for crisp lines
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e3a8a';
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
    if (!hasInk) setHasInk(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(hasInk ? canvasRef.current.toDataURL('image/png') : null);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
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
        <span className="text-xs text-slate-400">เซ็นลายเซ็นในกรอบ (ใช้เมาส์หรือนิ้ว)</span>
        <button type="button" onClick={clear} className="text-xs text-slate-500 hover:text-red-600">ล้าง</button>
      </div>
    </div>
  );
}
