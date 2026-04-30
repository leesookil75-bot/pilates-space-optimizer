'use client';
import React from 'react';
import { Shape } from 'react-konva';

interface GridProps {
  width: number;
  height: number;
  scale: number;
  stageX: number;
  stageY: number;
}

function Grid({ width, height, scale, stageX, stageY }: GridProps) {
  return (
    <Shape
      sceneFunc={(context, shape) => {
        const gridWidth = Math.ceil(width / scale);
        const gridHeight = Math.ceil(height / scale);

        const drawLines = (cellSize: number, color: string, lineWidth: number, dash: number[] = []) => {
          const sx = Math.floor((-stageX / scale) / cellSize) * cellSize;
          const sy = Math.floor((-stageY / scale) / cellSize) * cellSize;
          const numX = Math.ceil(gridWidth / cellSize) + 1;
          const numY = Math.ceil(gridHeight / cellSize) + 1;

          context.strokeStyle = color;
          context.lineWidth = lineWidth;
          if (context.setLineDash) context.setLineDash(dash);

          context.beginPath();
          // Vertical lines
          for (let i = 0; i < numX; i++) {
            const x = sx + i * cellSize;
            context.moveTo(x, sy);
            context.lineTo(x, sy + gridHeight + cellSize);
          }
          // Horizontal lines
          for (let i = 0; i < numY; i++) {
            const y = sy + i * cellSize;
            context.moveTo(sx, y);
            context.lineTo(sx + gridWidth + cellSize, y);
          }
          context.stroke();
        };

        // Draw 0.2m (10px) sub-grid if zoomed in a lot (scale >= 3)
        if (scale >= 3) {
          drawLines(10, '#f3f4f6', 1 / scale);
        }

        // Draw 0.5m (25px) sub-grid if zoomed in a bit (scale >= 1.5)
        if (scale >= 1.5) {
          drawLines(25, '#e5e7eb', 1.5 / scale, [4 / scale, 4 / scale]);
        }

        // Always draw 1m (50px) main grid (boldest)
        if (context.setLineDash) context.setLineDash([]); // Reset dash
        drawLines(50, '#d1d5db', 2 / scale);

        // Konva requires this at the end of custom drawing
        context.fillStrokeShape(shape);
      }}
      perfectDrawEnabled={false}
      listening={false}
    />
  );
}

export default React.memo(Grid);
