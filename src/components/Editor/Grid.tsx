'use client';
import { Line } from 'react-konva';

interface GridProps {
  width: number;
  height: number;
  scale: number;
  stageX: number;
  stageY: number;
}

export default function Grid({ width, height, scale, stageX, stageY }: GridProps) {
  const drawGrid = (cellSize: number, color: string, strokeWidth: number, dash: number[] = []) => {
    const startX = Math.floor((-stageX / scale) / cellSize) * cellSize;
    const startY = Math.floor((-stageY / scale) / cellSize) * cellSize;
    
    const gridWidth = Math.ceil(width / scale);
    const gridHeight = Math.ceil(height / scale);
    
    const numLinesX = Math.ceil(gridWidth / cellSize) + 1;
    const numLinesY = Math.ceil(gridHeight / cellSize) + 1;

    const gridLines = [];

    // Vertical lines
    for (let i = 0; i < numLinesX; i++) {
      const x = startX + i * cellSize;
      gridLines.push(
        <Line
          key={`v-${cellSize}-${x}`}
          points={[x, startY, x, startY + gridHeight + cellSize]}
          stroke={color}
          strokeWidth={strokeWidth}
          dash={dash}
        />
      );
    }

    // Horizontal lines
    for (let i = 0; i < numLinesY; i++) {
      const y = startY + i * cellSize;
      gridLines.push(
        <Line
          key={`h-${cellSize}-${y}`}
          points={[startX, y, startX + gridWidth + cellSize, y]}
          stroke={color}
          strokeWidth={strokeWidth}
          dash={dash}
        />
      );
    }

    return gridLines;
  };

  const lines = [];

  // Draw 0.2m (10px) sub-grid if zoomed in a lot (scale >= 3)
  if (scale >= 3) {
    lines.push(...drawGrid(10, '#f3f4f6', 1 / scale)); // faint solid line
  }

  // Draw 0.5m (25px) sub-grid if zoomed in a bit (scale >= 1.5)
  if (scale >= 1.5) {
    lines.push(...drawGrid(25, '#e5e7eb', 1.5 / scale, [4 / scale, 4 / scale])); // light dotted line
  }

  // Always draw 1m (50px) main grid (boldest)
  lines.push(...drawGrid(50, '#d1d5db', 2 / scale)); // solid gray

  return <>{lines}</>;
}
