import React, { useState } from 'react';
import { Line, Circle, Group, Text, Arrow } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { RoomData, Point } from '@/app/page';

interface FloorPlanProps {
  room: RoomData;
  hasInnerRooms?: boolean;
  onChange: (newPoints: Point[]) => void;
  scale: number;
  readOnly?: boolean;
  onDragStart?: () => void;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: (dx: number, dy: number) => void;
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

import React, { useMemo } from 'react';

function FloorPlan({ room, hasInnerRooms = false, onChange, scale, readOnly = false, onDragStart, onDragMove, onDragEnd }: FloorPlanProps) {
  const points = room.points;
  const isOuter = room.type === 'outer';
  const colorTheme = room.colorTheme;
  const fillColor = isOuter ? 'rgba(59, 130, 246, 0.1)' : `${colorTheme}33`; // 20% opacity hex
  const strokeColor = colorTheme;

  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Convert array of objects to flat array [x1, y1, x2, y2, ...] required by Konva Line
  const flatPoints = points.reduce((acc, point) => {
    acc.push(point.x, point.y);
    return acc;
  }, [] as number[]);

  // Calculate midpoints for the ghost markers
  const midpoints = points.map((p1, i) => {
    const p2 = points[(i + 1) % points.length];
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      insertIdx: (i + 1) % points.length,
    };
  });

  const handleDragMove = (index: number, e: KonvaEventObject<DragEvent>) => {
    const newPoints = [...points];
    newPoints[index] = {
      x: e.target.x(),
      y: e.target.y(),
    };
    onChange(newPoints);
  };

  return (
    <Group 
      draggable={!isOuter}
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
      <Line
        points={flatPoints}
        closed
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={4 / scale} // Thicker border to make it easier to click
        lineJoin="round"
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container && !isOuter) container.style.cursor = 'move';
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container && !isOuter) container.style.cursor = 'grab';
        }}
      />

      {/* Draggable Vertex Points */}
      {points.map((point, index) => (
        <Circle
          key={`vertex-${index}`}
          x={point.x}
          y={point.y}
          radius={hoveredPoint === index ? 8 / scale : 6 / scale}
          fill="#ffffff"
          stroke={strokeColor}
          strokeWidth={2 / scale}
          draggable={!readOnly}
          onDragMove={(e) => handleDragMove(index, e)}
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
      {midpoints.map((mp, index) => (
        <Circle
          key={`midpoint-${index}`}
          x={mp.x}
          y={mp.y}
          radius={5 / scale}
          fill={strokeColor}
          opacity={0.4}
          onClick={() => {
            const newPoints = [...points];
            newPoints.splice(mp.insertIdx, 0, { x: snapToGrid(mp.x, scale), y: snapToGrid(mp.y, scale) });
            onChange(newPoints);
          }}
          onTap={() => {
            const newPoints = [...points];
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
      {points.map((p1, i) => {
        const p2 = points[(i + 1) % points.length];
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
