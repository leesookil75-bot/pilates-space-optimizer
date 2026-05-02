import { RoomData } from '@/app/page';
import { EquipmentData, EquipmentType, EQUIPMENT_DIMS } from '@/components/Editor/Equipment';
import { v4 as uuidv4 } from 'uuid';

export interface AILayoutParams {
  mode: 'pyeong' | 'dimensions' | 'manual';
  pyeong: number;
  widthM: number;
  heightM: number;
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
  clearanceX: number;
  clearanceY: number;
  layoutShape: 'auto' | 'parallel' | 'l-shape' | 'n-shape' | 'u-shape';
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

export function generateAILayout(params: AILayoutParams): { rooms: RoomData[], equipments: EquipmentData[], isOverflowing?: boolean, error?: string } {
  const rooms: RoomData[] = [];
  const equipments: EquipmentData[] = [];
  const blocks: Block[] = [];
  const CLR_X = params.clearanceX ?? 40;
  const CLR_Y = params.clearanceY ?? 40;

  // 0. Determine target outer dimensions to guide room shapes
  let targetOuterW = 0;
  let targetOuterH = 0;
  if (params.mode === 'dimensions') {
    targetOuterW = params.widthM * 50;
    targetOuterH = params.heightM * 50;
  } else {
    const totalPx = (params.pyeong * 3.3057) * 2500;
    // Assume a pleasant 1.5 : 1 (W:H) aspect ratio for auto-generation
    targetOuterH = Math.sqrt(totalPx / 1.5);
    targetOuterW = targetOuterH * 1.5;
  }

  // Determine if a 1-row layout is necessary or better
  const isSingleRow = targetOuterH < 400 || targetOuterW > targetOuterH * 2.5;

  // To guarantee an 80px corridor, allocate the remaining height
  const maxRoomH = isSingleRow 
    ? Math.max(160, targetOuterH - 80) 
    : Math.max(160, (targetOuterH - 80) / 2);

  // 1. Gather all required rooms (Blocks)
  if (params.groupRooms.reformer && params.groupCount > 0) {
    const eqW = EQUIPMENT_DIMS.Reformer.width; 
    const eqH = EQUIPMENT_DIMS.Reformer.height; 
    const cellW = eqW + CLR_X;
    const cellH = eqH + CLR_Y;
    
    // 동적 행/열 계산: 룸 높이가 maxRoomH를 넘지 않도록 제한
    const maxAllowedRows = Math.max(1, Math.floor(maxRoomH / cellH));
    const rows = Math.min(params.groupCount, maxAllowedRows);
    const cols = Math.ceil(params.groupCount / rows);

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
    const eqW = EQUIPMENT_DIMS.Chair.width; 
    const eqH = EQUIPMENT_DIMS.Chair.height; 
    const cellW = eqW + CLR_X;
    const cellH = eqH + CLR_Y;
    
    const maxAllowedRows = Math.max(1, Math.floor(maxRoomH / cellH));
    const rows = Math.min(params.groupCount, maxAllowedRows);
    const cols = Math.ceil(params.groupCount / rows);

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
    const eqW = EQUIPMENT_DIMS.Barrel.width; 
    const eqH = EQUIPMENT_DIMS.Barrel.height; 
    const cellW = eqW + CLR_X;
    const cellH = eqH + CLR_Y;

    const maxAllowedRows = Math.max(1, Math.floor(maxRoomH / cellH));
    const rows = Math.min(params.groupCount, maxAllowedRows);
    const cols = Math.ceil(params.groupCount / rows);

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
      name: `1:1 개인룸 ${i+1}`, w: 250, h: 160, color: '#10b981',
      itemsFn: (rx, ry) => {
        // Optimal calculation based on equipment dimensions + clearance
        equipments.push(createEq('Cadillac', rx + 80, ry + 40, 0));
        equipments.push(createEq('Reformer', rx + 80, ry + 120, 0));
        equipments.push(createEq('Chair', rx + 200, ry + 40, 0));
        equipments.push(createEq('Barrel', rx + 200, ry + 120, 0));
      }
    });
  }

  if (params.auxiliary.consultation) {
    blocks.push({
      name: '상담실', w: 100, h: 100, color: '#f59e0b',
      itemsFn: () => {} // 가구 미배치 규칙 적용 (Rule 3)
    });
  }

  if (params.auxiliary.locker) {
    blocks.push({
      name: '탈의실 (남/여)', w: 120, h: 100, color: '#06b6d4',
      itemsFn: () => {} // 가구 미배치 규칙 적용 (Rule 3)
    });
  }

  if (params.auxiliary.lounge) {
    blocks.push({
      name: '휴게실', w: 120, h: 100, color: '#14b8a6',
      itemsFn: () => {} // 가구 미배치 규칙 적용 (Rule 3)
    });
  }

  let receptionBlock: Block | null = null;
  if (params.auxiliary.reception) {
    receptionBlock = {
      name: '로비/인포데스크', w: 150, h: 100, color: '#64748b',
      itemsFn: () => {} // 가구 미배치 규칙 적용 (Rule 3)
    };
  }

  // 2. Divide blocks
  let layoutShape = params.layoutShape || 'auto';
  if (layoutShape === 'auto') {
    layoutShape = 'parallel';
  }

  const leftBlocks: Block[] = [];
  const rightBlocks: Block[] = [];
  const topBlocks: Block[] = [];
  const bottomBlocks: Block[] = [];

  let leftHeight = 0;
  let rightHeight = 0;
  let topWidth = 0;
  let bottomWidth = 0;

  if (layoutShape === 'parallel') {
    if (isSingleRow) {
      topBlocks.push(...blocks);
      if (receptionBlock) topBlocks.push(receptionBlock);
      topWidth = topBlocks.reduce((sum, b) => sum + b.w, 0);
    } else {
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
    }
  } else if (layoutShape === 'l-shape') {
    for (const b of blocks) {
      if (topWidth <= rightHeight) {
        topBlocks.push(b);
        topWidth += b.w;
      } else {
        rightBlocks.push(b);
        rightHeight += b.h;
      }
    }
    if (receptionBlock) {
      topBlocks.push(receptionBlock);
    }
  } else if (layoutShape === 'n-shape') {
    for (const b of blocks) {
      if (leftHeight <= bottomWidth) {
        leftBlocks.push(b);
        leftHeight += b.h;
      } else {
        bottomBlocks.push(b);
        bottomWidth += b.w;
      }
    }
    if (receptionBlock) {
      bottomBlocks.push(receptionBlock);
    }
  } else if (layoutShape === 'u-shape') {
    for (const b of blocks) {
      if (topWidth <= bottomWidth && topWidth <= leftHeight) {
        topBlocks.push(b);
        topWidth += b.w;
      } else if (bottomWidth <= topWidth && bottomWidth <= leftHeight) {
        bottomBlocks.push(b);
        bottomWidth += b.w;
      } else {
        leftBlocks.push(b);
        leftHeight += b.h;
      }
    }
    if (receptionBlock) {
      topBlocks.push(receptionBlock);
    }
  }

  // 3. Calculate Outer Wall Dimensions
  let finalOuterW = 0;
  let finalOuterH = 0;

  if (params.mode === 'dimensions') {
    finalOuterW = params.widthM * 50;
    finalOuterH = params.heightM * 50;
  } else {
    finalOuterH = targetOuterH;
    finalOuterW = targetOuterW;
  }

  const startX = 100;
  const startY = 100;
  
  // Create outer wall
  rooms.push(createRoom('전체 외벽', 'outer', startX, startY, finalOuterW, finalOuterH, '#f8fafc'));

  const maxTopH = topBlocks.length > 0 ? Math.max(...topBlocks.map(b => b.h), 0) : 0;
  const maxBotH = bottomBlocks.length > 0 ? Math.max(...bottomBlocks.map(b => b.h), 0) : 0;
  const maxLeftW = leftBlocks.length > 0 ? Math.max(...leftBlocks.map(b => b.w), 0) : 0;
  const maxRightW = rightBlocks.length > 0 ? Math.max(...rightBlocks.map(b => b.w), 0) : 0;

  const outerMaxX = startX + finalOuterW;
  const outerMaxY = startY + finalOuterH;

  // 1m (50px) Overflow Validation
  let hasCorridorOverflow = false;
  if (layoutShape === 'parallel') {
    if (finalOuterH - maxTopH - maxBotH < 50) hasCorridorOverflow = true;
  } else if (layoutShape === 'l-shape') {
    if (finalOuterW - maxRightW < 50 || finalOuterH - maxTopH < 50) hasCorridorOverflow = true;
  } else if (layoutShape === 'n-shape') {
    if (finalOuterW - maxLeftW < 50 || finalOuterH - maxBotH < 50) hasCorridorOverflow = true;
  } else if (layoutShape === 'u-shape') {
    if (finalOuterW - maxLeftW < 50 || finalOuterH - maxTopH - maxBotH < 50) hasCorridorOverflow = true;
  }

  // Main Entrance Door 
  let mainDoorX = startX + finalOuterW / 2;
  let mainDoorY = outerMaxY - 20;
  if (layoutShape === 'l-shape') { mainDoorX = startX + 20; mainDoorY = outerMaxY - 20; }
  else if (layoutShape === 'n-shape') { mainDoorX = outerMaxX - 20; mainDoorY = startY + 20; }
  else if (layoutShape === 'u-shape') { mainDoorX = outerMaxX - 20; mainDoorY = startY + finalOuterH / 2; }
  
  equipments.push(createEq('Door', mainDoorX, mainDoorY, 0, undefined, 45, 45));

  // 4. Place Blocks
  
  // Top Blocks
  let currentX = startX;
  for (const b of topBlocks) {
    const rx = currentX;
    const ry = startY; 
    let roomW = b.w;
    if (layoutShape === 'l-shape') {
      roomW = outerMaxX - rx - maxRightW; // Leaves space for Right Blocks
    } else if (layoutShape === 'u-shape' || layoutShape === 'parallel') {
      roomW = outerMaxX - rx; // Stretch full width
    } else {
      roomW = Math.min(b.w, outerMaxX - rx);
    }
    roomW = Math.max(0, roomW);
    
    // Stretch height to leave 50px corridor
    let maxStretchH = maxTopH;
    if (layoutShape === 'parallel' || layoutShape === 'u-shape') {
      maxStretchH = Math.max(b.h, finalOuterH - maxBotH - 50); 
    } else if (layoutShape === 'l-shape') {
      maxStretchH = Math.max(b.h, finalOuterH - 50);
    }
    
    const roomH = Math.max(0, Math.min(maxStretchH, outerMaxY - ry));
    
    if (roomW > 0 && roomH > 0) {
      rooms.push(createRoom(b.name, 'inner', rx, ry, roomW, roomH, b.color));
    }
    const offsetY = (roomH - b.h) / 2;
    b.itemsFn(rx, ry + offsetY);
    if (roomW > 45 && roomH > 0) {
      equipments.push(createEq('Door', rx + roomW / 2, ry + roomH, 0, undefined, 45, 45));
    }
    currentX += b.w;
  }

  // Bottom Blocks
  currentX = startX;
  for (const b of bottomBlocks) {
    const rx = currentX;
    
    let maxStretchH = maxBotH;
    if (layoutShape === 'parallel' || layoutShape === 'u-shape') {
      maxStretchH = Math.max(b.h, finalOuterH - maxTopH - 50);
    } else if (layoutShape === 'n-shape') {
      maxStretchH = Math.max(b.h, finalOuterH - 50);
    }
    
    const roomH = Math.max(0, maxStretchH);
    const ry = outerMaxY - roomH;
    
    let roomW = b.w;
    if (layoutShape === 'u-shape' || layoutShape === 'n-shape' || layoutShape === 'parallel') {
      roomW = outerMaxX - rx - 50; // Leave 50px right corridor for n/u shape. Parallel can be full width.
      if (layoutShape === 'parallel') roomW = outerMaxX - rx;
    } else {
      roomW = Math.min(b.w, outerMaxX - rx);
    }
    roomW = Math.max(0, roomW);
    
    if (roomW > 0 && roomH > 0) {
      rooms.push(createRoom(b.name, 'inner', rx, ry, roomW, roomH, b.color));
    }
    const offsetY = (roomH - b.h) / 2;
    b.itemsFn(rx, ry + offsetY);
    if (roomW > 45 && roomH > 0) {
      if (layoutShape === 'n-shape' || layoutShape === 'u-shape') {
        equipments.push(createEq('Door', rx + roomW, ry + roomH / 2, -90, undefined, 45, 45));
      } else {
        equipments.push(createEq('Door', rx + roomW / 2, ry, 180, undefined, 45, 45));
      }
    }
    currentX += b.w;
  }

  // Left Blocks
  let currentY = startY + (layoutShape === 'u-shape' ? maxTopH : 0);
  for (const b of leftBlocks) {
    const rx = startX;
    const ry = currentY;
    
    let maxStretchW = maxLeftW;
    if (layoutShape === 'u-shape' || layoutShape === 'n-shape') {
      maxStretchW = Math.max(b.w, finalOuterW - 50);
    }
    
    const roomW = Math.max(0, Math.min(maxStretchW, outerMaxX - rx));
    const roomH = Math.max(0, Math.min(b.h, outerMaxY - ry - (layoutShape === 'n-shape' ? maxBotH : maxBotH)));
    // u-shape and n-shape both have maxBotH at bottom.
    
    if (roomW > 0 && roomH > 0) {
      rooms.push(createRoom(b.name, 'inner', rx, ry, roomW, roomH, b.color));
    }
    const offsetX = (roomW - b.w) / 2;
    b.itemsFn(rx + offsetX, ry);
    if (roomW > 0 && roomH > 45) {
      equipments.push(createEq('Door', rx + roomW, ry + roomH / 2, -90, undefined, 45, 45));
    }
    currentY += b.h;
  }

  // Right Blocks
  currentY = startY; // L-shape starts at top-right
  for (const b of rightBlocks) {
    let maxStretchW = maxRightW; // L-shape does not stretch left!
    
    const roomW = Math.max(0, maxStretchW);
    const rx = outerMaxX - roomW;
    const ry = currentY;
    
    let maxStretchH = b.h;
    if (layoutShape === 'l-shape') {
      maxStretchH = Math.max(b.h, finalOuterH - 50);
    }
    const roomH = Math.max(0, Math.min(maxStretchH, outerMaxY - ry));
    
    if (roomW > 0 && roomH > 0) {
      rooms.push(createRoom(b.name, 'inner', rx, ry, roomW, roomH, b.color));
    }
    const offsetX = (roomW - b.w) / 2;
    b.itemsFn(rx + offsetX, ry);
    if (roomW > 0 && roomH > 45) {
      if (layoutShape === 'l-shape') {
        equipments.push(createEq('Door', rx + roomW / 2, ry + roomH, 0, undefined, 45, 45));
      } else {
        equipments.push(createEq('Door', rx, ry + roomH / 2, 90, undefined, 45, 45));
      }
    }
    currentY += b.h;
  }

  // 6. Filter overflow equipments and arrange them outside
  const finalEquipments: EquipmentData[] = [];
  const overflowEquipments: EquipmentData[] = [];
  
  for (const eq of equipments) {
    if (eq.type === 'Door') {
      if (eq.x < startX || eq.x > outerMaxX || eq.y < startY || eq.y > outerMaxY) continue; 
      finalEquipments.push(eq);
      continue;
    }
    
    const ew = eq.width || EQUIPMENT_DIMS[eq.type].width;
    const eh = eq.height || EQUIPMENT_DIMS[eq.type].height;
    
    if (eq.x - ew/2 < startX - 10 || eq.x + ew/2 > outerMaxX + 10 || 
        eq.y - eh/2 < startY - 10 || eq.y + eh/2 > outerMaxY + 10 || hasCorridorOverflow) {
      overflowEquipments.push(eq);
    } else {
      finalEquipments.push(eq);
    }
  }

  // 7. Check if anything actually overflowed
  const isOverflowing = overflowEquipments.length > 0;
  
  if (isOverflowing) {
    // Update the outer room's styling to indicate overflow
    const outerRoom = rooms.find(r => r.type === 'outer');
    if (outerRoom) {
      outerRoom.name = '제한 면적 (초과됨)';
      outerRoom.colorTheme = '#fee2e2';
    }

    // Arrange overflow equipments neatly
    let ox = outerMaxX + 150; // 치수선과 안 겹치게 여유공간 150px
    let oy = startY;
    let rowMaxH = 0;
    
    for (const eq of overflowEquipments) {
      const ew = eq.width || EQUIPMENT_DIMS[eq.type].width;
      const eh = eq.height || EQUIPMENT_DIMS[eq.type].height;
      
      eq.x = ox + ew/2;
      eq.y = oy + eh/2;
      eq.rotation = 0; // 보기 좋게 회전 초기화
      
      finalEquipments.push(eq);
      
      ox += ew + 40; // 40px 간격
      rowMaxH = Math.max(rowMaxH, eh);
      
      // 가로 800px 넘어가면 줄바꿈
      if (ox > outerMaxX + 150 + 800) {
        ox = outerMaxX + 150;
        oy += rowMaxH + 40;
        rowMaxH = 0;
      }
    }
  }

  return { rooms, equipments: finalEquipments, isOverflowing };
}
