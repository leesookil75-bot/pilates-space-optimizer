import React, { useState, useEffect } from 'react';
import { Line, Circle, Group, Text, Arrow } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { RoomData, Point } from '@/app/page';

interface FloorPlanProps {
  room: RoomData;
  allRooms?: RoomData[];
  hasInnerRooms?: boolean;
  onChange: (newPoints: Point[]) => void;
  scale: number;
  readOnly?: boolean;
  onDragStart?: () => void;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: (dx: number, dy: number) => void;
  isMovingRoom?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
}

const getSnapSize = (scale: number) => {
  if (scale >= 3) return 10;
  if (scale >= 1.5) return 25;
  return 50;
};

// Helper to snap to grid
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

function FloorPlan({ room, allRooms = [], hasInnerRooms = false, onChange, scale, readOnly = false, onDragStart, onDragMove, onDragEnd, isMovingRoom = false, onSelect, isSelected = false }: FloorPlanProps) {
  const points = room.points;
  const isOuter = room.type === 'outer';
  const colorTheme = room.colorTheme;
  const fillColor = isOuter ? 'rgba(59, 130, 246, 0.1)' : `${colorTheme}33`; // 20% opacity hex
  const strokeColor = colorTheme;

  const [localPoints, setLocalPoints] = useState(points);
  useEffect(() => setLocalPoints(points), [points]);

  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Convert array of objects to flat array [x1, y1, x2, y2, ...] required by Konva Line
  const flatPoints = localPoints.reduce((acc, point) => {
    acc.push(point.x, point.y);
    return acc;
  }, [] as number[]);

  // Calculate midpoints for the ghost markers
  const midpoints = localPoints.map((p1, i) => {
    const p2 = localPoints[(i + 1) % localPoints.length];
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      insertIdx: (i + 1) % points.length,
    };
  });

  const handleDragMove = (index: number, e: KonvaEventObject<DragEvent>) => {
    const newPoints = [...localPoints];
    let newX = e.target.x();
    let newY = e.target.y();

    // Smart Snapping to adjacent vertices to form right angles
    const SNAP_THRESHOLD = 15 / scale;
    // 1. Check snapping to other rooms' vertices (Point-to-Point)
    let closestVertexDist = Infinity;
    let snappedVertex: { x: number, y: number } | null = null;
    
    // 2. Check snapping to other rooms' walls (Point-to-Line)
    let closestWallDist = Infinity;
    let snappedWallPoint: { x: number, y: number } | null = null;

    for (const otherRoom of allRooms) {
      if (otherRoom.id === room.id) continue;
      for (let i = 0; i < otherRoom.points.length; i++) {
        const p1 = otherRoom.points[i];
        
        // Vertex snap check
        const dist = Math.hypot(newX - p1.x, newY - p1.y);
        if (dist < closestVertexDist && dist < SNAP_THRESHOLD) {
          closestVertexDist = dist;
          snappedVertex = { x: p1.x, y: p1.y };
        }

        // Wall snap check
        const p2 = otherRoom.points[(i + 1) % otherRoom.points.length];
        const closest = getClosestPointOnSegment({ x: newX, y: newY }, p1, p2);
        if (closest.dist < closestWallDist && closest.dist < SNAP_THRESHOLD) {
          closestWallDist = closest.dist;
          snappedWallPoint = { x: closest.x, y: closest.y };
        }
      }
    }

    if (snappedVertex) {
      // 1st priority: other room vertex
      newX = snappedVertex.x;
      newY = snappedVertex.y;
    } else if (snappedWallPoint) {
      // 2nd priority: other room wall
      newX = snappedWallPoint.x;
      newY = snappedWallPoint.y;
    } else {
      // 3rd priority: orthogonal snap to own adjacent vertices
      const len = localPoints.length;
      const prev = localPoints[(index - 1 + len) % len];
      const next = localPoints[(index + 1) % len];

      if (Math.abs(newX - prev.x) < SNAP_THRESHOLD) newX = prev.x;
      else if (Math.abs(newX - next.x) < SNAP_THRESHOLD) newX = next.x;

      if (Math.abs(newY - prev.y) < SNAP_THRESHOLD) newY = prev.y;
      else if (Math.abs(newY - next.y) < SNAP_THRESHOLD) newY = next.y;
    }

    // Apply the snapped coordinates back to the visual target so it locks in place
    e.target.position({ x: newX, y: newY });

    newPoints[index] = { x: newX, y: newY };
    setLocalPoints(newPoints);
  };

  return (
    <Group 
      id={`room-${room.id}`}
      draggable={!isOuter && isMovingRoom}
      onClick={(e) => {
        if (e.target.name() !== 'vertex' && e.target.name() !== 'midpoint') {
          onSelect && onSelect();
        }
      }}
      onTap={(e) => {
        if (e.target.name() !== 'vertex' && e.target.name() !== 'midpoint') {
          onSelect && onSelect();
        }
      }}
      onDragStart={(e) => {
        if (e.target !== e.currentTarget) return;
        // e.target.setAttr('startX', e.target.x()); // Save start pos if needed
        // e.target.setAttr('startY', e.target.y());
        onDragStart && onDragStart();
      }}
      onDragMove={(e) => {
        if (e.target !== e.currentTarget) return;
        // Calculate absolute dx, dy from 0,0 since we reset it onDragEnd previously?
        // Wait, if we don't reset in onDragMove, e.target.x() is the accumulated dx!
        const dx = e.target.x();
        const dy = e.target.y();
        onDragMove && onDragMove(dx, dy);
      }}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return; // Ignore drag ends from child nodes
        const dx = e.target.x();
        const dy = e.target.y();
        e.target.position({ x: 0, y: 0 }); // Reset visual position immediately
        
        onDragEnd && onDragEnd(dx, dy);
      }}
      dragBoundFunc={function(this: any, pos) {
        if (isOuter) return pos;
        const stage = this.getStage();
        if (!stage) return pos;
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const relativePos = transform.point(pos);
        const snappedRelative = {
           x: snapToGrid(relativePos.x, scale),
           y: snapToGrid(relativePos.y, scale)
        };
        return stage.getAbsoluteTransform().point(snappedRelative);
      }}
    >
      {/* The main polygon shape */}
      {(() => {
        const showHighlight = isSelected && !isOuter && !room.isLocked;
        return (
          <Line
            points={flatPoints}
            closed
            fill={showHighlight ? `${colorTheme}66` : fillColor}
            stroke={showHighlight ? '#2563eb' : strokeColor}
            strokeWidth={(showHighlight ? 8 : 4) / scale}
            shadowColor={showHighlight ? '#2563eb' : undefined}
            shadowBlur={showHighlight ? 20 : 0}
            shadowOpacity={0.8}
            dash={isMovingRoom ? [15 / scale, 10 / scale] : undefined}
            lineJoin="round"
        perfectDrawEnabled={false}
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container && !isOuter) container.style.cursor = 'move';
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container && !isOuter) container.style.cursor = 'grab';
        }}
      />
        );
      })()}

      {/* Draggable Vertex Points */}
      {!readOnly && !room.isLocked && localPoints.map((point, index) => (
        <Circle
          key={`vertex-${index}`}
          name="vertex"
          x={point.x}
          y={point.y}
          radius={hoveredPoint === index ? 8 / scale : 6 / scale}
          fill="#ffffff"
          stroke={strokeColor}
          strokeWidth={2 / scale}
          draggable={!readOnly && !room.isLocked}
          onDragMove={(e) => handleDragMove(index, e)}
          onDragEnd={(e) => {
            const newPoints = [...localPoints];
            newPoints[index] = { x: e.target.x(), y: e.target.y() };
            onChange(newPoints);
          }}
          onMouseEnter={() => {
            if (readOnly) return;
            setHoveredPoint(index);
            document.body.style.cursor = 'move';
          }}
          onMouseLeave={() => {
            if (readOnly) return;
            setHoveredPoint(null);
            document.body.style.cursor = 'grab';
          }}
          // Ensure circle position updates correctly during drag
          dragBoundFunc={function(this: any, pos) {
             const stage = this.getStage();
             if (!stage) return pos;
             const transform = stage.getAbsoluteTransform().copy();
             transform.invert();
             const relativePos = transform.point(pos);
             const snappedRelative = {
                x: snapToGrid(relativePos.x, scale),
                y: snapToGrid(relativePos.y, scale)
             };
             return stage.getAbsoluteTransform().point(snappedRelative);
          }}
        />
      ))}

      {/* Midpoint Ghost Markers */}
      {!readOnly && !room.isLocked && midpoints.map((mp, index) => (
        <Circle
          key={`midpoint-${index}`}
          name="midpoint"
          x={mp.x}
          y={mp.y}
          radius={5 / scale}
          fill={strokeColor}
          opacity={0.4}
          onClick={() => {
            if (readOnly || room.isLocked) return;
            const newPoints = [...localPoints];
            newPoints.splice(mp.insertIdx, 0, { x: snapToGrid(mp.x, scale), y: snapToGrid(mp.y, scale) });
            onChange(newPoints);
          }}
          onTap={() => {
            if (readOnly || room.isLocked) return;
            const newPoints = [...localPoints];
            newPoints.splice(mp.insertIdx, 0, { x: snapToGrid(mp.x, scale), y: snapToGrid(mp.y, scale) });
            onChange(newPoints);
          }}
          onMouseEnter={(e) => {
            e.target.opacity(0.8);
            e.target.scale({ x: 1.5, y: 1.5 });
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'pointer';
          }}
          onMouseLeave={(e) => {
            e.target.opacity(0.4);
            e.target.scale({ x: 1, y: 1 });
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'grab';
          }}
        />
      ))}

      {/* CAD-Style Dimension Lines */}
      {isOuter && localPoints.map((p1, i) => {
        const p2 = localPoints[(i + 1) % localPoints.length];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const L = Math.hypot(dx, dy);
        
        if (L < 10) return null; // Avoid division by zero or cluttered small dimensions

        const distanceCm = Math.round(L * 2);
        
        // Unit vector
        const ux = dx / L;
        const uy = dy / L;

        // Normal vector pointing outward (assuming clockwise points)
        const nx = uy;
        const ny = -ux;

        // Tiered dimension lines: Inner rooms' dimensions are drawn closer to the wall
        // so they don't overlap with the outer wall's dimensions.
        const offsetDist = isOuter ? 55 / scale : 25 / scale;
        const overshoot = 10 / scale;

        // Dimension line start/end
        const dimStartX = p1.x + nx * offsetDist;
        const dimStartY = p1.y + ny * offsetDist;
        const dimEndX = p2.x + nx * offsetDist;
        const dimEndY = p2.y + ny * offsetDist;

        // Midpoint
        const dimMidX = (dimStartX + dimEndX) / 2;
        const dimMidY = (dimStartY + dimEndY) / 2;

        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle > 90 || angle <= -90) {
          angle += 180;
        }

        // Deduplication logic: check if any other room has an identical segment (forward or reverse)
        // If so, only the outer room, or the room with the lexicographically smaller ID draws it.
        const EPSILON = 1;
        let shouldDrawDimension = true;
        
        for (const other of allRooms) {
          if (other.id === room.id) continue;
          
          let hasOverlap = false;
          const op = other.points;
          for (let j = 0; j < op.length; j++) {
            const q1 = op[j];
            const q2 = op[(j + 1) % op.length];
            
            const matchForward = Math.hypot(p1.x - q1.x, p1.y - q1.y) < EPSILON && Math.hypot(p2.x - q2.x, p2.y - q2.y) < EPSILON;
            const matchReverse = Math.hypot(p1.x - q2.x, p1.y - q2.y) < EPSILON && Math.hypot(p2.x - q1.x, p2.y - q1.y) < EPSILON;
            
            if (matchForward || matchReverse) {
              hasOverlap = true;
              break;
            }
          }
          
          if (hasOverlap) {
            // Hide inner room's dimension if it overlaps with any other room's wall.
            // The length can be inferred from the opposite non-shared wall, reducing visual clutter.
            if (!isOuter) {
              shouldDrawDimension = false;
              break;
            }
          }
        }

        if (!shouldDrawDimension) return null;

        return (
          <Group key={`dim-${i}`} listening={false}>
            {/* Extension Line 1 */}
            <Line
              points={[
                p1.x + nx * (10 / scale), p1.y + ny * (10 / scale), // Start slightly off the wall
                p1.x + nx * (offsetDist + overshoot), p1.y + ny * (offsetDist + overshoot)
              ]}
              stroke="#9ca3af" // gray-400
              strokeWidth={1 / scale}
            />
            {/* Extension Line 2 */}
            <Line
              points={[
                p2.x + nx * (10 / scale), p2.y + ny * (10 / scale),
                p2.x + nx * (offsetDist + overshoot), p2.y + ny * (offsetDist + overshoot)
              ]}
              stroke="#9ca3af" // gray-400
              strokeWidth={1 / scale}
            />
            {/* Dimension Line with Arrows */}
            <Arrow
              points={[dimStartX, dimStartY, dimEndX, dimEndY]}
              stroke="#9ca3af"
              strokeWidth={1.5 / scale}
              fill="#9ca3af"
              pointerAtBeginning={true}
              pointerLength={6 / scale}
              pointerWidth={6 / scale}
            />
            {/* Centered Dimension Text with White Halo */}
            <Text
              x={dimMidX}
              y={dimMidY}
              width={200 / scale}
              offsetX={100 / scale}
              offsetY={6 / scale} // Vertically center text over the dimension line
              text={`${distanceCm.toLocaleString()} cm`}
              fontSize={12 / scale}
              fontStyle="bold"
              fill="#374151" // gray-700
              stroke="white"
              strokeWidth={8 / scale} // Thick white stroke creates a background break in the arrow line
              fillAfterStrokeEnabled={true}
              align="center"
              rotation={angle}
            />
          </Group>
        );
      })}
    </Group>
  );
}

export default React.memo(FloorPlan, (prevProps, nextProps) => {
  return (
    prevProps.room === nextProps.room &&
    prevProps.hasInnerRooms === nextProps.hasInnerRooms &&
    prevProps.scale === nextProps.scale &&
    prevProps.readOnly === nextProps.readOnly
  );
});
