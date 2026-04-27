import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text, Transformer, Arc } from 'react-konva';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';

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
}

interface EquipmentProps {
  data: EquipmentData;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: EquipmentData) => void;
  scale: number;
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

export default function Equipment({ data, isSelected, onSelect, onChange, scale }: EquipmentProps) {
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
        dragBoundFunc={function(this: any, pos) {
           if (data.isLocked) return this.getAbsolutePosition();
           
           const stage = this.getStage();
           if (!stage) return pos;
           const transform = stage.getAbsoluteTransform().copy();
           transform.invert();
           const relativePos = transform.point(pos);
           
           // Calculate visual width/height based on rotation to snap EDGES instead of center
           const rot = (data.rotation % 180 + 180) % 180;
           const isHorizontal = rot < 45 || rot > 135;
           const vw = isHorizontal ? dims.width : dims.height;
           const vh = isHorizontal ? dims.height : dims.width;

           const snappedRelative = {
              x: snapToGrid(relativePos.x - vw / 2, scale) + vw / 2,
              y: snapToGrid(relativePos.y - vh / 2, scale) + vh / 2
           };
           return stage.getAbsoluteTransform().point(snappedRelative);
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
              shadowColor="black"
              shadowBlur={isSelected ? 10 : 5}
              shadowOpacity={0.2}
              shadowOffsetY={2}
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
