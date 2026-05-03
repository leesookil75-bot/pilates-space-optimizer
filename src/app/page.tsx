'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Editor, { EditorCanvasHandle, calculateRoomAreaInfo, isPointInPolygon } from '@/components/Editor/EditorCanvas';
import { EquipmentData, EquipmentType, EQUIPMENT_DIMS } from '@/components/Editor/Equipment';
import { useSession, signIn } from 'next-auth/react';
import styles from './page.module.css';

export type Point = { x: number; y: number };

export interface RoomData {
  id: string;
  name: string;
  type: 'outer' | 'inner';
  points: Point[];
  colorTheme: string; // hex color code
  isLocked?: boolean;
}

interface AppState {
  rooms: RoomData[];
  equipments: EquipmentData[];
}

export default function Home() {
  const { data: session, status } = useSession();
  const [showTutorial, setShowTutorial] = useState(true);

  const [rooms, setRooms] = useState<RoomData[]>([
    {
      id: 'outer-1',
      name: '전체 외벽',
      type: 'outer',
      points: [
        { x: 100, y: 100 },
        { x: 600, y: 100 },
        { x: 600, y: 600 },
        { x: 100, y: 600 },
      ],
      colorTheme: '#3b82f6' // Blue
    }
  ]);
  const [equipments, setEquipments] = useState<EquipmentData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movingRoomId, setMovingRoomId] = useState<string | null>(null);
  
  // Smart Clipboard State
  const [copiedEqId, setCopiedEqId] = useState<string | null>(null);
  const mousePosRef = useRef<Point | null>(null);

  // History state for Undo/Redo
  const [historyState, setHistoryState] = useState<{ list: AppState[], index: number }>({ list: [], index: -1 });
  const [isLoaded, setIsLoaded] = useState(false);

  const commitRef = useRef<NodeJS.Timeout | null>(null);
  const latestStateRef = useRef<{ rooms: RoomData[], equipments: EquipmentData[] }>({ rooms, equipments });
  
  // Sync ref with current state so the batched commit always uses the absolute latest
  latestStateRef.current = { rooms, equipments };

  // Quote Request Modal State
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    name: '',
    phone: '',
    email: '',
    region: '',
    expectedDate: '미정'
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const [copyQuantity, setCopyQuantity] = useState(1);
  const [copyDirection, setCopyDirection] = useState<'up' | 'down' | 'left' | 'right'>('right');

  // New Canvas Generator State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiParams, setAiParams] = useState<{
    mode: 'pyeong' | 'dimensions';
    pyeong: number | '';
    widthM: number | '';
    heightM: number | '';
  }>({
    mode: 'pyeong',
    pyeong: 30,
    widthM: 10,
    heightM: 10
  });

  const [showRoomModal, setShowRoomModal] = useState(false);
  const [newRoomParams, setNewRoomParams] = useState<{
    name: string;
    widthM: number | '';
    heightM: number | '';
    equipmentType: EquipmentType | 'None';
    quantity: number | '';
  }>({
    name: '새로운 룸',
    widthM: 4,
    heightM: 4,
    equipmentType: 'None',
    quantity: 1
  });

  const [showRoiModal, setShowRoiModal] = useState(false);
  const [roiParams, setRoiParams] = useState({
    privatePrice: 80000,
    privateSessionsPerDay: 5,
    privateEquipmentCount: 3,
    groupPrice: 20000,
    groupSessionsPerDay: 5,
    operatingDaysPerMonth: 20
  });

  const editorRef = useRef<EditorCanvasHandle>(null);

  // Load from LocalStorage on mount
  useEffect(() => {
    if (isLoaded) return;
    const savedStr = localStorage.getItem('pilates-floorplan-data');
    let initRooms = rooms;
    let initEquips = equipments;
    if (savedStr) {
      try {
        const parsed = JSON.parse(savedStr);
        if (parsed.rooms) initRooms = parsed.rooms;
        if (parsed.equipments) initEquips = parsed.equipments;
        setRooms(initRooms);
        setEquipments(initEquips);
      } catch (e) {
        console.error('Failed to parse saved floorplan', e);
      }
    }
    setHistoryState({ list: [{ rooms: initRooms, equipments: initEquips }], index: 0 });
    setIsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync session data to form if available
  useEffect(() => {
    if (session?.user && showQuoteModal) {
      setQuoteForm(prev => ({
        ...prev,
        name: prev.name || session.user?.name || '',
        email: prev.email || session.user?.email || '',
        // NextAuth Kakao provider doesn't give phone by default without specific scope/business app,
        // but we will autofill what we can.
      }));
    }
  }, [session, showQuoteModal]);

  // Auto-save to LocalStorage on changes
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('pilates-floorplan-data', JSON.stringify({ rooms, equipments }));
  }, [rooms, equipments, isLoaded]);

  const scheduleHistoryCommit = useCallback((partial: Partial<AppState>) => {
    // Merge the partial state into our mutable latest state tracking
    const nextState = { ...latestStateRef.current, ...partial };
    latestStateRef.current = nextState;

    if (commitRef.current) clearTimeout(commitRef.current);
    commitRef.current = setTimeout(() => {
      setHistoryState((prev) => {
        // If we are making a change while in the middle of history, discard the future
        const newList = prev.list.slice(0, prev.index + 1);
        newList.push(nextState);
        return { list: newList, index: newList.length - 1 };
      });
    }, 100);
  }, []);

  const undo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index > 0) {
        const prevState = prev.list[prev.index - 1];
        setRooms(prevState.rooms);
        setEquipments(prevState.equipments);
        return { ...prev, index: prev.index - 1 };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.index < prev.list.length - 1) {
        const nextState = prev.list[prev.index + 1];
        setRooms(nextState.rooms);
        setEquipments(nextState.equipments);
        return { ...prev, index: prev.index + 1 };
      }
      return prev;
    });
  }, []);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Wrappers to update state and history
  const updateRooms = (newRooms: RoomData[]) => {
    setRooms(newRooms);
    scheduleHistoryCommit({ rooms: newRooms });
  };

  const handleGenerateAI = () => {
    let manualOuterW = 0;
    let manualOuterH = 0;

    if (aiParams.mode === 'pyeong') {
      const pyeongVal = Number(aiParams.pyeong) || 30;
      const totalAreaM2 = pyeongVal * 3.3058;
      const sideM = Math.sqrt(totalAreaM2);
      manualOuterW = sideM * 50;
      manualOuterH = sideM * 50;
    } else {
      manualOuterW = (Number(aiParams.widthM) || 10) * 50;
      manualOuterH = (Number(aiParams.heightM) || 10) * 50;
    }

    const newRooms: RoomData[] = [
      {
        id: `outer-${Date.now()}`,
        name: '전체 외벽',
        type: 'outer',
        points: [
          { x: 100, y: 100 },
          { x: 100 + manualOuterW, y: 100 },
          { x: 100 + manualOuterW, y: 100 + manualOuterH },
          { x: 100, y: 100 + manualOuterH },
        ],
        colorTheme: '#3b82f6'
      }
    ];
    setRooms(newRooms);
    setEquipments([]);
    scheduleHistoryCommit({ rooms: newRooms, equipments: [] });
    setShowAIModal(false);
    alert('기본 캔버스가 준비되었습니다. 룸을 추가하거나 기구를 드래그하여 공간을 구성해 보세요!');
  };

  const updateEquipments = (newEquipments: EquipmentData[]) => {
    setEquipments(newEquipments);
    scheduleHistoryCommit({ equipments: newEquipments });
  };

  const handleAddRoomClick = () => {
    setNewRoomParams({
      name: `룸 ${rooms.length}`,
      widthM: 4,
      heightM: 4,
      equipmentType: 'None',
      quantity: 1
    });
    setShowRoomModal(true);
    setIsMobileMenuOpen(false);
  };

  const handleCreateSmartRoom = () => {
    const w = Number(newRoomParams.widthM) || 4;
    const h = Number(newRoomParams.heightM) || 4;
    const qty = Number(newRoomParams.quantity) || 0;
    const eqType = newRoomParams.equipmentType;

    if (eqType !== 'None' && qty > 0) {
      const eqDims = EQUIPMENT_DIMS[eqType as EquipmentType];
      const clearanceM = 0.8;
      const reqWidthM = (eqDims.width / 50) + clearanceM;
      const reqHeightM = (eqDims.height / 50) + clearanceM;
      const reqAreaPerEq = reqWidthM * reqHeightM;
      const totalReqArea = reqAreaPerEq * qty;
      const roomArea = w * h;

      if (roomArea < totalReqArea) {
        const proceed = window.confirm(`⚠️ 기구 수량(${qty}대)에 비해 방의 면적(${roomArea}㎡)이 다소 협소합니다.\n(권장 필요 면적: 약 ${Math.ceil(totalReqArea)}㎡)\n\n기구가 겹치거나 통로가 좁을 수 있습니다. 그래도 생성하시겠습니까?`);
        if (!proceed) return;
      }
    }

    let spawnX = 150;
    let spawnY = 150;
    const innerRooms = rooms.filter(r => r.type === 'inner');
    if (innerRooms.length > 0) {
      // Find the right-most point of all inner rooms to prevent overlapping
      const maxRight = Math.max(...innerRooms.flatMap(r => r.points.map(p => p.x)));
      spawnX = maxRight + 50; // 50px gap
    }

    const roomId = `inner-${Date.now()}`;
    const newRoom: RoomData = {
      id: roomId,
      name: newRoomParams.name || `룸 ${rooms.length}`,
      type: 'inner',
      points: [
        { x: spawnX, y: spawnY },
        { x: spawnX + w * 50, y: spawnY },
        { x: spawnX + w * 50, y: spawnY + h * 50 },
        { x: spawnX, y: spawnY + h * 50 },
      ],
      colorTheme: '#a855f7' // Purple
    };

    let newEquipmentsArr: EquipmentData[] = [];
    if (eqType !== 'None' && qty > 0) {
      const eqDims = EQUIPMENT_DIMS[eqType as EquipmentType];
      const clearance = 40; // Default clearance per side
      const reqW = eqDims.width + (clearance * 2);
      const reqH = eqDims.height + (clearance * 2);

      const cols = Math.ceil(Math.sqrt(qty));
      const rows = Math.ceil(qty / cols);
      
      const minX = spawnX;
      const minY = spawnY;
      // Start center position so the gray area touches the wall exactly
      const startX = minX + reqW / 2;
      const startY = minY + reqH / 2;
      
      const availableW = w * 50;
      const availableH = h * 50;
      
      const maxStepX = reqW;
      const maxStepY = reqH;
      
      const stepX = cols > 1 ? Math.min(maxStepX, (availableW - reqW) / (cols - 1)) : 0;
      const stepY = rows > 1 ? Math.min(maxStepY, (availableH - reqH) / (rows - 1)) : 0;

      for (let i = 0; i < qty; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        newEquipmentsArr.push({
          id: `eq-${Date.now()}-${i}`,
          type: eqType as EquipmentType,
          x: startX + (c * stepX),
          y: startY + (r * stepY),
          rotation: 0,
          isLocked: false,
          linkedRoomId: roomId
        });
      }
    }

    setRooms([...rooms, newRoom]);
    if (newEquipmentsArr.length > 0) {
      setEquipments([...equipments, ...newEquipmentsArr]);
    }
    scheduleHistoryCommit({ 
      rooms: [...rooms, newRoom], 
      equipments: [...equipments, ...newEquipmentsArr] 
    });
    
    setShowRoomModal(false);
  };

  const addEquipment = (type: EquipmentType) => {
    const newEq = {
      id: `eq-${Date.now()}`,
      type,
      x: 300 + Math.random() * 50,
      y: 300 + Math.random() * 50,
      rotation: 0,
    };
    updateEquipments([...equipments, newEq]);
    setIsMobileMenuOpen(false); // Close menu on mobile
  };

  const removeEquipment = (id: string) => {
    updateEquipments(equipments.filter(eq => eq.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selectedEquipment = equipments.find(eq => eq.id === selectedId);

  const handleEquipmentDimensionChange = (dimension: 'width' | 'height' | 'clearance', valueCm: number) => {
    if (!selectedId) return;
    const storeValue = dimension === 'clearance' ? valueCm : valueCm / 2;
    
    const newEquipments = equipments.map(eq => 
      eq.id === selectedId ? { ...eq, [dimension]: storeValue } : eq
    );
    updateEquipments(newEquipments);
  };

  const handleEquipmentLabelChange = (label: string) => {
    if (!selectedId) return;
    const newEquipments = equipments.map(eq => 
      eq.id === selectedId ? { ...eq, customLabel: label } : eq
    );
    updateEquipments(newEquipments);
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== 'authenticated') {
      alert('카카오 로그인이 필요합니다.');
      return;
    }

    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...quoteForm,
          rooms,
          equipments
        })
      });

      if (res.ok) {
        alert('성공적으로 견적 요청이 접수되었습니다!\n원장님이 그리신 도면을 바탕으로 제휴 인테리어 및 기구 업체가 최적의 견적서를 곧 발송해 드립니다.');
        setShowQuoteModal(false);
        setQuoteForm({ name: '', phone: '', email: '', region: '', expectedDate: '미정' });
      } else {
        alert('견적 요청 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    } catch (error) {
      console.error(error);
      alert('서버와 통신할 수 없습니다.');
    }
  };

  const toggleLockEquipment = (id: string) => {
    const newEquipments = equipments.map(eq => 
      eq.id === id ? { ...eq, isLocked: !eq.isLocked } : eq
    );
    updateEquipments(newEquipments);
  };

  const toggleLockRoom = (id: string) => {
    const targetRoom = rooms.find(r => r.id === id);
    const isCurrentlyLocked = targetRoom?.isLocked;
    
    const newRooms = rooms.map(room => 
      room.id === id ? { ...room, isLocked: !room.isLocked } : room
    );
    updateRooms(newRooms);
    
    if (isCurrentlyLocked) {
      setSelectedId(null);
    }
  };

  const removeRoom = (id: string) => {
    const newRooms = rooms.filter(room => room.id !== id);
    updateRooms(newRooms);
    if (selectedId === id) {
      setSelectedId(null);
      setMovingRoomId(null);
    }
  };

  const toggleMovingRoom = (id: string) => {
    setMovingRoomId(prev => prev === id ? null : id);
  };


  const selectedRoom = rooms.find(r => r.id === selectedId);

  const rotateEquipment = () => {
    if (!selectedId) return;
    const newEquipments = equipments.map(eq => 
      eq.id === selectedId ? { ...eq, rotation: (eq.rotation + 45) % 360 } : eq
    );
    updateEquipments(newEquipments);
  };

  const executeAutoCopy = () => {
    if (!selectedId || copyQuantity <= 0) return;
    
    const sourceEq = equipments.find(eq => eq.id === selectedId);
    if (!sourceEq) return;

    const dim = EQUIPMENT_DIMS[sourceEq.type] || EQUIPMENT_DIMS['Custom'];
    const w = sourceEq.width || dim.width;
    const h = sourceEq.height || dim.height;
    const clearance = sourceEq.clearance ?? 40;
    
    const clearancePx = clearance / 2;
    
    // 기구의 회전을 고려하여 시각적 너비와 높이를 구합니다.
    const rot = (sourceEq.rotation % 180 + 180) % 180;
    const isHorizontal = rot < 45 || rot > 135;
    const vw = isHorizontal ? w : h;
    const vh = isHorizontal ? h : w;

    // 회색 여유 공간 영역의 크기
    const offsetMagnitudeX = vw + clearancePx * 2;
    const offsetMagnitudeY = vh + clearancePx * 2;
    
    let offsetX = 0;
    let offsetY = 0;

    switch (copyDirection) {
      case 'up': offsetY = -offsetMagnitudeY; break;
      case 'down': offsetY = offsetMagnitudeY; break;
      case 'left': offsetX = -offsetMagnitudeX; break;
      case 'right': offsetX = offsetMagnitudeX; break;
    }

    const newCopies: EquipmentData[] = [];
    for (let i = 1; i <= copyQuantity; i++) {
      newCopies.push({
        ...sourceEq,
        id: `${sourceEq.type}-${Date.now()}-${i}`,
        x: sourceEq.x + (offsetX * i),
        y: sourceEq.y + (offsetY * i),
      });
    }

    updateEquipments([...equipments, ...newCopies]);
    setShowCopyPrompt(false);
    setCopyQuantity(1);
  };

  // --- ROI Data Calculations ---
  const outerRoom = rooms.find(r => r.type === 'outer');
  let totalArea = 0;
  let revenueArea = 0;
  
  if (outerRoom) {
    totalArea = calculateRoomAreaInfo(outerRoom.points).areaPyeong;
  }
  
  // Calculate revenue area from internal rooms that are not auxiliary/corridor
  rooms.forEach(r => {
    if (r.type === 'inner' && !['복도', '인포데스크', '상담실', '탈의실', '휴게실', '제한 면적'].some(nonRev => r.name.includes(nonRev))) {
      revenueArea += calculateRoomAreaInfo(r.points).areaPyeong;
    }
  });

  const revenueRatio = totalArea > 0 ? Math.min(100, Math.round((revenueArea / totalArea) * 100)) : 0;

  // Max Revenue Calculation
  // 1:1 개인 레슨 방 카운트
  const privateRoomCount = rooms.filter(r => r.name.includes('개인')).length;
  // 전체 배치된 그룹 기구 카운트 (커스텀/출입문/캐딜락 제외)
  const groupEqCount = equipments.filter(e => !['Custom', 'Door', 'Cadillac'].includes(e.type)).length;
  
  // 개인룸 하나당 소모되는 기구 수 (사용자 설정 가능, 기본 3대)
  const estimatedGroupCapacity = Math.max(0, groupEqCount - (privateRoomCount * roiParams.privateEquipmentCount));
  
  // 예상 월 최대 매출액 계산 (동적 파라미터 적용)
  const privateMonthlyRevenue = privateRoomCount * roiParams.privatePrice * roiParams.privateSessionsPerDay * roiParams.operatingDaysPerMonth;
  const groupMonthlyRevenue = estimatedGroupCapacity * roiParams.groupPrice * roiParams.groupSessionsPerDay * roiParams.operatingDaysPerMonth;
  const maxRevenueMonthly = privateMonthlyRevenue + groupMonthlyRevenue;

  // Keyboard shortcuts for Delete/Backspace and Copy/Paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent handling if the user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          const targetRoom = latestStateRef.current.rooms.find(r => r.id === selectedId);
          if (targetRoom && targetRoom.type !== 'outer' && !targetRoom.isLocked) {
            removeRoom(selectedId);
            return;
          }

          const targetEq = latestStateRef.current.equipments.find(eq => eq.id === selectedId);
          if (targetEq && !targetEq.isLocked) {
            const inLockedRoom = latestStateRef.current.rooms.some(r => r.isLocked && isPointInPolygon({ x: targetEq.x, y: targetEq.y }, r.points));
            if (!inLockedRoom) {
              removeEquipment(selectedId);
            }
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        // Copy
        if (selectedId) {
          const targetEq = latestStateRef.current.equipments.find(eq => eq.id === selectedId);
          if (targetEq) {
            setCopiedEqId(targetEq.id);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        // Paste
        if (copiedEqId) {
          const sourceEq = latestStateRef.current.equipments.find(eq => eq.id === copiedEqId);
          if (sourceEq) {
            const pointer = mousePosRef.current;
            let copyDirection: 'up' | 'down' | 'left' | 'right' = 'right';

            if (pointer) {
              const dx = pointer.x - sourceEq.x;
              const dy = pointer.y - sourceEq.y;
              // 판별 로직: X축 거리와 Y축 거리 비교
              if (Math.abs(dx) > Math.abs(dy)) {
                copyDirection = dx > 0 ? 'right' : 'left';
              } else {
                copyDirection = dy > 0 ? 'down' : 'up';
              }
            }

            const dim = EQUIPMENT_DIMS[sourceEq.type] || EQUIPMENT_DIMS['Custom'];
            const w = sourceEq.width || dim.width;
            const h = sourceEq.height || dim.height;
            const clearance = sourceEq.clearance ?? 40;
            const clearancePx = clearance / 2;
            
            const rot = (sourceEq.rotation % 180 + 180) % 180;
            const isHorizontal = rot < 45 || rot > 135;
            const vw = isHorizontal ? w : h;
            const vh = isHorizontal ? h : w;

            const offsetMagnitudeX = vw + clearancePx * 2;
            const offsetMagnitudeY = vh + clearancePx * 2;
            
            let offsetX = 0;
            let offsetY = 0;

            switch (copyDirection) {
              case 'up': offsetY = -offsetMagnitudeY; break;
              case 'down': offsetY = offsetMagnitudeY; break;
              case 'left': offsetX = -offsetMagnitudeX; break;
              case 'right': offsetX = offsetMagnitudeX; break;
            }

            const newId = `${sourceEq.type}-${Date.now()}-paste`;
            const newCopy: EquipmentData = {
              ...sourceEq,
              id: newId,
              x: sourceEq.x + offsetX,
              y: sourceEq.y + offsetY,
            };

            const newEqs = [...latestStateRef.current.equipments, newCopy];
            setEquipments(newEqs);
            scheduleHistoryCommit({ equipments: newEqs });
            
            // 붙여넣기 한 객체를 바로 선택 상태로 만들고, 
            // 클립보드 기준도 새 객체로 갱신하여 연속 붙여넣기가 자연스럽게 이어지도록 함
            setSelectedId(newId);
            setCopiedEqId(newId);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, copiedEqId, removeRoom, removeEquipment, scheduleHistoryCommit]);

  return (
    <main className={styles.layout}>
      {/* Top Navigation Bar */}
      <header className={styles.header}>
        <div className={styles.headerTitleContainer} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="PILA-SPACE Logo" style={{ height: '40px', width: '40px', objectFit: 'contain', borderRadius: '8px' }} />
          <h1 className={styles.headerTitle} style={{ margin: 0 }}>
            PILA-SPACE
          </h1>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}>
          {/* Undo / Redo Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <button 
                onClick={undo}
                disabled={historyState.index <= 0}
                title="실행 취소 (Ctrl+Z)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  background: historyState.index <= 0 ? 'transparent' : 'white',
                  border: historyState.index <= 0 ? '1px solid transparent' : '1px solid #d1d5db',
                  color: historyState.index <= 0 ? '#9ca3af' : '#111827',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: historyState.index <= 0 ? 'not-allowed' : 'pointer',
                  boxShadow: historyState.index <= 0 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '16px' }}>↩</span>
                <span className={styles.desktopOnly}>실행 취소</span>
                <span className={styles.mobileOnly}>취소</span>
              </button>
              
              <button 
                onClick={redo}
                disabled={historyState.index >= historyState.list.length - 1}
                title="다시 실행 (Ctrl+Y)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  background: historyState.index >= historyState.list.length - 1 ? 'transparent' : 'white',
                  border: historyState.index >= historyState.list.length - 1 ? '1px solid transparent' : '1px solid #d1d5db',
                  color: historyState.index >= historyState.list.length - 1 ? '#9ca3af' : '#111827',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: historyState.index >= historyState.list.length - 1 ? 'not-allowed' : 'pointer',
                  boxShadow: historyState.index >= historyState.list.length - 1 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '16px' }}>↪</span>
                <span className={styles.desktopOnly}>다시 실행</span>
                <span className={styles.mobileOnly}>복구</span>
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={styles.headerButton}
            onClick={() => setShowAIModal(true)}
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(236, 72, 153, 0.3)'
            }}>
            <span className={styles.desktopOnly}>📐 새 도면 시작하기</span>
            <span className={styles.mobileOnly}>📐 새 도면</span>
          </button>
          <button 
            className={styles.headerButton}
            onClick={() => setShowQuoteModal(true)}
            style={{
              background: '#f97316',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(249, 115, 22, 0.2)'
            }}>
            <span className={styles.desktopOnly}>🚀 인테리어/기구 비교 견적 받기</span>
            <span className={styles.mobileOnly}>🚀 견적받기</span>
          </button>
          <button 
            className={styles.headerButton}
            onClick={() => {
              const fileName = window.prompt('저장할 도면의 이름을 입력해주세요 (확장자 제외):', '내-필라테스-도면');
              if (fileName !== null) {
                const finalName = fileName.trim() === '' ? `pilates-floorplan-${Date.now()}` : fileName.trim();
                editorRef.current?.downloadImage(finalName);
              }
            }}
            style={{
              background: '#111827',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer'
            }}>
            <span className={styles.desktopOnly}>도면 저장 (PNG)</span>
            <span className={styles.mobileOnly}>💾 저장</span>
          </button>
        </div>
      </header>

      {/* Mobile FAB and Overlay */}
      <div 
        className={`${styles.overlay} ${isMobileMenuOpen ? styles.overlayOpen : ''}`} 
        onClick={() => setIsMobileMenuOpen(false)} 
      />
      
      {!selectedEquipment && (
        <button 
          className={styles.fabButton}
          onClick={() => setIsMobileMenuOpen(true)}
        >
          +
        </button>
      )}

      {/* Equipment Contextual Floating Pill Menu */}
      {selectedEquipment && !isMobileMenuOpen && (
        <div className={styles.contextMenu}>
          {!selectedEquipment.isLocked && <button onClick={rotateEquipment}>🔄 회전</button>}
          <button onClick={() => setShowCopyPrompt(true)}>📋 복사</button>
          {!selectedEquipment.isLocked && <button onClick={() => setIsMobileMenuOpen(true)}>⚙️ 설정</button>}
          <button onClick={() => toggleLockEquipment(selectedEquipment.id)}>
            {selectedEquipment.isLocked ? '🔓 해제' : '🔒 고정'}
          </button>
          {!selectedEquipment.isLocked && <button className={styles.deleteBtn} onClick={() => removeEquipment(selectedEquipment.id)}>🗑️ 삭제</button>}
        </div>
      )}

      {/* Room Contextual Floating Pill Menu */}
      {selectedRoom && !isMobileMenuOpen && (
        <div className={styles.contextMenu}>
          <button onClick={() => toggleLockRoom(selectedRoom.id)}>
            {selectedRoom.isLocked ? '🔓 방 전체 잠금 해제' : '🔒 방 전체 잠금'}
          </button>
          {!selectedRoom.isLocked && selectedRoom.type !== 'outer' && (
            <button className={styles.deleteBtn} onClick={() => removeRoom(selectedRoom.id)}>🗑️ 삭제</button>
          )}
        </div>
      )}

      {/* Copy Prompt Modal */}
      {showCopyPrompt && (
        <div className={styles.copyPromptOverlay} onClick={() => setShowCopyPrompt(false)}>
          <div className={styles.copyPromptModal} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
              연속 자동 복사
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
              선택한 방향으로 여유 공간 간격에 맞춰 일렬 자동 배치합니다.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
              <button 
                onClick={() => setCopyDirection('left')} 
                style={{ padding: '8px 0', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer', background: copyDirection === 'left' ? '#f97316' : 'white', color: copyDirection === 'left' ? 'white' : 'black' }}>
                ⬅️ 좌
              </button>
              <button 
                onClick={() => setCopyDirection('up')} 
                style={{ padding: '8px 0', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer', background: copyDirection === 'up' ? '#f97316' : 'white', color: copyDirection === 'up' ? 'white' : 'black' }}>
                ⬆️ 상
              </button>
              <button 
                onClick={() => setCopyDirection('down')} 
                style={{ padding: '8px 0', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer', background: copyDirection === 'down' ? '#f97316' : 'white', color: copyDirection === 'down' ? 'white' : 'black' }}>
                ⬇️ 하
              </button>
              <button 
                onClick={() => setCopyDirection('right')} 
                style={{ padding: '8px 0', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer', background: copyDirection === 'right' ? '#f97316' : 'white', color: copyDirection === 'right' ? 'white' : 'black' }}>
                ➡️ 우
              </button>
            </div>

            <div className={styles.copyInputGroup}>
              <button 
                className={styles.copyInputBtn} 
                onClick={() => setCopyQuantity(Math.max(1, copyQuantity - 1))}
              >-</button>
              <span>{copyQuantity}</span>
              <button 
                className={styles.copyInputBtn} 
                onClick={() => setCopyQuantity(Math.min(20, copyQuantity + 1))}
              >+</button>
            </div>
            <button 
              onClick={executeAutoCopy}
              style={{
                width: '100%',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              배치하기
            </button>
          </div>
        </div>
      )}

      {/* Main Editor Area */}
      <div className={styles.editorArea}>
        {/* Toolbar (Left / Bottom Sheet on Mobile) */}
        <aside className={`${styles.toolbar} ${isMobileMenuOpen ? styles.toolbarOpen : ''}`}>
          
          {/* ROI Dashboard */}
          <div style={{ marginBottom: '24px', background: 'linear-gradient(to bottom right, #f8fafc, #eff6ff)', padding: '16px', borderRadius: '12px', border: '1px solid #bfdbfe', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📊 실시간 공간 ROI 분석
            </h2>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>매출 공간 (레슨룸) 비율</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: revenueRatio >= 70 ? '#059669' : revenueRatio >= 50 ? '#d97706' : '#dc2626' }}>
                  {revenueRatio}%
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${revenueRatio}%`, 
                  background: revenueRatio >= 70 ? '#10b981' : revenueRatio >= 50 ? '#f59e0b' : '#ef4444',
                  transition: 'width 0.3s ease, background 0.3s ease'
                }} />
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', lineHeight: 1.3 }}>
                {revenueRatio >= 70 ? '✨ 훌륭합니다! 상업 공간 황금비율을 달성했습니다.' : revenueRatio >= 50 ? '⚠️ 비수익 공간(복도/부대시설)이 다소 많습니다.' : '🚨 데드스페이스가 많습니다. 재배치를 권장합니다.'}
              </p>
            </div>

            <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>예상 월 최대 매출 (풀타임 가동시)</span>
                <button onClick={() => setShowRoiModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: 0 }} title="ROI 조건 설정">⚙️</button>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                ₩{maxRevenueMonthly.toLocaleString()}
              </div>
              <p style={{ fontSize: '10px', color: '#94a3b8', margin: '4px 0 0 0', lineHeight: 1.3 }}>
                * 개인룸 {privateRoomCount}개, 그룹기구 {estimatedGroupCapacity}대 기준<br/>
                (설정된 예상 단가 및 가동 횟수 기준)
              </p>
            </div>
          </div>

          <div className={styles.toolSection}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              도구 (Tools)
            </h2>
            <div className={styles.toolsGrid}>
              <button 
            className={styles.toolButton}
            onClick={() => {
              if (window.confirm('기존 도면과 배치된 기구가 모두 초기화됩니다. 처음부터 다시 그리시겠습니까?')) {
                // Reset to default outer wall
                updateRooms([
                  {
                    id: `outer-${Date.now()}`,
                    name: '전체 외벽',
                    type: 'outer',
                    points: [
                      { x: 100, y: 100 },
                      { x: 600, y: 100 },
                      { x: 600, y: 600 },
                      { x: 100, y: 600 },
                    ],
                    colorTheme: '#3b82f6'
                  }
                ]);
                updateEquipments([]);
                setIsMobileMenuOpen(false); // Close menu on mobile
              }
            }}
          >
            🔄 전체 초기화
          </button>
          <button 
            className={styles.toolButton}
            onClick={handleAddRoomClick}
          >
            + 룸(Room) 추가
          </button>
            </div>
          </div>

          {selectedEquipment && (
            <>
              <div style={{ margin: '24px 0', borderTop: '1px solid #e5e7eb' }} />
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                선택된 기구 설정
              </h2>
              <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 600, marginBottom: '12px', color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{selectedEquipment.type === 'Custom' ? '기타 가구/기구' : selectedEquipment.type} 설정</span>
                  <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px' }}>&times;</button>
                </div>
                
                {selectedEquipment.type === 'Custom' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>이름 (Label)</label>
                    <input 
                      type="text" 
                      value={selectedEquipment.customLabel || ''}
                      placeholder="예: 탈의실 락커, 상담테이블"
                      onChange={(e) => handleEquipmentLabelChange(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>가로 (cm)</label>
                    <input 
                      type="number" 
                      value={Math.round((selectedEquipment.width || EQUIPMENT_DIMS[selectedEquipment.type].width) * 2)}
                      onChange={(e) => handleEquipmentDimensionChange('width', Number(e.target.value))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>세로 (cm)</label>
                    <input 
                      type="number" 
                      value={Math.round((selectedEquipment.height || EQUIPMENT_DIMS[selectedEquipment.type].height) * 2)}
                      onChange={(e) => handleEquipmentDimensionChange('height', Number(e.target.value))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>여유 공간 (cm)</label>
                  <input 
                    type="number" 
                    value={selectedEquipment.clearance ?? 40}
                    onChange={(e) => handleEquipmentDimensionChange('clearance', Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, lineHeight: 1.4 }}>
                  실제 기구의 치수(cm)를 입력하시면 도면에 정확한 비율로 반영됩니다.
                </p>
                <button 
                  onClick={() => removeEquipment(selectedEquipment.id)}
                  style={{ marginTop: '12px', width: '100%', padding: '8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  🗑️ 삭제
                </button>
              </div>
            </>
          )}
          
          <div style={{ margin: '24px 0', borderTop: '1px solid #e5e7eb' }} />
          
          <div className={styles.toolSection}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              기구 (Equipment)
            </h2>
            <div className={styles.toolsGrid}>
              <button className={styles.toolButton} onClick={() => addEquipment('Reformer')}>
            🛏️ 리포머
          </button>
          <button className={styles.toolButton} onClick={() => addEquipment('Cadillac')}>
            🏗️ 캐딜락
          </button>
          <button className={styles.toolButton} onClick={() => addEquipment('Chair')}>
            🪑 체어
          </button>
          <button className={styles.toolButton} onClick={() => addEquipment('Barrel')}>
            🛢️ 바렐
          </button>
          <div style={{ display: 'flex', gap: '8px', marginTop: '0' }}>
            <button 
              onClick={() => addEquipment('Custom')}
              style={{ flex: 1, padding: '8px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#4b5563' }}>
              + 가구(커스텀) 생성
            </button>
            <button 
              onClick={() => addEquipment('Door')}
              style={{ flex: 1, padding: '8px', background: '#e0e7ff', border: '1px solid #c7d2fe', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#4338ca' }}>
              + 출입문 생성
            </button>
            </div>
            </div>
          </div>
        </aside>

        {/* Canvas Area */}
        <Editor 
          editorRef={editorRef}
          equipments={equipments} 
          setEquipments={updateEquipments} 
          rooms={rooms}
          setRooms={updateRooms}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          movingRoomId={movingRoomId}
          onPointerMove={(pos) => { mousePosRef.current = pos; }}
        />
      </div>

      {/* Tutorial Overlay */}
      {showTutorial && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '16px',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>
              환영합니다! 👋
            </h2>
            <p style={{ color: '#4b5563', marginBottom: '24px', lineHeight: '1.6' }}>
              우리 상가에 딱 맞는 필라테스 공간을 직접 설계해 보세요.<br/><br/>
              <b>💡 꿀팁: 다각형 공간 만들기</b><br/>
              파란색 선 중간에 있는 <b>반투명한 동그라미</b>를 클릭하면 모서리가 추가됩니다. 기둥이나 꺾인 복도 형태를 쉽게 만들어보세요!<br/><br/>
              <b>🛏️ 기구 배치하기</b><br/>
              좌측 패널에서 기구를 추가하고 드래그하여 배치하세요. 기구를 클릭하면 회전도 가능합니다.
            </p>
            <button 
              onClick={() => setShowTutorial(false)}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '12px 32px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              시작하기
            </button>
          </div>
        </div>
      )}

      {/* AI Layout Generator Modal */}
      {showAIModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white', padding: '32px', borderRadius: '16px',
            width: '450px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>✨ AI 기반 자동 도면 기획</span>
              <button onClick={() => setShowAIModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#9ca3af' }}>&times;</button>
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px', lineHeight: 1.5 }}>
              공간과 원하시는 인원을 입력하시면, 알고리즘이 1초 만에 최적의 기구 및 방 구조를 캔버스에 깔아드립니다.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button onClick={() => setAiParams({...aiParams, mode: 'pyeong'})} style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid #d1d5db', background: aiParams.mode === 'pyeong' ? '#3b82f6' : 'white', color: aiParams.mode === 'pyeong' ? 'white' : '#374151', cursor: 'pointer' }}>평수 입력</button>
              <button onClick={() => setAiParams({...aiParams, mode: 'dimensions'})} style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid #d1d5db', background: aiParams.mode === 'dimensions' ? '#3b82f6' : 'white', color: aiParams.mode === 'dimensions' ? 'white' : '#374151', cursor: 'pointer' }}>가로x세로 입력</button>
            </div>

            <>
              {aiParams.mode === 'pyeong' ? (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>전체 평수 (예: 30)</label>
                  <input 
                    type="number" 
                    value={aiParams.pyeong} 
                    onChange={e => setAiParams({...aiParams, pyeong: e.target.value === '' ? '' : parseInt(e.target.value)})} 
                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} 
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>가로 (m)</label>
                    <input 
                      type="number" 
                      value={aiParams.widthM} 
                      onChange={e => setAiParams({...aiParams, widthM: e.target.value === '' ? '' : parseFloat(e.target.value)})} 
                      style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>세로 (m)</label>
                    <input 
                      type="number" 
                      value={aiParams.heightM} 
                      onChange={e => setAiParams({...aiParams, heightM: e.target.value === '' ? '' : parseFloat(e.target.value)})} 
                      style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} 
                    />
                  </div>
                </div>
              )}
              </>
            <button
              onClick={handleGenerateAI}
              style={{
                width: '100%',
                background: '#10b981',
                color: 'white', border: 'none', padding: '14px', borderRadius: '8px',
                fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)'
              }}
            >
              ✏️ 빈 캔버스로 시작하기
            </button>
            <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '12px', textAlign: 'center' }}>
              ⚠️ 주의: 기존에 그리신 도면과 기구는 모두 초기화됩니다.
            </p>
          </div>
        </div>
      )}

      {/* Smart Room Add Modal */}
      {showRoomModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white', padding: '32px', borderRadius: '16px',
            width: '400px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>➕ 스마트 룸 추가</span>
              <button onClick={() => setShowRoomModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#9ca3af' }}>&times;</button>
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px', lineHeight: 1.5 }}>
              룸 크기를 지정하고, 내부에 자동으로 배치할 기구를 선택하세요.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>룸 이름</label>
              <input 
                type="text" 
                value={newRoomParams.name} 
                onChange={e => setNewRoomParams({...newRoomParams, name: e.target.value})} 
                placeholder="예: 리포머 룸"
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} 
              />
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>가로 (m)</label>
                <input 
                  type="number" 
                  value={newRoomParams.widthM} 
                  onChange={e => setNewRoomParams({...newRoomParams, widthM: e.target.value === '' ? '' : parseFloat(e.target.value)})} 
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} 
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>세로 (m)</label>
                <input 
                  type="number" 
                  value={newRoomParams.heightM} 
                  onChange={e => setNewRoomParams({...newRoomParams, heightM: e.target.value === '' ? '' : parseFloat(e.target.value)})} 
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} 
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px', padding: '16px', background: '#f3f4f6', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#111827', marginBottom: '8px', fontWeight: 700 }}>자동 배치 기구 (선택)</label>
              <select 
                value={newRoomParams.equipmentType} 
                onChange={e => setNewRoomParams({...newRoomParams, equipmentType: e.target.value as EquipmentType | 'None'})}
                style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '12px' }}
              >
                <option value="None">빈 룸으로 생성</option>
                <option value="Reformer">리포머</option>
                <option value="Chair">체어</option>
                <option value="Barrel">바렐</option>
                <option value="Cadillac">캐딜락</option>
              </select>

              {newRoomParams.equipmentType !== 'None' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#4b5563' }}>기구 수량:</span>
                  <input 
                    type="number" 
                    value={newRoomParams.quantity} 
                    onChange={e => setNewRoomParams({...newRoomParams, quantity: e.target.value === '' ? '' : parseInt(e.target.value)})} 
                    style={{ width: '80px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} 
                  />
                  <span style={{ fontSize: '12px', color: '#4b5563' }}>대</span>
                </div>
              )}
            </div>

            <button
              onClick={handleCreateSmartRoom}
              style={{
                width: '100%',
                background: '#a855f7',
                color: 'white', border: 'none', padding: '14px', borderRadius: '8px',
                fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(168, 85, 247, 0.3)'
              }}
            >
              룸 생성 및 캔버스에 추가
            </button>
          </div>
        </div>
      )}

      {/* Quote Request Modal */}
      {showQuoteModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white',
            padding: '32px',
            borderRadius: '16px',
            width: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>🚀 무료 비교 견적 요청</span>
              <button onClick={() => setShowQuoteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#9ca3af' }}>&times;</button>
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px', lineHeight: 1.5 }}>
              지금 그리신 도면을 바탕으로 <b>가장 저렴하고 확실한</b> 인테리어 및 기구 견적을 받아보세요.
            </p>

            {status !== 'authenticated' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>
                  정확한 견적서 발송을 위해 카카오 로그인이 필요합니다.
                </p>
                <button
                  onClick={() => signIn('kakao')}
                  style={{
                    width: '100%',
                    background: '#FEE500',
                    color: '#000000',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>💬</span> 카카오로 3초 만에 시작하기
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitQuote}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>성함 (또는 상호명) <span style={{color: '#ef4444'}}>*</span></label>
                <input 
                  type="text" 
                  required
                  value={quoteForm.name} 
                  onChange={e => setQuoteForm({...quoteForm, name: e.target.value})} 
                  placeholder="예: 홍길동 원장"
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} 
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>
                  연락처 <span style={{color: '#ef4444'}}>*</span>
                </label>
                <input 
                  type="tel" 
                  required
                  value={quoteForm.phone} 
                  onChange={e => setQuoteForm({...quoteForm, phone: e.target.value})} 
                  placeholder="010-1234-5678"
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} 
                />
                <p style={{fontSize: '11px', color: '#3b82f6', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px'}}>
                  💡 추후 이 단계는 '카카오 간편 1초 로그인'으로 자동화됩니다.
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>
                  이메일 주소 <span style={{color: '#ef4444'}}>*</span>
                </label>
                <input 
                  type="email" 
                  required
                  value={quoteForm.email} 
                  onChange={e => setQuoteForm({...quoteForm, email: e.target.value})} 
                  placeholder="example@gmail.com (견적서 수신용)"
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} 
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>오픈 예정 지역 <span style={{color: '#ef4444'}}>*</span></label>
                <input 
                  type="text" 
                  required
                  value={quoteForm.region} 
                  onChange={e => setQuoteForm({...quoteForm, region: e.target.value})} 
                  placeholder="예: 서울 강남구 역삼동"
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} 
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>오픈 예정 시기</label>
                <select 
                  value={quoteForm.expectedDate} 
                  onChange={e => setQuoteForm({...quoteForm, expectedDate: e.target.value})} 
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}>
                  <option value="1개월 이내">1개월 이내 (매우 급함)</option>
                  <option value="3개월 이내">3개월 이내</option>
                  <option value="6개월 이내">6개월 이내</option>
                  <option value="미정">미정 (알아보는 중)</option>
                </select>
              </div>

              <button 
                type="submit"
                style={{
                  width: '100%',
                  background: '#f97316',
                  color: 'white',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(249, 115, 22, 0.2)'
                }}
              >
                도면 전송 및 무료 견적 받기
              </button>
            </form>
            )}
          </div>
        </div>
      )}

      {/* ROI Settings Modal */}
      {showRoiModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white', padding: '32px', borderRadius: '16px',
            width: '450px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>⚙️ 실시간 ROI 시뮬레이션 설정</span>
              <button onClick={() => setShowRoiModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#9ca3af' }}>&times;</button>
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px', lineHeight: 1.5 }}>
              우리 센터의 상황에 맞게 예상 객단가와 회전율을 조절하여 정확한 수익성을 분석해 보세요. (변경 즉시 좌측 패널에 반영됩니다.)
            </p>

            {/* 1:1 개인 레슨 설정 */}
            <div style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '16px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>1:1 개인 레슨 설정</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>예상 객단가 (회당)</label>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{roiParams.privatePrice.toLocaleString()}원</span>
                </div>
                <input 
                  type="range" min="30000" max="150000" step="5000"
                  value={roiParams.privatePrice} 
                  onChange={e => setRoiParams({...roiParams, privatePrice: Number(e.target.value)})} 
                  style={{ width: '100%', accentColor: '#3b82f6' }} 
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>일 평균 가동 횟수</label>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{roiParams.privateSessionsPerDay}회</span>
                </div>
                <input 
                  type="range" min="1" max="15" step="1"
                  value={roiParams.privateSessionsPerDay} 
                  onChange={e => setRoiParams({...roiParams, privateSessionsPerDay: Number(e.target.value)})} 
                  style={{ width: '100%', accentColor: '#3b82f6' }} 
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>개인룸 1개당 소모 기구 수</label>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{roiParams.privateEquipmentCount}대</span>
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>개인룸 하나에 보통 리포머, 바렐, 체어 등 몇 대의 기구를 넣을지 설정합니다.</p>
                <input 
                  type="range" min="1" max="5" step="1"
                  value={roiParams.privateEquipmentCount} 
                  onChange={e => setRoiParams({...roiParams, privateEquipmentCount: Number(e.target.value)})} 
                  style={{ width: '100%', accentColor: '#3b82f6' }} 
                />
              </div>
            </div>

            {/* 그룹 레슨 설정 */}
            <div style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '16px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>그룹 레슨 설정</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>예상 객단가 (회당)</label>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{roiParams.groupPrice.toLocaleString()}원</span>
                </div>
                <input 
                  type="range" min="10000" max="50000" step="1000"
                  value={roiParams.groupPrice} 
                  onChange={e => setRoiParams({...roiParams, groupPrice: Number(e.target.value)})} 
                  style={{ width: '100%', accentColor: '#10b981' }} 
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>일 평균 가동 횟수</label>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{roiParams.groupSessionsPerDay}회</span>
                </div>
                <input 
                  type="range" min="1" max="15" step="1"
                  value={roiParams.groupSessionsPerDay} 
                  onChange={e => setRoiParams({...roiParams, groupSessionsPerDay: Number(e.target.value)})} 
                  style={{ width: '100%', accentColor: '#10b981' }} 
                />
              </div>
            </div>

            {/* 공통 설정 */}
            <div style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '16px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>공통 운영 설정</h3>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>월 평균 영업일 수</label>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{roiParams.operatingDaysPerMonth}일</span>
                </div>
                <input 
                  type="range" min="15" max="30" step="1"
                  value={roiParams.operatingDaysPerMonth} 
                  onChange={e => setRoiParams({...roiParams, operatingDaysPerMonth: Number(e.target.value)})} 
                  style={{ width: '100%', accentColor: '#8b5cf6' }} 
                />
              </div>
            </div>

            <button
              onClick={() => setShowRoiModal(false)}
              style={{
                width: '100%',
                background: '#111827',
                color: 'white', border: 'none', padding: '14px', borderRadius: '8px',
                fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
