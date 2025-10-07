// src/components/ScrollText.tsx
import React, { useEffect, useRef, useState } from "react";

type Props = {
  text?: string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  speedPxPerSec?: number; // scrolling speed in pixels per second
  minWidthToScroll?: number; // trigger scrolling when outer width <= this
  gapPx?: number; // gap between repeated labels
};

export default function ScrollText({ 
  text = "", 
  color, 
  className = "", 
  style, 
  speedPxPerSec = 24, 
  minWidthToScroll, 
  gapPx = 32
}: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const itemRef = useRef<HTMLSpanElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [animate, setAnimate] = useState(false);
  const [duration, setDuration] = useState(10);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [isRightAligned, setIsRightAligned] = useState(false);

  useEffect(() => {
    const outer = outerRef.current;
    const item = itemRef.current;
    if (!outer || !item) return;

    const measure = () => {
      const currentOuter = outerRef.current;
      const currentItem = itemRef.current;
      if (!currentOuter || !currentItem) return;

      // Detect alignment from parent context
      const parent = currentOuter.parentElement;
      if (parent) {
        const computedStyle = window.getComputedStyle(parent);
        setIsRightAligned(computedStyle.textAlign === "right");
      } else {
        setIsRightAligned(false);
      }

      const widthConstraint = typeof minWidthToScroll === "number"
        ? currentOuter.clientWidth <= minWidthToScroll
        : false;
      const contentWidth = currentItem.scrollWidth;
      const outerWidth = currentOuter.clientWidth;
      const overflow = !!text && (widthConstraint || contentWidth > outerWidth + 2);

      if (overflow) {
        const distance = contentWidth + gapPx;
        const safeSpeed = Math.max(0.1, Math.abs(speedPxPerSec || 0));
        const calcDuration = distance / safeSpeed;
        setScrollDistance(distance);
        setDuration(Math.max(0.5, calcDuration));
        setAnimate(true);
      } else {
        setAnimate(false);
        setScrollDistance(0);
      }
    };

    // Initial measure with delay to ensure DOM is ready
    const initialTimeout = window.setTimeout(measure, 50);
    
    // Measure on changes
    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(measure);
    });
    ro.observe(outer);
    ro.observe(item);

    const onResize = () => {
      window.requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    
    // Re-measure when fonts load
    if (document.fonts) {
      document.fonts.ready.then(measure);
    }
    
    return () => {
      clearTimeout(initialTimeout);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, [text, speedPxPerSec, minWidthToScroll, gapPx]);

  const containerStyle: React.CSSProperties = {
    minWidth: 0,
    position: "relative",
    ...(style || {}),
  };

  // Choose animation direction based on alignment
  const animationName = isRightAligned ? "marquee-scroll-right" : "marquee-scroll-left";

  const wrapperStyle: React.CSSProperties = {
    display: "inline-flex",
    gap: animate ? `${gapPx}px` : undefined,
    animation: animate ? `${animationName} ${duration.toFixed(2)}s linear infinite` : undefined,
    willChange: animate ? "transform" : undefined,
    ["--scroll-distance" as string]: `${scrollDistance}px`,
  };

  return (
    <div 
      ref={outerRef} 
      className={`marquee ${animate ? "marquee--animate" : ""} ${className}`} 
      style={containerStyle}
    >
      <div ref={wrapperRef} className="marquee__wrapper" style={wrapperStyle}>
        <span
          ref={itemRef}
          className="marquee__item"
          style={{ color, whiteSpace: "nowrap", display: "inline-block" }}
        >
          {text}
        </span>
        <span
          className="marquee__item"
          aria-hidden="true"
          style={{
            color,
            whiteSpace: "nowrap",
            display: animate ? "inline-block" : "none",
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
}
