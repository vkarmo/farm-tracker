import React, { useState, useRef, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { GripHorizontal } from 'lucide-react';

// A helper to auto-resize leaflet when container size changes
export const MapResizer = () => {
  const map = useMap();
  
  useEffect(() => {
    // If ResizeObserver is not available, we gracefully fallback
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    
    // map.getContainer() returns the underlying DOM element
    const container = map.getContainer();
    if (container) {
      observer.observe(container);
    }
    
    return () => observer.disconnect();
  }, [map]);

  return null;
};

export default function ResizableMapWrapper({ children, initialHeight = 300, minHeight = 200, style = {} }) {
  const [height, setHeight] = useState(initialHeight);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(height);

  const onMouseDown = (e) => {
    isDragging.current = true;
    startY.current = e.clientY || e.touches?.[0]?.clientY;
    startHeight.current = height;
    
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    // Passive false is needed to prevent scrolling on touch devices while resizing
    document.addEventListener('touchmove', onMouseMove, { passive: false });
    document.addEventListener('touchend', onMouseUp);
  };

  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    
    // Only prevent default on touch events if passive is false, this stops scrolling
    if (e.type === 'touchmove') {
        if (e.cancelable) e.preventDefault();
    }
    
    const currentY = e.clientY || e.touches?.[0]?.clientY;
    const deltaY = currentY - startY.current;
    
    // Don't let it shrink below minHeight
    const newHeight = Math.max(minHeight, startHeight.current + deltaY);
    setHeight(newHeight);
  };

  const onMouseUp = () => {
    isDragging.current = false;
    document.body.style.userSelect = '';
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onMouseMove);
    document.removeEventListener('touchend', onMouseUp);
  };

  // Clean up event listeners if unmounted while dragging
  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onMouseMove);
      document.removeEventListener('touchend', onMouseUp);
    };
  }, []);

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      borderRadius: 'var(--radius-md)', 
      overflow: 'hidden', 
      border: '1px solid var(--color-border)', 
      display: 'flex', 
      flexDirection: 'column',
      ...style
    }}>
      <div style={{ height: `${height}px`, width: '100%', position: 'relative' }}>
        {children}
      </div>
      <div 
        onMouseDown={onMouseDown}
        onTouchStart={onMouseDown}
        style={{ 
          height: '24px', 
          background: '#f5f7fa', 
          borderTop: '1px solid var(--color-border)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          cursor: 'ns-resize',
          color: '#888',
          touchAction: 'none' // Important to prevent default panning on mobile
        }}
        title="Drag to resize map vertically"
      >
        <GripHorizontal size={16} />
      </div>
    </div>
  );
}
