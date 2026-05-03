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

        let finalDx = snapToGrid(relativePos.x, scale);
        let finalDy = snapToGrid(relativePos.y, scale);
        
        // Increased threshold slightly for a better magnetic "feel"
        const SNAP_THRESHOLD = 20 / scale;
        
        // 1. Extract all target X and Y coordinates (Infinite Guide Lines)
        const targetXs = new Set<number>();
        const targetYs = new Set<number>();
        
        for (const otherRoom of allRooms) {
          if (otherRoom.id === room.id) continue;
          for (const p of otherRoom.points) {
            targetXs.add(p.x);
            targetYs.add(p.y);
          }
        }
        
        // 2. Extract my room's X and Y coordinates (My Guide Lines)
        const myXs = new Set<number>();
        const myYs = new Set<number>();
        for (const p of localPoints) {
          myXs.add(p.x);
          myYs.add(p.y);
        }

        // 3. Find the best X snap (Vertical lines alignment)
        let bestDx = finalDx;
        let bestDistX = Infinity;
        let snappedX = false;
        
        for (const mx of Array.from(myXs)) {
          const currentX = mx + relativePos.x;
          for (const tx of Array.from(targetXs)) {
            const dist = Math.abs(currentX - tx);
            if (dist < SNAP_THRESHOLD && dist < bestDistX) {
              bestDistX = dist;
              bestDx = tx - mx;
              snappedX = true;
            }
          }
        }
        if (snappedX) finalDx = bestDx;

        // 4. Find the best Y snap (Horizontal lines alignment)
        let bestDy = finalDy;
        let bestDistY = Infinity;
        let snappedY = false;

        for (const my of Array.from(myYs)) {
          const currentY = my + relativePos.y;
          for (const ty of Array.from(targetYs)) {
            const dist = Math.abs(currentY - ty);
            if (dist < SNAP_THRESHOLD && dist < bestDistY) {
              bestDistY = dist;
              bestDy = ty - my;
              snappedY = true;
            }
          }
        }
        if (snappedY) finalDy = bestDy;

        return stage.getAbsoluteTransform().point({ x: finalDx, y: finalDy });
      }}
    >
      {/* The main polygon shape */}
      {(() => {
        const showHighlight = isSelected && !isOuter && !room.isLocked;
        return (
          <Line
            points={flatPoints}
            closed
            fill={showHighlight ? `${colorTheme}4D` : fillColor} // 30% opacity when selected
            stroke={strokeColor} // Keep the original color
            strokeWidth={(showHighlight ? 6 : 4) / scale} // Just slightly thicker
            shadowColor={showHighlight ? colorTheme : undefined}
            shadowBlur={showHighlight ? 15 : 0}
            shadowOpacity={0.6}
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
      {(() => {
        let cx = 0, cy = 0;
        localPoints.forEach(p => { cx += p.x; cy += p.y; });
        if (localPoints.length > 0) {
          cx /= localPoints.length;
          cy /= localPoints.length;
        }

        // --- TIER 1 & 2: OUTER ROOM SEGMENTED DIMENSIONS ---
        if (isOuter) {
          const dimensionGroups: any[] = [];
          
          localPoints.forEach((p1, i) => {
            const p2 = localPoints[(i + 1) % localPoints.length];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const L = Math.hypot(dx, dy);
            if (L < 10) return;
            
            const distanceCm = Math.round(L * 2);
            const ux = dx / L;
            const uy = dy / L;
            let nx = uy;
            let ny = -ux;
            
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const vx = mx - cx;
            const vy = my - cy;
            if (nx * vx + ny * vy < 0) {
              nx = -nx;
              ny = -ny;
            }
            
            let angle = Math.atan2(dy, dx) * (180 / Math.PI);
            angle = (angle % 180 + 180) % 180;
            
            // Tier 2: Overall Dimension (Offset 65)
            // Deduplicate Tier 2: Only show Top and Right (or equivalent based on outward score)
            let isTier2Valid = true;
            for (let j = 0; j < i; j++) {
              const op1 = localPoints[j];
              const op2 = localPoints[(j + 1) % localPoints.length];
              const odx = op2.x - op1.x;
              const ody = op2.y - op1.y;
              const oL = Math.hypot(odx, ody);
              if (Math.abs(L - oL) < 1) {
                let oAngle = Math.atan2(ody, odx) * (180 / Math.PI);
                oAngle = (oAngle % 180 + 180) % 180;
                if (Math.abs(angle - oAngle) < 1) {
                  // For the outer room, centroid is the same, so outward scores are symmetric.
                  isTier2Valid = false;
                  break;
                }
              }
            }
            
            if (isTier2Valid) {
              const offset2 = 65 / scale;
              const dimStartX = p1.x + nx * offset2;
              const dimStartY = p1.y + ny * offset2;
              const dimEndX = p2.x + nx * offset2;
              const dimEndY = p2.y + ny * offset2;
              
              dimensionGroups.push(
                <Group key={`dim-outer-t2-${i}`} listening={false}>
                  <Line points={[p1.x + nx * (45/scale), p1.y + ny * (45/scale), p1.x + nx * (offset2 + 10/scale), p1.y + ny * (offset2 + 10/scale)]} stroke="#9ca3af" strokeWidth={1/scale} />
                  <Line points={[p2.x + nx * (45/scale), p2.y + ny * (45/scale), p2.x + nx * (offset2 + 10/scale), p2.y + ny * (offset2 + 10/scale)]} stroke="#9ca3af" strokeWidth={1/scale} />
                  <Arrow points={[dimStartX, dimStartY, dimEndX, dimEndY]} stroke="#6b7280" strokeWidth={2/scale} fill="#6b7280" pointerAtBeginning={true} pointerLength={8/scale} pointerWidth={8/scale} />
                  <Text x={(dimStartX+dimEndX)/2} y={(dimStartY+dimEndY)/2} width={200/scale} offsetX={100/scale} offsetY={7/scale} text={`전체 | ${distanceCm.toLocaleString()} cm`} fontSize={14/scale} fontStyle="bold" fill="#1f2937" stroke="white" strokeWidth={8/scale} fillAfterStrokeEnabled={true} align="center" rotation={angle} />
                </Group>
              );
            }
            
            // Tier 1: Segmented Dimensions (Offset 35)
            // Collect projection points from all inner rooms
            const tValues = [0, 1]; // p1 is 0, p2 is 1
            for (const other of allRooms) {
              if (other.type === 'outer') continue;
              for (const q of other.points) {
                // Perpendicular distance from q to line p1-p2
                const cross = (q.y - p1.y) * dx - (q.x - p1.x) * dy;
                const distance = Math.abs(cross) / L;
                if (distance < 5) { // Slack for snapping tolerance (5 pixels)
                  const dot = (q.x - p1.x) * dx + (q.y - p1.y) * dy;
                  const t = dot / (L * L);
                  if (t > 0.005 && t < 0.995) {
                    tValues.push(t);
                  }
                }
              }
            }
            
            tValues.sort((a, b) => a - b);
            // Remove duplicates
            const uniqueT: number[] = [];
            for (let k = 0; k < tValues.length; k++) {
              if (k === 0 || (tValues[k] - uniqueT[uniqueT.length - 1]) * L > 5) {
                uniqueT.push(tValues[k]);
              }
            }
            
            // Draw sub-segments
            const offset1 = 35 / scale;
            for (let k = 0; k < uniqueT.length - 1; k++) {
              const tStart = uniqueT[k];
              const tEnd = uniqueT[k+1];
              const subL = (tEnd - tStart) * L;
              if (subL < 5) continue; // Too small
              
              const subCm = Math.round(subL * 2);
              const sp1x = p1.x + tStart * dx;
              const sp1y = p1.y + tStart * dy;
              const sp2x = p1.x + tEnd * dx;
              const sp2y = p1.y + tEnd * dy;
              
              const dimStartX = sp1x + nx * offset1;
              const dimStartY = sp1y + ny * offset1;
              const dimEndX = sp2x + nx * offset1;
              const dimEndY = sp2y + ny * offset1;
              
              dimensionGroups.push(
                <Group key={`dim-outer-t1-${i}-${k}`} listening={false}>
                  <Line points={[sp1x + nx * (10/scale), sp1y + ny * (10/scale), sp1x + nx * (offset1 + 10/scale), sp1y + ny * (offset1 + 10/scale)]} stroke="#9ca3af" strokeWidth={1/scale} />
                  <Line points={[sp2x + nx * (10/scale), sp2y + ny * (10/scale), sp2x + nx * (offset1 + 10/scale), sp2y + ny * (offset1 + 10/scale)]} stroke="#9ca3af" strokeWidth={1/scale} />
                  <Arrow points={[dimStartX, dimStartY, dimEndX, dimEndY]} stroke="#9ca3af" strokeWidth={1.5/scale} fill="#9ca3af" pointerAtBeginning={true} pointerLength={6/scale} pointerWidth={6/scale} />
                  <Text x={(dimStartX+dimEndX)/2} y={(dimStartY+dimEndY)/2} width={200/scale} offsetX={100/scale} offsetY={6/scale} text={`${subCm.toLocaleString()} cm`} fontSize={12/scale} fontStyle="bold" fill="#374151" stroke="white" strokeWidth={8/scale} fillAfterStrokeEnabled={true} align="center" rotation={angle} />
                </Group>
              );
            }
          });
          
          return dimensionGroups;
        }

        // --- INNER ROOM DIMENSIONS ---
        return localPoints.map((p1, i) => {
          const p2 = localPoints[(i + 1) % localPoints.length];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const L = Math.hypot(dx, dy);
          
          if (L < 10) return null;

          const distanceCm = Math.round(L * 2);
          const ux = dx / L;
          const uy = dy / L;
          let nx = uy;
          let ny = -ux;

          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          const vx = mx - cx;
          const vy = my - cy;
          if (nx * vx + ny * vy < 0) {
            nx = -nx;
            ny = -ny;
          }

          const offsetDist = 35 / scale;
          const overshoot = 10 / scale;

          const dimStartX = p1.x + nx * offsetDist;
          const dimStartY = p1.y + ny * offsetDist;
          const dimEndX = p2.x + nx * offsetDist;
          const dimEndY = p2.y + ny * offsetDist;

          const dimMidX = (dimStartX + dimEndX) / 2;
          const dimMidY = (dimStartY + dimEndY) / 2;

          let angle = Math.atan2(dy, dx) * (180 / Math.PI);
          angle = (angle % 180 + 180) % 180;

          let outerCx = cx, outerCy = cy;
          const outerRoom = allRooms.find(r => r.type === 'outer');
          if (outerRoom && outerRoom.points.length > 0) {
            outerCx = 0; outerCy = 0;
            outerRoom.points.forEach(p => { outerCx += p.x; outerCy += p.y; });
            outerCx /= outerRoom.points.length;
            outerCy /= outerRoom.points.length;
          }

          const outwardScore = nx * (mx - outerCx) + ny * (my - outerCy);
          const EPSILON = 1;
          let shouldDrawDimension = true;
          
          // Deduplication 1: Skip if there's a parallel dimension of the same length with a BETTER outward score
          for (let j = 0; j < localPoints.length; j++) {
            if (i === j) continue;
            const op1 = localPoints[j];
            const op2 = localPoints[(j + 1) % localPoints.length];
            const odx = op2.x - op1.x;
            const ody = op2.y - op1.y;
            const oL = Math.hypot(odx, ody);
            
            if (Math.abs(L - oL) < EPSILON) {
              let oAngle = Math.atan2(ody, odx) * (180 / Math.PI);
              oAngle = (oAngle % 180 + 180) % 180;
              
              if (Math.abs(angle - oAngle) < EPSILON) {
                const oux = odx / oL;
                const ouy = ody / oL;
                let onx = ouy;
                let ony = -oux;
                const omx = (op1.x + op2.x) / 2;
                const omy = (op1.y + op2.y) / 2;
                if (onx * (omx - cx) + ony * (omy - cy) < 0) {
                  onx = -onx;
                  ony = -ony;
                }
                const oOutwardScore = onx * (omx - outerCx) + ony * (omy - outerCy);
                
                if (oOutwardScore > outwardScore + EPSILON) {
                  shouldDrawDimension = false;
                  break;
                } else if (Math.abs(oOutwardScore - outwardScore) <= EPSILON && j < i) {
                  shouldDrawDimension = false;
                  break;
                }
              }
            }
          }

          // Deduplication 2: Check overlap with OTHER rooms
          if (shouldDrawDimension) {
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
                // If the inner room overlaps with OUTER room, hide it!
                // Because Outer Room Tier 1 segmented dimensions will draw it exactly.
                if (other.type === 'outer') {
                  shouldDrawDimension = false;
                  break;
                } else if (other.id < room.id) {
                  // Tie-breaker for overlapping inner rooms
                  shouldDrawDimension = false;
                  break;
                }
              }
            }
          }

          if (!shouldDrawDimension) return null;

          return (
            <Group key={`dim-${i}`} listening={false}>
              <Line points={[p1.x + nx * (10/scale), p1.y + ny * (10/scale), p1.x + nx * (offsetDist + overshoot), p1.y + ny * (offsetDist + overshoot)]} stroke="#9ca3af" strokeWidth={1/scale} />
              <Line points={[p2.x + nx * (10/scale), p2.y + ny * (10/scale), p2.x + nx * (offsetDist + overshoot), p2.y + ny * (offsetDist + overshoot)]} stroke="#9ca3af" strokeWidth={1/scale} />
              <Arrow points={[dimStartX, dimStartY, dimEndX, dimEndY]} stroke="#9ca3af" strokeWidth={1.5/scale} fill="#9ca3af" pointerAtBeginning={true} pointerLength={6/scale} pointerWidth={6/scale} />
              <Text x={dimMidX} y={dimMidY} width={200/scale} offsetX={100/scale} offsetY={6/scale} text={`${distanceCm.toLocaleString()} cm`} fontSize={12/scale} fontStyle="bold" fill="#374151" stroke="white" strokeWidth={8/scale} fillAfterStrokeEnabled={true} align="center" rotation={angle} />
            </Group>
          );
        });
      })()}
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
