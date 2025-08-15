// src/components/ScrollText.tsx
import React, { useEffect, useRef, useState } from "react";

type Props = {
  text?: string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  speedPxPerSec?: number; // scrolling speed
  minWidthToScroll?: number; // trigger scrolling when outer width <= this
};

export default function ScrollText({ text = "", color, className, style, speedPxPerSec = 60, minWidthToScroll }: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const [animate, setAnimate] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    // measure overflow
    const widthConstraint = typeof minWidthToScroll === 'number' ? (outer.clientWidth <= minWidthToScroll) : false;
    const overflow = widthConstraint || inner.scrollWidth > outer.clientWidth + 2; // small tolerance
    if (overflow) {
      const dist = inner.scrollWidth + 32; // include gap
      setDuration(dist / speedPxPerSec);
      setAnimate(true);
    } else {
      setAnimate(false);
    }
  }, [text, speedPxPerSec, minWidthToScroll]);

  return (
    <div ref={outerRef} className={`marquee ${animate ? "marquee--animate" : ""} ${className ?? ""}`} style={style}>
      <span ref={innerRef} className="marquee__inner" style={{ color }}>{text}</span>
      {animate && <span className="marquee__inner clone" style={{ color }}>{text}</span>}
      {/* inline CSS variable to control duration */}
      <style>{`:root { --marquee-duration: ${Math.max(8, Math.min(60, duration)).toFixed(2)}s; }`}</style>
    </div>
  );
}
