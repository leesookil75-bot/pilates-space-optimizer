import { RoomData, Point } from '@/app/page';
import { EquipmentData, EquipmentType, EQUIPMENT_DIMS } from '@/components/Editor/Equipment';
import { v4 as uuidv4 } from 'uuid';

export interface AILayoutParams {
  pyeong: number;
  groupCount: number;
  groupRooms: {
    reformer: boolean;
    chairBarrel: boolean;
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

export function generateAILayout(params: AILayoutParams): { rooms: RoomData[], equipments: EquipmentData[], error?: string } {
  const rooms: RoomData[] = [];
  const equipments: EquipmentData[] = [];
  
  // 1. Calculate Total Outer Area
  // 1 pyeong = ~3.3057 sqm. 1m = 50px.
  const totalSqm = params.pyeong * 3.3057;
  // Assume a 4:3 aspect ratio for the main floor
  const heightM = Math.sqrt(totalSqm / (4/3));
  const widthM = heightM * (4/3);
  
  const outerWidthPx = Math.round(widthM * 50);
  const outerHeightPx = Math.round(heightM * 50);
  
  const startX = 100;
  const startY = 100;
  
  // Outer wall
  rooms.push(createRoom('전체 외벽', 'outer', startX, startY, outerWidthPx, outerHeightPx, '#3b82f6'));

  let requiredAreaPx = 0;
  
  // Packing logic: We will place rooms sequentially from top-left, wrapping to next row if needed.
  let currentX = startX + 50; // 1m padding from outer wall
  let currentY = startY + 50;
  let rowMaxHeight = 0;

  const placeBlock = (name: string, w: number, h: number, color: string, itemsFn: (rx: number, ry: number) => void) => {
    // Check if it fits in current row
    if (currentX + w > startX + outerWidthPx - 50) {
      // Move to next row
      currentX = startX + 50;
      currentY += rowMaxHeight + 50;
      rowMaxHeight = 0;
    }
    
    // Check if it fits vertically
    if (currentY + h > startY + outerHeightPx - 50) {
      return false; // Does not fit!
    }

    rooms.push(createRoom(name, 'inner', currentX, currentY, w, h, color));
    itemsFn(currentX, currentY);

    currentX += w + 50; // Advance X
    if (h > rowMaxHeight) rowMaxHeight = h;
    requiredAreaPx += (w * h);
    return true;
  };

  // 2. Generate Reformer Room
  if (params.groupRooms.reformer && params.groupCount > 0) {
    const cols = 2;
    const rows = Math.ceil(params.groupCount / cols);
    const refW = EQUIPMENT_DIMS.Reformer.width; // 120
    const refH = EQUIPMENT_DIMS.Reformer.height; // 35
    
    const w = cols * (refW + 60) + 40; // width of room
    const h = rows * (refH + 80) + 40; // height of room

    const fits = placeBlock(`${params.groupCount}:1 리포머룸`, w, h, '#ec4899', (rx, ry) => {
      let count = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (count >= params.groupCount) break;
          equipments.push(createEq('Reformer', rx + 50 + c * (refW + 60), ry + 50 + r * (refH + 80), 0));
          count++;
        }
      }
    });
    if (!fits) return { rooms, equipments, error: '면적이 부족하여 리포머룸을 배치할 수 없습니다.' };
  }

  // 3. Generate Chair/Barrel Room
  if (params.groupRooms.chairBarrel && params.groupCount > 0) {
    // Chairs on left, Barrels on right
    const itemH = 60; // vertical spacing
    const rows = params.groupCount;
    
    const w = 40 + 50 + 100; // chair + barrel + center
    const h = rows * itemH + 40;

    const fits = placeBlock(`${params.groupCount}:1 체어바렐룸`, w, h, '#8b5cf6', (rx, ry) => {
      for (let r = 0; r < rows; r++) {
        // Chair facing right
        equipments.push(createEq('Chair', rx + 30, ry + 30 + r * itemH, 0));
        // Barrel facing left
        equipments.push(createEq('Barrel', rx + w - 50, ry + 30 + r * itemH, 180));
      }
    });
    if (!fits) return { rooms, equipments, error: '면적이 부족하여 체어/바렐룸을 배치할 수 없습니다.' };
  }

  // 4. Generate Private Rooms
  for (let i = 0; i < params.privateRoomsCount; i++) {
    const w = 220; // ~4.4m
    const h = 200; // ~4.0m
    const fits = placeBlock(`1:1 개인룸 ${i+1}`, w, h, '#10b981', (rx, ry) => {
      equipments.push(createEq('Cadillac', rx + 30, ry + 30, 0));
      equipments.push(createEq('Reformer', rx + 30, ry + 120, 0));
      equipments.push(createEq('Chair', rx + 160, ry + 30, 0));
      equipments.push(createEq('Barrel', rx + 160, ry + 100, 0));
    });
    if (!fits) return { rooms, equipments, error: '면적이 부족하여 개인룸을 모두 배치할 수 없습니다.' };
  }

  // 5. Auxiliary Rooms
  if (params.auxiliary.consultation) {
    const fits = placeBlock('상담실', 120, 120, '#f59e0b', (rx, ry) => {
      equipments.push(createEq('Custom', rx + 30, ry + 30, 0, '상담테이블', 60, 60));
    });
    if (!fits) return { rooms, equipments, error: '면적이 부족하여 상담실을 배치할 수 없습니다.' };
  }

  if (params.auxiliary.locker) {
    const fits = placeBlock('탈의실 (남/여)', 150, 180, '#06b6d4', (rx, ry) => {
      equipments.push(createEq('Custom', rx + 20, ry + 20, 0, '여자 락커', 110, 50));
      equipments.push(createEq('Custom', rx + 20, ry + 100, 0, '남자 락커', 110, 50));
    });
    if (!fits) return { rooms, equipments, error: '면적이 부족하여 탈의실을 배치할 수 없습니다.' };
  }

  if (params.auxiliary.lounge) {
    const fits = placeBlock('휴게실', 150, 150, '#14b8a6', (rx, ry) => {
      equipments.push(createEq('Custom', rx + 30, ry + 30, 0, '소파/테이블', 90, 90));
    });
    if (!fits) return { rooms, equipments, error: '면적이 부족하여 휴게실을 배치할 수 없습니다.' };
  }

  if (params.auxiliary.reception) {
    // Put reception at some remaining space near the entrance
    const fits = placeBlock('로비 / 인포데스크', 180, 150, '#64748b', (rx, ry) => {
      equipments.push(createEq('Custom', rx + 40, ry + 40, 0, '인포데스크', 100, 50));
    });
    // If it doesn't fit as a room, just throw the desk somewhere
    if (!fits) {
      equipments.push(createEq('Custom', startX + outerWidthPx - 150, startY + outerHeightPx - 100, 0, '인포데스크', 100, 50));
    }
  }

  // Add the main door to the outer wall
  equipments.push(createEq('Door', startX + outerWidthPx - 60, startY + outerHeightPx - 45, 0));

  return { rooms, equipments };
}
