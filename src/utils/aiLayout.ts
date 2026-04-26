import { RoomData } from '@/app/page';
import { EquipmentData, EquipmentType } from '@/components/Editor/Equipment';

export interface AiLayoutParams {
  widthM: number;
  heightM: number;
  doorPosition: 'top' | 'bottom' | 'left' | 'right';
  privateRooms: number;
  groupRooms: number;
  reformers: number;
  cadillacs: number;
  chairs: number;
  barrels: number;
}

export function generateAiLayout(params: AiLayoutParams): { rooms: RoomData[], equipments: EquipmentData[] } {
  const { widthM, heightM, doorPosition, privateRooms, groupRooms, reformers, cadillacs, chairs, barrels } = params;
  
  const rooms: RoomData[] = [];
  const equipments: EquipmentData[] = [];
  
  // 1m = 50px
  const scale = 50;
  const wPx = widthM * scale;
  const hPx = heightM * scale;
  
  // Base offset to center the drawing roughly at (100, 100)
  const offsetX = 100;
  const offsetY = 100;

  // 1. Outer Wall
  rooms.push({
    id: `outer-${Date.now()}`,
    name: '전체 상가',
    type: 'outer',
    points: [
      { x: offsetX, y: offsetY },
      { x: offsetX + wPx, y: offsetY },
      { x: offsetX + wPx, y: offsetY + hPx },
      { x: offsetX, y: offsetY + hPx },
    ],
    colorTheme: '#3b82f6' // Blue
  });

  // 2. Door Placement
  let doorX = offsetX;
  let doorY = offsetY;
  let doorRot = 0;
  
  if (doorPosition === 'top') {
    doorX = offsetX + wPx / 2 - 25; // 50px width door centered
    doorY = offsetY;
    doorRot = 0;
  } else if (doorPosition === 'bottom') {
    doorX = offsetX + wPx / 2 + 25;
    doorY = offsetY + hPx;
    doorRot = 180;
  } else if (doorPosition === 'left') {
    doorX = offsetX;
    doorY = offsetY + hPx / 2 + 25;
    doorRot = -90;
  } else if (doorPosition === 'right') {
    doorX = offsetX + wPx;
    doorY = offsetY + hPx / 2 - 25;
    doorRot = 90;
  }

  equipments.push({
    id: `door-${Date.now()}`,
    type: 'Door',
    x: doorX,
    y: doorY,
    rotation: doorRot,
    clearance: 0
  });

  // 3. Room Division Heuristic
  // We reserve a 1.5m hallway from the door.
  const hallwayPx = 1.5 * scale;
  const totalRooms = privateRooms + groupRooms;
  
  // Very simplistic zoning:
  // Divide the remaining area into a grid or slices.
  // For simplicity, we just slice horizontally or vertically based on aspect ratio and door.
  
  const availableZone = { x: offsetX, y: offsetY, w: wPx, h: hPx };
  
  // Shrink available zone by hallway from the door side
  if (doorPosition === 'top') {
    availableZone.y += hallwayPx;
    availableZone.h -= hallwayPx;
  } else if (doorPosition === 'bottom') {
    availableZone.h -= hallwayPx;
  } else if (doorPosition === 'left') {
    availableZone.x += hallwayPx;
    availableZone.w -= hallwayPx;
  } else if (doorPosition === 'right') {
    availableZone.w -= hallwayPx;
  }

  // Slice availableZone for each room
  // Let's assume we slice along the longer edge
  let currentZones = [availableZone];
  
  // Slice into 'totalRooms' pieces
  if (totalRooms > 0) {
    const sliceWidth = availableZone.w / totalRooms;
    for (let i = 0; i < totalRooms; i++) {
      const zX = availableZone.x + (sliceWidth * i);
      const zY = availableZone.y;
      const zW = sliceWidth;
      const zH = availableZone.h;
      
      // Add inner room, leaving 10px padding from walls/hallway
      const pad = 10;
      rooms.push({
        id: `room-${Date.now()}-${i}`,
        name: i < privateRooms ? `개인실 ${i + 1}` : `그룹실 ${i - privateRooms + 1}`,
        type: 'inner',
        points: [
          { x: zX + pad, y: zY + pad },
          { x: zX + zW - pad, y: zY + pad },
          { x: zX + zW - pad, y: zY + zH - pad },
          { x: zX + pad, y: zY + zH - pad },
        ],
        colorTheme: '#f97316' // Orange
      });
    }
  }

  // 4. Equipment Packing
  let remainingReformers = reformers;
  let remainingCadillacs = cadillacs;
  let remainingChairs = chairs;
  let remainingBarrels = barrels;

  const getEqId = () => `eq-${Math.random().toString(36).substr(2, 9)}`;

  // Find Group Rooms (from the back)
  const groupRoomZones = rooms.filter(r => r.name.includes('그룹'));
  const privateRoomZones = rooms.filter(r => r.name.includes('개인'));

  // Put equipments in Private Rooms first
  privateRoomZones.forEach(room => {
    const p0 = room.points[0];
    const p2 = room.points[2];
    let cX = p0.x + 80;
    let cY = p0.y + 50;
    
    const placeInPrivate = (type: EquipmentType, count: number, spacing: number) => {
      let remaining = count;
      let placed = 0;
      while (remaining > 0) {
        if (cY > p2.y - 40) {
          cY = p0.y + 50;
          cX += 100; // Next column
        }
        if (cX > p2.x - 40) {
          break; // Room is full!
        }
        equipments.push({ id: getEqId(), type, x: cX, y: cY, rotation: 0 });
        remaining--;
        placed++;
        cY += spacing;
      }
      return placed;
    };

    if (remainingCadillacs > 0) remainingCadillacs -= placeInPrivate('Cadillac', 1, 80);
    if (remainingBarrels > 0) remainingBarrels -= placeInPrivate('Barrel', 1, 80);
    if (remainingChairs > 0) remainingChairs -= placeInPrivate('Chair', 1, 60);
  });

  // Put Reformers in Group Rooms
  groupRoomZones.forEach(room => {
    const p0 = room.points[0];
    const p2 = room.points[2];
    let cX = p0.x + 80;
    let cY = p0.y + 60;
    
    while (remainingReformers > 0) {
      if (cY > p2.y - 50) {
        cY = p0.y + 60;
        cX += 100; // Next column
      }
      if (cX > p2.x - 50) {
        break; // Room is full! Spill to the next group room or hallway
      }
      equipments.push({ id: getEqId(), type: 'Reformer', x: cX, y: cY, rotation: 0 });
      remainingReformers--;
      cY += 70; // 1.4m spacing
    }
  });

  // Dump anything left in the hallway (availableZone)
  let dumpX = availableZone.x + 50;
  let dumpY = availableZone.y + 50;
  
  const dumpEquipment = (type: EquipmentType, count: number) => {
    let remaining = count;
    while(remaining > 0) {
      if (dumpY > availableZone.y + availableZone.h - 50) {
        dumpY = availableZone.y + 50;
        dumpX += 100; // Next column
      }
      equipments.push({ id: getEqId(), type, x: dumpX, y: dumpY, rotation: 0 });
      remaining--;
      dumpY += 70;
    }
  };

  dumpEquipment('Reformer', remainingReformers);
  dumpEquipment('Cadillac', remainingCadillacs);
  dumpEquipment('Chair', remainingChairs);
  dumpEquipment('Barrel', remainingBarrels);

  return { rooms, equipments };
}
