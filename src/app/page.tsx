'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@/components/Editor';
import { EditorCanvasHandle } from '@/components/Editor/EditorCanvas';
import { EquipmentData, EquipmentType, EQUIPMENT_DIMS } from '@/components/Editor/Equipment';
import { generateAILayout } from '@/lib/layoutGenerator';
import { useSession, signIn } from 'next-auth/react';
import styles from './page.module.css';

export type Point = { x: number; y: number };

export interface RoomData {
  id: string;
  name: string;
  type: 'outer' | 'inner';
  points: Point[];
  colorTheme: string; // hex color code
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

  // History state for Undo/Redo
  const [history, setHistory] = useState<AppState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoaded, setIsLoaded] = useState(false);

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

  // AI Layout Generator State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiParams, setAiParams] = useState({
    pyeong: 30,
    groupCount: 6,
    groupRooms: { reformer: true, chair: false, barrel: false },
    privateRoomsCount: 1,
    auxiliary: { reception: true, consultation: true, locker: true, lounge: false }
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
    setHistory([{ rooms: initRooms, equipments: initEquips }]);
    setHistoryIndex(0);
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

  const saveToHistory = useCallback((newState: AppState) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newState);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setRooms(prevState.rooms);
      setEquipments(prevState.equipments);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setRooms(nextState.rooms);
      setEquipments(nextState.equipments);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

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
    saveToHistory({ rooms: newRooms, equipments });
  };

  const handleGenerateAI = () => {
    const { rooms: newRooms, equipments: newEquips, error } = generateAILayout(aiParams);
    if (error) {
      alert(error);
      return;
    }
    
    setRooms(newRooms);
    setEquipments(newEquips);
    saveToHistory({ rooms: newRooms, equipments: newEquips });
    setShowAIModal(false);
    
    alert('AI 기반 자동 도면 생성이 완료되었습니다! 기구와 방의 위치를 자유롭게 드래그하여 수정해 보세요.');
  };

  const updateEquipments = (newEquipments: EquipmentData[]) => {
    setEquipments(newEquipments);
    saveToHistory({ rooms, equipments: newEquipments });
  };

  const addRoom = () => {
    const newRoom: RoomData = {
      id: `inner-${Date.now()}`,
      name: `룸 ${rooms.length}`,
      type: 'inner',
      points: [
        { x: 150, y: 150 },
        { x: 350, y: 150 },
        { x: 350, y: 350 },
        { x: 150, y: 350 },
      ],
      colorTheme: '#a855f7' // Purple
    };
    updateRooms([...rooms, newRoom]);
    setIsMobileMenuOpen(false); // Close menu on mobile
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

  return (
    <main className={styles.layout}>
      {/* Top Navigation Bar */}
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>
          Pilates Space Optimizer
        </h1>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}>
          {/* Undo / Redo Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <button 
                onClick={undo}
                disabled={historyIndex <= 0}
                title="실행 취소 (Ctrl+Z)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  background: historyIndex <= 0 ? 'transparent' : 'white',
                  border: historyIndex <= 0 ? '1px solid transparent' : '1px solid #d1d5db',
                  color: historyIndex <= 0 ? '#9ca3af' : '#111827',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                  boxShadow: historyIndex <= 0 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '16px' }}>↩</span>
                <span className={styles.desktopOnly}>실행 취소</span>
                <span className={styles.mobileOnly}>취소</span>
              </button>
              
              <button 
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                title="다시 실행 (Ctrl+Y)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  background: historyIndex >= history.length - 1 ? 'transparent' : 'white',
                  border: historyIndex >= history.length - 1 ? '1px solid transparent' : '1px solid #d1d5db',
                  color: historyIndex >= history.length - 1 ? '#9ca3af' : '#111827',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
                  boxShadow: historyIndex >= history.length - 1 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
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
            <span className={styles.desktopOnly}>✨ AI 자동 도면 기획</span>
            <span className={styles.mobileOnly}>✨ AI 기획</span>
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

      {/* Contextual Floating Pill Menu */}
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
            onClick={addRoom}
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
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px', lineHeight: 1.5 }}>
              공간과 원하시는 인원을 입력하시면, 알고리즘이 1초 만에 최적의 기구 및 방 구조를 캔버스에 깔아드립니다.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 600 }}>전체 평수 (예: 30)</label>
              <input 
                type="number" 
                value={aiParams.pyeong} 
                onChange={e => setAiParams({...aiParams, pyeong: parseInt(e.target.value) || 0})} 
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} 
              />
            </div>

            <div style={{ marginBottom: '16px', padding: '16px', background: '#f3f4f6', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#111827', marginBottom: '8px', fontWeight: 700 }}>1. 그룹 레슨룸 구성</label>
              <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#4b5563' }}>그룹 레슨 인원수:</span>
                <input 
                  type="number" 
                  value={aiParams.groupCount} 
                  onChange={e => setAiParams({...aiParams, groupCount: parseInt(e.target.value) || 0})} 
                  style={{ width: '80px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} 
                />
                <span style={{ fontSize: '12px', color: '#4b5563' }}>명</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aiParams.groupRooms.reformer} onChange={e => setAiParams({...aiParams, groupRooms: {...aiParams.groupRooms, reformer: e.target.checked}})} />
                  리포머룸
                </label>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aiParams.groupRooms.chair} onChange={e => setAiParams({...aiParams, groupRooms: {...aiParams.groupRooms, chair: e.target.checked}})} />
                  체어룸
                </label>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aiParams.groupRooms.barrel} onChange={e => setAiParams({...aiParams, groupRooms: {...aiParams.groupRooms, barrel: e.target.checked}})} />
                  바렐룸
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '16px', padding: '16px', background: '#f3f4f6', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#111827', marginBottom: '8px', fontWeight: 700 }}>2. 개인 레슨룸 구성</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#4b5563' }}>프라이빗(1:1) 룸 개수:</span>
                <input 
                  type="number" 
                  value={aiParams.privateRoomsCount} 
                  onChange={e => setAiParams({...aiParams, privateRoomsCount: parseInt(e.target.value) || 0})} 
                  style={{ width: '80px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }} 
                />
                <span style={{ fontSize: '12px', color: '#4b5563' }}>개</span>
              </div>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0 0' }}>* 각 방에는 대기구 4종이 모두 들어갑니다.</p>
            </div>

            <div style={{ marginBottom: '24px', padding: '16px', background: '#f3f4f6', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#111827', marginBottom: '8px', fontWeight: 700 }}>3. 부대시설 선택 (레고 블록 모듈)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aiParams.auxiliary.reception} onChange={e => setAiParams({...aiParams, auxiliary: {...aiParams.auxiliary, reception: e.target.checked}})} />
                  인포데스크/로비
                </label>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aiParams.auxiliary.consultation} onChange={e => setAiParams({...aiParams, auxiliary: {...aiParams.auxiliary, consultation: e.target.checked}})} />
                  독립형 상담실
                </label>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aiParams.auxiliary.locker} onChange={e => setAiParams({...aiParams, auxiliary: {...aiParams.auxiliary, locker: e.target.checked}})} />
                  남/여 탈의실
                </label>
                <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aiParams.auxiliary.lounge} onChange={e => setAiParams({...aiParams, auxiliary: {...aiParams.auxiliary, lounge: e.target.checked}})} />
                  휴게실/라운지
                </label>
              </div>
            </div>

            <button
              onClick={handleGenerateAI}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                color: 'white', border: 'none', padding: '14px', borderRadius: '8px',
                fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(236, 72, 153, 0.3)'
              }}
            >
              ✨ 도면 자동 생성하기
            </button>
            <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '12px', textAlign: 'center' }}>
              ⚠️ 주의: 기존에 그리신 도면과 기구는 모두 초기화됩니다.
            </p>
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
    </main>
  );
}
