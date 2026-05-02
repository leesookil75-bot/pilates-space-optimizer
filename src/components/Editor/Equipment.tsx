import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text, Transformer, Arc } from 'react-konva';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { RoomData, Point } from '@/app/page';

export type EquipmentType = 'Reformer' | 'Cadillac' | 'Chair' | 'Barrel' | 'Custom' | 'Door';

export interface EquipmentData {
  id: string;
  type: EquipmentType;
  x: number;
  y: number;
  rotation: number;
  width?: number; // Optional custom width
  height?: number; // Optional custom height
  clearance?: number; // Optional custom clearance in cm
  customLabel?: string; // For 'Custom' type equipments
  isLocked?: boolean; // Lock position and rotation
  linkedRoomId?: string; // ID of the room this equipment is auto-arranged within
}

interface EquipmentProps {
  data: EquipmentData;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: EquipmentData) => void;
  scale: number;
  rooms?: RoomData[];
  allEquipments?: EquipmentData[];
}

// 1m = 50px
export const EQUIPMENT_DIMS: Record<EquipmentType, { width: number; height: number; color: string; label: string }> = {
  Reformer: { width: 120, height: 35, color: '#fef08a', label: 'R' }, // Yellow
  Cadillac: { width: 120, height: 40, color: '#fca5a5', label: 'C' }, // Red
  Chair: { width: 40, height: 30, color: '#86efac', label: 'CH' }, // Green
  Barrel: { width: 50, height: 30, color: '#93c5fd', label: 'B' }, // Blue
  Custom: { width: 100, height: 100, color: '#e5e7eb', label: '가구' }, // Gray
  Door: { width: 90, height: 90, color: '#e5e7eb', label: '출입문' },
};

const getSnapSize = (scale: number) => {
  if (scale >= 3) return 10;
  if (scale >= 1.5) return 25;
  return 50;
};

const snapToGrid = (val: number, scale: number) => {
  const snapSize = getSnapSize(scale);
  return Math.round(val / snapSize) * snapSize;
};

const getClosestPointOnSegment = (p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) => {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) return { x: v.x, y: v.y, dist: Math.hypot(p.x - v.x, p.y - v.y) };
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
  return { ...proj, dist: Math.hypot(p.x - proj.x, p.y - proj.y) };
};

const getEquipmentSnap = (
  cx: number, cy: number, currentRot: number, 
  dims: { width: number, height: number }, clearancePx: number, 
  rooms: RoomData[], scale: number
): { x: number, y: number, rotation: number, score: number } | null => {
  const SNAP_DIST = 20 / scale;
  const reqDist1 = dims.height / 2 + clearancePx; // Side edge
  const reqDist2 = dims.width / 2 + clearancePx; // Front/back edge

  let bestSnap: { x: number, y: number, rotation: number, score: number } | null = null;

  rooms.forEach(room => {
    for (let i = 0; i < room.points.length; i++) {
      const p1 = room.points[i];
      const p2 = room.points[(i + 1) % room.points.length];
      
      const vx = p2.x - p1.x;
      const vy = p2.y - p1.y;
      const L = Math.hypot(vx, vy);
      if (L === 0) continue;

      const ux = vx / L;
      const uy = vy / L;
      let nx = -uy;
      let ny = ux;

      const wx = cx - p1.x;
      const wy = cy - p1.y;

      const projU = wx * ux + wy * uy;
      if (projU < 0 || projU > L) continue;

      let dist = wx * nx + wy * ny;
      if (dist < 0) {
        dist = -dist;
        nx = -nx;
        ny = -ny;
      }

      const wallAngle = Math.atan2(vy, vx) * 180 / Math.PI;

      const checkSnap = (reqDist: number, angleOffset: number) => {
        if (Math.abs(dist - reqDist) < SNAP_DIST) {
           const snapX = cx + nx * (reqDist - dist);
           const snapY = cy + ny * (reqDist - dist);
           
           const finalRot = currentRot;
           const score = Math.abs(dist - reqDist);
           
           if (!bestSnap || score < bestSnap.score) {
             bestSnap = { x: snapX, y: snapY, rotation: finalRot, score };
           }
        }
      };

      checkSnap(reqDist1, 0); 
      checkSnap(reqDist2, 90);
    }
  });

  return bestSnap;
};

const getEqToEqSnap = (
  myId: string, cx: number, cy: number, currentRot: number, 
  myDims: { width: number, height: number }, myClearancePx: number, 
  allEquipments: EquipmentData[], scale: number
): { x: number, y: number, rotation: number, score: number } | null => {
  const SNAP_DIST = 20 / scale;
  const ALIGN_DIST = 40 / scale; // More forgiving for axis alignment
  
  let bestSnap: { x: number, y: number, rotation: number, score: number } | null = null;

  allEquipments.forEach(other => {
    if (other.id === myId) return;

    // Default dimensions for other if not customized
    const oDims = EQUIPMENT_DIMS[other.type];
    const ow = other.width || oDims.width;
    const oh = other.height || oDims.height;
    const oClearancePx = (other.clearance ?? 40) / 2;

    const ox = other.x;
    const oy = other.y;
    const oRot = other.rotation || 0;

    // Transform my center to other's local space
    const radInv = -oRot * Math.PI / 180;
    const dx = (cx - ox) * Math.cos(radInv) - (cy - oy) * Math.sin(radInv);
    const dy = (cx - ox) * Math.sin(radInv) + (cy - oy) * Math.cos(radInv);

    const checkLocalSnap = (isPerpendicular: boolean) => {
      const aw = isPerpendicular ? myDims.height : myDims.width;
      const ah = isPerpendicular ? myDims.width : myDims.height;
      
      const reqXDist = (aw / 2 + myClearancePx) + (ow / 2 + oClearancePx);
      const reqYDist = (ah / 2 + myClearancePx) + (oh / 2 + oClearancePx);

      let snapDx = dx;
      let snapDy = dy;
      let didSnap = false;

      // Check X-axis touch (aligning Y)
      if (Math.abs(Math.abs(dx) - reqXDist) < SNAP_DIST && Math.abs(dy) < ALIGN_DIST) {
        snapDx = dx > 0 ? reqXDist : -reqXDist;
        snapDy = 0; // Align center
        didSnap = true;
      }
      // Check Y-axis touch (aligning X)
      else if (Math.abs(Math.abs(dy) - reqYDist) < SNAP_DIST && Math.abs(dx) < ALIGN_DIST) {
        snapDy = dy > 0 ? reqYDist : -reqYDist;
        snapDx = 0; // Align center
        didSnap = true;
      }

      if (didSnap) {
        // Convert back to global space
        const rad = oRot * Math.PI / 180;
        const snapX = ox + snapDx * Math.cos(rad) - snapDy * Math.sin(rad);
        const snapY = oy + snapDx * Math.sin(rad) + snapDy * Math.cos(rad);

        const finalRot = currentRot;
        const score = Math.hypot(snapX - cx, snapY - cy);

        if (!bestSnap || score < bestSnap.score) {
          bestSnap = { x: snapX, y: snapY, rotation: finalRot, score };
        }
      }
    };

    checkLocalSnap(false); // parallel
    checkLocalSnap(true); // perpendicular
  });

  return bestSnap;
};

function Equipment({ data, isSelected, onSelect, onChange, scale, rooms = [], allEquipments = [] }: EquipmentProps) {
  const shapeRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const defaultDims = EQUIPMENT_DIMS[data.type];
  const dims = {
    width: data.width || defaultDims.width,
    height: data.height || defaultDims.height,
    color: defaultDims.color,
    label: data.customLabel || defaultDims.label
  };

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      // we need to attach transformer manually
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    onChange({
      ...data,
      x: e.target.x(),
      y: e.target.y(),
      rotation: e.target.rotation(),
      linkedRoomId: undefined, // Unlink when manually moved
    });
  };

  const handleTransformEnd = (e: KonvaEventObject<Event>) => {
    const node = shapeRef.current;
    if (!node) return;

    onChange({
      ...data,
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
    });
  };

  return (
    <React.Fragment>
      <Group
        id={`eq-${data.id}`}
        ref={shapeRef}
        x={data.x}
        y={data.y}
        rotation={data.rotation}
        draggable={!data.isLocked}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        // Center origin for easier rotation
        offsetX={data.type === 'Door' ? 0 : dims.width / 2}
        offsetY={data.type === 'Door' ? 0 : dims.height / 2}
        onDragMove={(e) => {
          if (data.isLocked) return;

          const nx = e.target.x();
          const ny = e.target.y();
          let nrot = e.target.rotation();

          // Calculate visual width/height based on rotation
          const rotMod = (nrot % 180 + 180) % 180;
          const isHorizontal = rotMod < 45 || rotMod > 135;
          const vw = isHorizontal ? dims.width : dims.height;
          const vh = isHorizontal ? dims.height : dims.width;

          let targetX = snapToGrid(nx - vw / 2, scale) + vw / 2;
          let targetY = snapToGrid(ny - vh / 2, scale) + vh / 2;
          let targetRot = nrot;

          if (data.type === 'Door' && rooms) {
            const SNAP_DIST = 15 / scale;
            let closestX = 0;
            let closestY = 0;
            let found = false;
            let minDist = Infinity;

            rooms.forEach(room => {
              for (let i = 0; i < room.points.length; i++) {
                const p1 = room.points[i];
                const p2 = room.points[(i + 1) % room.points.length];
                const closest = getClosestPointOnSegment({x: nx, y: ny}, p1, p2);
                if (closest.dist < minDist && closest.dist < SNAP_DIST) {
                  minDist = closest.dist;
                  closestX = closest.x;
                  closestY = closest.y;
                  found = true;
                }
              }
            });

            if (found) {
              targetX = closestX;
              targetY = closestY;
            } else {
              targetX = snapToGrid(nx, scale);
              targetY = snapToGrid(ny, scale);
            }
          } else if (data.type !== 'Door') {
            const clearanceCm = data.clearance ?? 40;
            const clearancePx = clearanceCm / 2;
            
            // 1st Priority: Equipment to Equipment Snapping
            let bestSnap: { x: number, y: number, rotation: number, score: number } | null = null;
            if (allEquipments) {
              bestSnap = getEqToEqSnap(data.id, nx, ny, nrot, dims, clearancePx, allEquipments, scale);
            }

            // 2nd Priority: Wall Snapping
            if (!bestSnap && rooms) {
              bestSnap = getEquipmentSnap(nx, ny, nrot, dims, clearancePx, rooms, scale);
            }

            if (bestSnap) {
              targetX = bestSnap.x;
              targetY = bestSnap.y;
              targetRot = bestSnap.rotation;
            }
          }

          e.target.position({ x: targetX, y: targetY });
          e.target.rotation(targetRot);
        }}
        onMouseEnter={(e) => {
          if (data.isLocked) return;
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'move';
        }}
        onMouseLeave={(e) => {
          if (data.isLocked) return;
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'grab';
        }}
      >
        {/* Safety Margin (Clearance space) */}
        {(() => {
          const clearanceCm = data.clearance ?? 40; // Default 40cm
          const clearancePx = clearanceCm / 2;
          return (
            <Rect
              x={-clearancePx}
              y={-clearancePx}
              width={dims.width + (clearancePx * 2)}
              height={dims.height + (clearancePx * 2)}
              fill="rgba(0,0,0,0.05)"
              cornerRadius={4}
            />
          );
        })()}
        
        {/* Actual Equipment Body or Door */}
        {data.type === 'Door' ? (
          <Group>
            <Rect width={dims.width} height={4} fill="#9ca3af" />
            <Arc
              x={0}
              y={0}
              innerRadius={0}
              outerRadius={dims.width}
              angle={90}
              fill="rgba(156, 163, 175, 0.2)"
              stroke="#9ca3af"
              strokeWidth={1.5}
            />
            <Text
              x={dims.width / 2}
              y={dims.width / 2}
              text="문"
              fontSize={14}
              fontStyle="bold"
              fill="#4b5563"
              align="center"
              verticalAlign="middle"
              offsetX={7}
              offsetY={7}
            />
          </Group>
        ) : (
          <Group>
            <Rect
              x={0}
              y={0}
              width={dims.width}
              height={dims.height}
              fill={dims.color}
              stroke="#000"
              strokeWidth={isSelected ? 2 : 1}
              cornerRadius={4}
            />
            <Text
              x={dims.width / 2}
              y={dims.height / 2}
              text={dims.label}
              fontSize={16}
              fontStyle="bold"
              fill="#000"
              align="center"
              verticalAlign="middle"
              offsetX={dims.label.length * 5}
              offsetY={8}
            />
          </Group>
        )}
      </Group>

      {isSelected && !data.isLocked && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit resizing (we only want rotation, but we can disable scale anchors)
            return newBox;
          }}
          resizeEnabled={false} // Only allow rotation
          rotateEnabled={true}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          rotationSnapTolerance={15} // Sticky snap within 15 degrees
          anchorSize={10 / scale}
          padding={5}
        />
      )}
    </React.Fragment>
  );
}

export default React.memo(Equipment, (prevProps, nextProps) => {
  return (
    prevProps.data === nextProps.data &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.scale === nextProps.scale
  );
});
