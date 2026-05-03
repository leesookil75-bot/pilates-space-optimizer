'use client';
import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Label, Tag, Text as KonvaText, Group, Circle } from 'react-konva';
import Konva from 'konva';
import Grid from './Grid';
import FloorPlan from './FloorPlan';
import Equipment, { EquipmentData, EQUIPMENT_DIMS } from './Equipment';
import { KonvaEventObject } from 'konva/lib/Node';
import { RoomData, Point } from '@/app/page';

function isPointInPolygon(point: Point, vs: Point[]) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export const getClosestPointOnSegment = (p: Point, v: Point, w: Point) => {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) return { x: v.x, y: v.y, dist: Math.hypot(p.x - v.x, p.y - v.y) };
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
  return { ...proj, dist: Math.hypot(p.x - proj.x, p.y - proj.y) };
};

export const calculateRoomAreaInfo = (points: Point[]) => {
  let area = 0;
  let j = points.length - 1;
  for (let i = 0; i < points.length; i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    j = i;
  }
  const areaPx = Math.abs(area / 2);
  const areaSqm = areaPx / (50 * 50);
  const areaPyeong = areaSqm / 3.3058;
  return { areaSqm, areaPyeong };
};

interface EditorCanvasProps {
  equipments: EquipmentData[];
  setEquipments: (equipments: EquipmentData[]) => void;
  rooms: RoomData[];
  setRooms: (rooms: RoomData[]) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  editorRef?: React.RefObject<EditorCanvasHandle | null>;
  readOnly?: boolean;
  movingRoomId?: string | null;
}

export interface EditorCanvasHandle {
  downloadImage: (fileName?: string) => void;
}

export default function EditorCanvas({ equipments, setEquipments, rooms, setRooms, selectedId, setSelectedId, editorRef, readOnly = false, movingRoomId = null }: EditorCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const mainLayerRef = useRef<Konva.Layer>(null);
  
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

  // Room drag native state
  const draggingEquipmentsRef = useRef<string[]>([]);
  const initialEquipmentsRef = useRef<EquipmentData[]>([]);
  const initialRoomPointsRef = useRef<Point[]>([]);
  const draggingRoomIndexRef = useRef<number>(-1);

  const handleRoomDragStart = (room: RoomData, index: number) => {
    initialEquipmentsRef.current = [...equipments];
    initialRoomPointsRef.current = [...room.points];
    draggingRoomIndexRef.current = index;
    const inRoomIds = equipments
      .filter((eq) => {
        // Strict Drag Ownership: Do not kidnap equipments that belong to another room
        if (eq.linkedRoomId && eq.linkedRoomId !== room.id) return false;
        return isPointInPolygon({ x: eq.x, y: eq.y }, room.points);
      })
      .map((eq) => eq.id);
    draggingEquipmentsRef.current = inRoomIds;
  };

  const handleRoomDragMove = (dx: number, dy: number, source: 'room' | 'badge') => {
    const roomIndex = draggingRoomIndexRef.current;
    if (roomIndex === -1) return;

    const stage = stageRef.current;
    if (!stage) return;

    const room = rooms[roomIndex];

    // Natively move equipments
    if (draggingEquipmentsRef.current.length > 0) {
      let eqLayer: any = null;
      draggingEquipmentsRef.current.forEach(eqId => {
        const node = stage.findOne(`#eq-${eqId}`);
        const initialEq = initialEquipmentsRef.current.find(e => e.id === eqId);
        if (node && initialEq) {
          node.position({ x: initialEq.x + dx, y: initialEq.y + dy });
          if (!eqLayer) eqLayer = node.getLayer();
        }
      });
      if (eqLayer) eqLayer.batchDraw();
    }

    // Natively move the other part
    if (source === 'badge') {
      const roomNode = stage.findOne(`#room-${room.id}`);
      if (roomNode) {
        roomNode.position({ x: dx, y: dy });
        roomNode.getLayer()?.batchDraw();
      }
    } else {
      const badgeNode = stage.findOne(`#badge-${room.id}`);
      if (badgeNode) {
        const minX = Math.min(...initialRoomPointsRef.current.map((p) => p.x));
        const minY = Math.min(...initialRoomPointsRef.current.map((p) => p.y));
        const isOuter = room.type === 'outer';
        badgeNode.position({ x: minX + (isOuter ? 0 : 10) + dx, y: minY + (isOuter ? -80 : 10) + dy });
        badgeNode.getLayer()?.batchDraw();
      }
    }
  };

  const handleRoomDragEnd = (dx: number, dy: number) => {
    const roomIndex = draggingRoomIndexRef.current;
    if (roomIndex === -1) return;

    const stage = stageRef.current;
    if (stage) {
      const room = rooms[roomIndex];
      const roomNode = stage.findOne(`#room-${room.id}`);
      if (roomNode) roomNode.position({ x: 0, y: 0 }); // reset native position
    }

    // Update React State ONCE
    const newRooms = [...rooms];
    newRooms[roomIndex] = {
      ...newRooms[roomIndex],
      points: initialRoomPointsRef.current.map(p => ({ x: p.x + dx, y: p.y + dy }))
    };
    setRooms(newRooms);

    if (draggingEquipmentsRef.current.length > 0) {
      const newEqs = initialEquipmentsRef.current.map((eq) => {
        if (draggingEquipmentsRef.current.includes(eq.id)) {
          return { ...eq, x: eq.x + dx, y: eq.y + dy };
        }
        return eq;
      });
      setEquipments(newEqs);
    }

    draggingEquipmentsRef.current = [];
    draggingRoomIndexRef.current = -1;
    setSelectedId(null);
  };

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
          <Layer ref={mainLayerRef}>
            <Grid 
              width={stageSize.width} 
              height={stageSize.height} 
              scale={scale} 
              stageX={position.x} 
              stageY={position.y} 
            />
            {/* Rooms */}
            {rooms.map((room, index) => (
              <FloorPlan 
                key={room.id}
                room={room} 
                allRooms={rooms}
                hasInnerRooms={rooms.length > 1}
                onChange={(newPoints) => {
                  const newRooms = [...rooms];
                  newRooms[index] = { ...room, points: newPoints };
                  
                  const linkedEqs = equipments.filter(eq => eq.linkedRoomId === room.id);
                  if (linkedEqs.length > 0) {
                    const minX = Math.min(...newPoints.map(p => p.x));
                    const maxX = Math.max(...newPoints.map(p => p.x));
                    const minY = Math.min(...newPoints.map(p => p.y));
                    const maxY = Math.max(...newPoints.map(p => p.y));
                    
                    const w = maxX - minX;
                    const h = maxY - minY;
                    const qty = linkedEqs.length;
                    
                    const cols = Math.ceil(Math.sqrt(qty));
                    const rows = Math.ceil(qty / cols);
                    
                    const newEqs = [...equipments];
                    let eqIdx = 0;
                    for (let j = 0; j < newEqs.length; j++) {
                      if (newEqs[j].linkedRoomId === room.id) {
                        const eqType = newEqs[j].type;
                        const eqDims = EQUIPMENT_DIMS[eqType];
                        const clearance = 40; // Default clearance per side
                        const reqW = eqDims.width + (clearance * 2);
                        const reqH = eqDims.height + (clearance * 2);

                        // Start center position so the gray area touches the wall exactly
                        const startX = minX + reqW / 2;
                        const startY = minY + reqH / 2;

                        const maxStepX = reqW;
                        const maxStepY = reqH;

                        const stepX = cols > 1 ? Math.min(maxStepX, (w - reqW) / (cols - 1)) : 0;
                        const stepY = rows > 1 ? Math.min(maxStepY, (h - reqH) / (rows - 1)) : 0;

                        const c = eqIdx % cols;
                        const r = Math.floor(eqIdx / cols);
                        newEqs[j] = {
                          ...newEqs[j],
                          x: startX + (c * stepX),
                          y: startY + (r * stepY),
                        };
                        eqIdx++;
                      }
                    }
                    setEquipments(newEqs);
                  }
                  
                  setRooms(newRooms);
                }} 
                scale={scale}
                readOnly={readOnly}
                isSelected={room.id === selectedId}
                onSelect={() => {
                  if (!readOnly) setSelectedId(room.id);
                }}
                onDragStart={() => handleRoomDragStart(room, index)}
                onDragMove={(dx, dy) => handleRoomDragMove(dx, dy, 'room')}
                onDragEnd={handleRoomDragEnd}
              />
            ))}
            {/* Equipment Layer */}
            {equipments.map((eq, i) => {
              const inLockedRoom = rooms.some(r => r.isLocked && isPointInPolygon({ x: eq.x, y: eq.y }, r.points));
              const isEqLocked = readOnly || inLockedRoom || eq.isLocked;
              return (
                <Equipment
                  key={eq.id}
                  data={isEqLocked ? { ...eq, isLocked: true } : eq}
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
                  rooms={rooms}
                  allEquipments={equipments}
                />
              );
            })}
            {/* Room Labels & Move Handles (Always on top) */}
            {rooms.map((room, index) => {
              const { areaSqm, areaPyeong } = calculateRoomAreaInfo(room.points);
              const minX = Math.min(...room.points.map((p) => p.x));
              const minY = Math.min(...room.points.map((p) => p.y));
              const maxX = Math.max(...room.points.map((p) => p.x));
              const maxY = Math.max(...room.points.map((p) => p.y));
              const centerX = (minX + maxX) / 2;
              const centerY = (minY + maxY) / 2;
              
              const isOuter = room.type === 'outer';
              let textStr = isOuter 
                ? `${room.name} | ${areaPyeong.toFixed(1)}평 (${areaSqm.toFixed(1)}m²)` 
                : `${room.name} • ${areaPyeong.toFixed(1)}평`;

              let iconStr = '';
              if (room.isLocked) iconStr = '🔒 ';

              let tagFill = room.id === selectedId ? '#eff6ff' : 'rgba(255,255,255,0.9)';
              let tagStroke = room.id === selectedId ? '#3b82f6' : '#d1d5db';
              let tagStrokeWidth = room.id === selectedId ? 2 : 1;

              return (
                <React.Fragment key={`room-overlay-${room.id}`}>
                  <Label
                    id={`badge-${room.id}`}
                    x={minX + (isOuter ? 0 : 10)}
                    y={minY + (isOuter ? -80 : 10)}
                    listening={!isOuter}
                    onClick={() => {
                      if (!readOnly) setSelectedId(room.id);
                    }}
                    onTap={() => {
                      if (!readOnly) setSelectedId(room.id);
                    }}
                    onMouseEnter={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container && !isOuter && !readOnly) {
                        container.style.cursor = 'pointer';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container && !isOuter && !readOnly) {
                        container.style.cursor = 'grab';
                      }
                    }}
                  >
                    <Tag 
                      fill={tagFill} 
                      stroke={tagStroke} 
                      strokeWidth={tagStrokeWidth} 
                      cornerRadius={12} 
                    />
                    <KonvaText
                      text={`${iconStr}${textStr}`}
                      fontSize={12}
                      fontFamily="sans-serif"
                      fontStyle="bold"
                      fill="#374151"
                      padding={6}
                    />
                  </Label>

                  {/* Central Move Handle */}
                  {room.id === selectedId && !isOuter && !readOnly && !room.isLocked && (
                    <Group
                      x={centerX}
                      y={centerY}
                      draggable
                      onDragStart={(e) => {
                        if (e.target !== e.currentTarget) return;
                        handleRoomDragStart(room, index);
                      }}
                      onDragMove={(e) => {
                        if (e.target !== e.currentTarget) return;
                        let dx = e.target.x() - centerX;
                        let dy = e.target.y() - centerY;

                        const SNAP_DIST = 15 / scale;
                        let snapDx = 0;
                        let snapDy = 0;
                        let foundSnap = false;

                        for (const otherRoom of rooms) {
                          if (otherRoom.id === room.id) continue;
                          for (let i = 0; i < room.points.length && !foundSnap; i++) {
                            const movingP = { x: room.points[i].x + dx, y: room.points[i].y + dy };
                            
                            // 1. Point to Point
                            for (let j = 0; j < otherRoom.points.length; j++) {
                               const op = otherRoom.points[j];
                               if (Math.hypot(movingP.x - op.x, movingP.y - op.y) < SNAP_DIST) {
                                  snapDx = op.x - movingP.x;
                                  snapDy = op.y - movingP.y;
                                  foundSnap = true;
                                  break;
                               }
                            }
                            if (foundSnap) break;
                            
                            // 2. Point to Line
                            for (let j = 0; j < otherRoom.points.length; j++) {
                               const op1 = otherRoom.points[j];
                               const op2 = otherRoom.points[(j + 1) % otherRoom.points.length];
                               const closest = getClosestPointOnSegment(movingP, op1, op2);
                               if (closest.dist < SNAP_DIST) {
                                  snapDx = closest.x - movingP.x;
                                  snapDy = closest.y - movingP.y;
                                  foundSnap = true;
                                  break;
                               }
                            }
                          }
                          if (foundSnap) break;
                        }

                        if (foundSnap) {
                          dx += snapDx;
                          dy += snapDy;
                          e.target.position({ x: centerX + dx, y: centerY + dy });
                        }

                        handleRoomDragMove(dx, dy, 'badge');
                      }}
                      onDragEnd={(e) => {
                        if (e.target !== e.currentTarget) return;
                        const dx = e.target.x() - centerX;
                        const dy = e.target.y() - centerY;
                        e.target.position({ x: centerX, y: centerY });
                        handleRoomDragEnd(dx, dy);
                      }}
                      onMouseEnter={(e) => {
                        const container = e.target.getStage()?.container();
                        if (container) {
                          container.style.cursor = 'move';
                          // Add hover effect
                          const group = e.currentTarget as Konva.Group;
                          const circle = group.findOne('Circle');
                          if (circle) circle.setAttr('scaleX', 1.1), circle.setAttr('scaleY', 1.1);
                        }
                      }}
                      onMouseLeave={(e) => {
                        const container = e.target.getStage()?.container();
                        if (container) {
                          container.style.cursor = 'grab';
                          const group = e.currentTarget as Konva.Group;
                          const circle = group.findOne('Circle');
                          if (circle) circle.setAttr('scaleX', 1), circle.setAttr('scaleY', 1);
                        }
                      }}
                    >
                      <Circle
                        radius={24}
                        fill="#ffffff"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        shadowColor="#3b82f6"
                        shadowBlur={10}
                        shadowOpacity={0.4}
                      />
                      <KonvaText
                        text="✥"
                        fontSize={24}
                        fill="#3b82f6"
                        x={-12}
                        y={-12}
                        fontStyle="bold"
                        align="center"
                        verticalAlign="middle"
                      />
                    </Group>
                  )}
                </React.Fragment>
              );
            })}
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
