import { RoomData, Point } from '@/app/page';
import { EquipmentData, EquipmentType, EQUIPMENT_DIMS } from '@/components/Editor/Equipment';
import { v4 as uuidv4 } from 'uuid';

export interface AILayoutParams {
  pyeong: number;
  groupCount: number;
  groupRooms: {
    reformer: boolean;
    chair: boolean;
    barrel: boolean;
  };
  privateRoomsCount: number;
  auxiliary: {
    reception: boolean;
    consultation: boolean;
    locker: boolean;
    lounge: boolean;
  };
}

// Helper to generate a room
const createRoom = (name: string, type: 'outer' | 'inner', x: number, y: number, w: number, h: number, colorTheme: string): RoomData => ({
  id: `room-${uuidv4().slice(0, 8)}`,
  name,
  type,
  points: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  colorTheme
});

const createEq = (type: EquipmentType, x: number, y: number, rotation: number, customLabel?: string, width?: number, height?: number): EquipmentData => ({
  id: `eq-${uuidv4().slice(0, 8)}`,
  type,
  x,
  y,
  rotation,
  customLabel,
  width,
  height,
  isLocked: false
});

interface Block {
  name: string;
  w: number;
  h: number;
  color: string;
  itemsFn: (rx: number, ry: number) => void;
}

export function generateAILayout(params: AILayoutParams): { rooms: RoomData[], equipments: EquipmentData[], error?: string } {
  const rooms: RoomData[] = [];
  const equipments: EquipmentData[] = [];
  const blocks: Block[] = [];
  
  const CLR = 40; // Total clearance added to width/height (20px each side)

  // 1. Gather all required rooms (Blocks)
  if (params.groupRooms.reformer && params.groupCount > 0) {
    const cols = 2;
    const rows = Math.ceil(params.groupCount / cols);
    const eqW = EQUIPMENT_DIMS.Reformer.width; 
    const eqH = EQUIPMENT_DIMS.Reformer.height; 
    const cellW = eqW + CLR;
    const cellH = eqH + CLR;
    blocks.push({
      name: `${params.groupCount}:1 리포머룸`, w: cols * cellW, h: rows * cellH, color: '#ec4899',
      itemsFn: (rx, ry) => {
        let count = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (count >= params.groupCount) break;
            equipments.push(createEq('Reformer', rx + cellW / 2 + c * cellW, ry + cellH / 2 + r * cellH, 0));
            count++;
          }
        }
      }
    });
  }

  if (params.groupRooms.chair && params.groupCount > 0) {
    const cols = 2;
    const rows = Math.ceil(params.groupCount / cols);
    const eqW = EQUIPMENT_DIMS.Chair.width; 
    const eqH = EQUIPMENT_DIMS.Chair.height; 
    const cellW = eqW + CLR;
    const cellH = eqH + CLR;
    blocks.push({
      name: `${params.groupCount}:1 체어룸`, w: cols * cellW, h: rows * cellH, color: '#8b5cf6',
      itemsFn: (rx, ry) => {
        let count = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (count >= params.groupCount) break;
            equipments.push(createEq('Chair', rx + cellW / 2 + c * cellW, ry + cellH / 2 + r * cellH, 0));
            count++;
          }
        }
      }
    });
  }

  if (params.groupRooms.barrel && params.groupCount > 0) {
    const cols = 2;
    const rows = Math.ceil(params.groupCount / cols);
    const eqW = EQUIPMENT_DIMS.Barrel.width; 
    const eqH = EQUIPMENT_DIMS.Barrel.height; 
    const cellW = eqW + CLR;
    const cellH = eqH + CLR;
    blocks.push({
      name: `${params.groupCount}:1 바렐룸`, w: cols * cellW, h: rows * cellH, color: '#3b82f6',
      itemsFn: (rx, ry) => {
        let count = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (count >= params.groupCount) break;
            equipments.push(createEq('Barrel', rx + cellW / 2 + c * cellW, ry + cellH / 2 + r * cellH, 0));
            count++;
          }
        }
      }
    });
  }

  for (let i = 0; i < params.privateRoomsCount; i++) {
    blocks.push({
      name: `1:1 개인룸 ${i+1}`, w: 220, h: 200, color: '#10b981',
      itemsFn: (rx, ry) => {
        equipments.push(createEq('Cadillac', rx + 60, ry + 40, 0));
        equipments.push(createEq('Reformer', rx + 60, ry + 130, 0));
        equipments.push(createEq('Chair', rx + 160, ry + 40, 0));
        equipments.push(createEq('Barrel', rx + 160, ry + 110, 0));
      }
    });
  }

  if (params.auxiliary.consultation) {
    blocks.push({
      name: '상담실', w: 120, h: 120, color: '#f59e0b',
      itemsFn: (rx, ry) => equipments.push(createEq('Custom', rx + 60, ry + 60, 0, '상담테이블', 60, 60))
    });
  }

  if (params.auxiliary.locker) {
    blocks.push({
      name: '탈의실 (남/여)', w: 150, h: 180, color: '#06b6d4',
      itemsFn: (rx, ry) => {
        equipments.push(createEq('Custom', rx + 75, ry + 45, 0, '여자 락커', 110, 50));
        equipments.push(createEq('Custom', rx + 75, ry + 135, 0, '남자 락커', 110, 50));
      }
    });
  }

  if (params.auxiliary.lounge) {
    blocks.push({
      name: '휴게실', w: 150, h: 150, color: '#14b8a6',
      itemsFn: (rx, ry) => equipments.push(createEq('Custom', rx + 75, ry + 75, 0, '소파/테이블', 90, 90))
    });
  }

  let receptionBlock: Block | null = null;
  if (params.auxiliary.reception) {
    receptionBlock = {
      name: '로비/인포데스크', w: 180, h: 150, color: '#64748b',
      itemsFn: (rx, ry) => equipments.push(createEq('Custom', rx + 90, ry + 75, 0, '인포데스크', 100, 50))
    };
  }

  // 2. Divide blocks into Top Row and Bottom Row for Central Corridor
  let topWidth = 0;
  let bottomWidth = 0;
  const topBlocks: Block[] = [];
  const bottomBlocks: Block[] = [];
  
  // Try to balance the rows. Put reception at the end of bottom row if exists
  for (const b of blocks) {
    if (topWidth <= bottomWidth) {
      topBlocks.push(b);
      topWidth += b.w;
    } else {
      bottomBlocks.push(b);
      bottomWidth += b.w;
    }
  }

  if (receptionBlock) {
    bottomBlocks.push(receptionBlock);
    bottomWidth += receptionBlock.w;
  }

  // 3. Calculate Outer Wall Dimensions
  const totalPx = (params.pyeong * 3.3057) * 2500;
  const corridorWidth = 80; // 1.6m wide hallway
  
  const minOuterW = Math.max(topWidth, bottomWidth) + 40; // 40px padding for safety
  const maxTopH = Math.max(...topBlocks.map(b => b.h), 0);
  const maxBotH = Math.max(...bottomBlocks.map(b => b.h), 0);
  const minOuterH = maxTopH + maxBotH + corridorWidth;

  // If requested pyeong is too small, we just forcefully expand the outer wall to fit the layout.
  // Expand outer wall to match requested pyeong proportionally if it's larger
  const ratio = minOuterW / minOuterH;
  const finalOuterH = Math.max(minOuterH, Math.sqrt(totalPx / ratio));
  const finalOuterW = Math.max(minOuterW, finalOuterH * ratio);

  const startX = 100;
  const startY = 100;
  
  // Create outer wall
  rooms.push(createRoom('전체 외벽', 'outer', startX, startY, finalOuterW, finalOuterH, '#f8fafc'));

  // Explicitly draw the Corridor as a Room so the user clearly sees it
  rooms.push(createRoom('메인 복도', 'inner', startX, startY + maxTopH, finalOuterW, finalOuterH - maxTopH - maxBotH, '#e2e8f0'));

  // Main Entrance Door (right side, bottom corner)
  equipments.push(createEq('Door', startX + finalOuterW, startY + finalOuterH - 45, -90, undefined, 45, 45));

  // 4. Place Top Row
  let currentX = startX;
  for (const b of topBlocks) {
    const rx = currentX;
    const ry = startY;
    rooms.push(createRoom(b.name, 'inner', rx, ry, b.w, b.h, b.color));
    b.itemsFn(rx, ry);
    
    // Add Room Door facing the corridor (Bottom of this room)
    equipments.push(createEq('Door', rx + b.w / 2, ry + b.h, 0, undefined, 45, 45));
    
    currentX += b.w;
  }

  // 5. Place Bottom Row
  currentX = startX;
  for (const b of bottomBlocks) {
    const rx = currentX;
    const ry = startY + finalOuterH - b.h;
    rooms.push(createRoom(b.name, 'inner', rx, ry, b.w, b.h, b.color));
    b.itemsFn(rx, ry);
    
    // Add Room Door facing the corridor (Top of this room)
    equipments.push(createEq('Door', rx + b.w / 2, ry, 180, undefined, 45, 45));
    
    currentX += b.w;
  }

  return { rooms, equipments };
}
