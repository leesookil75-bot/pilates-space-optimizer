'use client';
import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import Grid from './Grid';
import FloorPlan from './FloorPlan';
import Equipment, { EquipmentData } from './Equipment';
import { KonvaEventObject } from 'konva/lib/Node';
import { RoomData, Point } from '@/app/page';

interface EditorCanvasProps {
  equipments: EquipmentData[];
  setEquipments: (equipments: EquipmentData[]) => void;
  rooms: RoomData[];
  setRooms: (rooms: RoomData[]) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  editorRef?: React.RefObject<EditorCanvasHandle | null>;
  readOnly?: boolean;
}

export interface EditorCanvasHandle {
  downloadImage: (fileName?: string) => void;
}

export default function EditorCanvas({ equipments, setEquipments, rooms, setRooms, selectedId, setSelectedId, editorRef, readOnly = false }: EditorCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  
  // Responsive stage sizing
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Stage state (pan and zoom)
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Touch zoom state
  const lastCenter = useRef<{x: number, y: number} | null>(null);
  const lastDist = useRef<number>(0);
  const wasPinching = useRef<boolean>(false);

  const checkDeselect = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    // deselect when clicked on empty area or grid
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
    }
  };

  useImperativeHandle(editorRef, () => ({
    downloadImage: (fileName?: string) => {
      if (stageRef.current) {
        // Capture high resolution PNG of the current viewport
        const uri = stageRef.current.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
        const link = document.createElement('a');
        const safeName = fileName ? fileName : `pilates-floorplan-${Date.now()}`;
        link.download = `${safeName}.png`;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }));

  const hasInitializedScale = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        setStageSize({ width, height });

        if (!hasInitializedScale.current && width > 0) {
          // Calculate auto-fit for the default 500x500 room (center at 350,350)
          if (width < 600) {
            const newScale = width / 700; // room size 500 + padding 200
            setScale(newScale);
            setPosition({
              x: width / 2 - 350 * newScale,
              y: height / 2 - 350 * newScale - 50, // Shift slightly up for mobile toolbar
            });
          } else {
            // Desktop center
            setPosition({
              x: width / 2 - 350,
              y: height / 2 - 350,
            });
          }
          hasInitializedScale.current = true;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle zoom (wheel)
  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.1, Math.min(newScale, 5));

    setScale(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, []);

  const getDistance = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const getCenter = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  };

  // Native touch event listeners for robust pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStartNative = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        wasPinching.current = true;
      }
    };

    const handleTouchMoveNative = (e: TouchEvent) => {
      e.preventDefault(); // Prevent native scroll/zoom

      if (e.touches.length >= 2) {
        wasPinching.current = true;
        const stage = stageRef.current;
        if (!stage) return;

        // Force stop any active Konva dragging (e.g. equipment being dragged accidentally)
        if (typeof Konva !== 'undefined' && Konva.isDragging()) {
           // Konva.isDragging() returns boolean, but there is no public API to stop globally easily without node reference.
           // However, if we just stop propagation, Konva won't receive the touchmove.
        }
        
        e.stopPropagation(); // VERY IMPORTANT: Stop Konva from seeing this move!

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const p1 = { x: touch1.clientX, y: touch1.clientY };
        const p2 = { x: touch2.clientX, y: touch2.clientY };

        const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

        if (!lastDist.current) {
          lastDist.current = dist;
        }

        const center = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
        };

        if (!lastCenter.current) {
          lastCenter.current = center;
          return;
        }

        const oldScale = stage.scaleX();
        const scaleBy = dist / lastDist.current;
        const newScale = oldScale * scaleBy;

        if (newScale < 0.1 || newScale > 10) {
          lastDist.current = dist;
          lastCenter.current = center;
          return;
        }

        const containerRect = container.getBoundingClientRect();
        const stageCenterX = center.x - containerRect.left;
        const stageCenterY = center.y - containerRect.top;

        const mousePointTo = {
          x: stageCenterX / oldScale - stage.x() / oldScale,
          y: stageCenterY / oldScale - stage.y() / oldScale,
        };

        const newPos = {
          x: stageCenterX - mousePointTo.x * newScale + (center.x - lastCenter.current.x),
          y: stageCenterY - mousePointTo.y * newScale + (center.y - lastCenter.current.y),
        };

        // Apply directly to stage for smooth rapid updates before React re-renders
        stage.scale({ x: newScale, y: newScale });
        stage.position(newPos);
        stage.batchDraw();

        // Keep React state in sync
        setScale(newScale);
        setPosition(newPos);

        lastDist.current = dist;
        lastCenter.current = center;
      } else if (wasPinching.current) {
        // Prevent lingering single-finger touch from triggering a jump or drag
        e.stopPropagation();
      }
    };

    const handleTouchEndNative = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastDist.current = 0;
        lastCenter.current = null;
      }
      if (e.touches.length === 0) {
        wasPinching.current = false;
      }
    };

    container.addEventListener('touchstart', handleTouchStartNative, { capture: true });
    container.addEventListener('touchmove', handleTouchMoveNative, { passive: false, capture: true });
    container.addEventListener('touchend', handleTouchEndNative, { capture: true });
    container.addEventListener('touchcancel', handleTouchEndNative, { capture: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStartNative, { capture: true });
      container.removeEventListener('touchmove', handleTouchMoveNative, { capture: true });
      container.removeEventListener('touchend', handleTouchEndNative, { capture: true });
      container.removeEventListener('touchcancel', handleTouchEndNative, { capture: true });
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#fafafa', touchAction: 'none' }}>
      {stageSize.width > 0 && (
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          onWheel={handleWheel}
          onMouseDown={checkDeselect}
          onTouchStart={checkDeselect}
          draggable
          onDragEnd={(e) => {
            // Only update if it's the stage being dragged, not an equipment
            if (e.target === stageRef.current) {
              setPosition({ x: e.target.x(), y: e.target.y() });
            }
          }}
          style={{ cursor: 'grab' }}
        >
          <Layer>
            <Grid 
              width={stageSize.width} 
              height={stageSize.height} 
              scale={scale} 
              stageX={position.x} 
              stageY={position.y} 
            />
            {/* Rooms Layer */}
            {rooms.map((room, index) => (
              <FloorPlan 
                key={room.id}
                room={room} 
                hasInnerRooms={rooms.length > 1}
                onChange={(newPoints) => {
                  const newRooms = [...rooms];
                  newRooms[index] = { ...room, points: newPoints };
                  setRooms(newRooms);
                }} 
                scale={scale}
                readOnly={readOnly}
              />
            ))}
            {/* Equipment Layer */}
            {equipments.map((eq, i) => (
              <Equipment
                key={eq.id}
                data={readOnly ? { ...eq, isLocked: true } : eq}
                isSelected={!readOnly && eq.id === selectedId}
                onSelect={() => {
                  if (!readOnly) setSelectedId(eq.id);
                }}
                onChange={(newAttrs) => {
                  const eqs = equipments.slice();
                  eqs[i] = newAttrs;
                  setEquipments(eqs);
                }}
                scale={scale}
              />
            ))}
          </Layer>
        </Stage>
      )}
      
      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        background: 'white',
        padding: '8px 16px',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '4px'
      }}>
        <div>Zoom: {Math.round(scale * 100)}%</div>
        <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'normal' }}>
          격자 간격: {scale >= 3 ? '0.2m (20cm)' : scale >= 1.5 ? '0.5m (50cm)' : '1m'}
        </div>
      </div>
    </div>
  );
}
