// src/components/ScrollText.tsx
import React, { useEffect, useRef, useState } from "react";

type CSSVars = React.CSSProperties & { "--marquee-duration"?: string; "--marquee-distance"?: string };

type Props = {
  text?: string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  speedPxPerSec?: number; // scrolling speed
  minWidthToScroll?: number; // trigger scrolling when outer width <= this
  gapPx?: number; // gap between clones
};

export default function ScrollText({ text = "", color, className, style, speedPxPerSec = 24, minWidthToScroll, gapPx = 32 }: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const itemRef = useRef<HTMLSpanElement | null>(null);
  const [animate, setAnimate] = useState(false);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
  const outer = outerRef.current;
  const item = itemRef.current;
  if (!outer || !item) return;

    const measure = () => {
      const widthConstraint = typeof minWidthToScroll === 'number' ? (outer.clientWidth <= minWidthToScroll) : false;
      const contentWidth = item.scrollWidth;
      const overflow = widthConstraint || contentWidth > outer.clientWidth + 2; // small tolerance
      if (overflow) {
        const dist = contentWidth + gapPx; // distance to move for seamless loop
        setDistance(dist);
        setDuration(dist / speedPxPerSec);
        setAnimate(true);
      } else {
        setAnimate(false);
      }
    };

    // Measure now and on resize/font load
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(outer);
    ro.observe(item);
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    const id = window.setTimeout(measure, 0) as unknown as number; // after font loads
    return () => {
      window.removeEventListener('resize', onResize);
      if (outer) ro.unobserve(outer);
      if (item) ro.unobserve(item);
      ro.disconnect();
      if (id) clearTimeout(id);
    };
  }, [text, speedPxPerSec, minWidthToScroll, gapPx]);

  const dur = Math.max(6, Math.min(120, duration));
  const containerStyle: CSSVars = {
    minWidth: 0,
    ...(style || {}),
    "--marquee-duration": `${dur.toFixed(2)}s`,
    "--marquee-distance": `${Math.max(0, distance)}px`,
  };

  return (
    <div ref={outerRef} className={`marquee ${animate ? "marquee--animate" : ""} ${className ?? ""}`} style={containerStyle}>
      <div className="marquee__track" style={{ display: 'flex', gap: `${gapPx}px`, willChange: animate ? 'transform' as const : undefined }}>
        <span ref={itemRef} className="marquee__item" style={{ color, whiteSpace: 'nowrap' }}>{text}</span>
        {animate && <span className="marquee__item clone" style={{ color, whiteSpace: 'nowrap' }}>{text}</span>}
      </div>
    </div>
  );
}
