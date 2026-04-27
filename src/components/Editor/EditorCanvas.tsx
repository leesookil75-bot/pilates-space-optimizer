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
}

export interface EditorCanvasHandle {
  downloadImage: (fileName?: string) => void;
}

export default function EditorCanvas({ equipments, setEquipments, rooms, setRooms, selectedId, setSelectedId, editorRef }: EditorCanvasProps) {
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

    const mousePointTo = {
      x: stage.getPointerPosition()!.x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition()!.y / oldScale - stage.y() / oldScale,
    };

    // Zoom in or out
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // Limit min/max zoom
    if (newScale < 0.1 || newScale > 10) return;

    setScale(newScale);
    setPosition({
      x: -(mousePointTo.x - stage.getPointerPosition()!.x / newScale) * newScale,
      y: -(mousePointTo.y - stage.getPointerPosition()!.y / newScale) * newScale,
    });
  }, []);

  // Handle pinch-to-zoom (touch)
  const handleTouchMove = useCallback((e: KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];

    if (touch1 && touch2) {
      const stage = stageRef.current;
      if (!stage) return;

      if (stage.isDragging()) {
        stage.stopDrag();
      }

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

      // calculate pointer position relative to stage
      // Note: touch positions are relative to viewport. We need to account for container position if it's not full screen, 
      // but assuming the container is full screen or using clientX/Y directly for scale is close enough for relative movement.
      // A more robust way is to use stage.getPointerPosition() if it was correctly updated, but Konva might not update it on multitouch perfectly.
      // We will use standard Konva math:
      
      const containerRect = containerRef.current?.getBoundingClientRect();
      const stageCenterX = containerRect ? center.x - containerRect.left : center.x;
      const stageCenterY = containerRect ? center.y - containerRect.top : center.y;

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
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastDist.current = 0;
    lastCenter.current = null;
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
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
              />
            ))}
            {/* Equipment Layer */}
            {equipments.map((eq, i) => (
              <Equipment
                key={eq.id}
                data={eq}
                isSelected={eq.id === selectedId}
                onSelect={() => setSelectedId(eq.id)}
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
