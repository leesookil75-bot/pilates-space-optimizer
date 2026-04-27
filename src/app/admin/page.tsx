'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const EditorCanvas = dynamic(() => import('@/components/Editor/EditorCanvas'), { ssr: false });

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Floor plan viewer state
  const [viewingQuote, setViewingQuote] = useState<any | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/admin/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setIsAuthenticated(true);
        setQuotes(data.quotes || []);
      } else {
        setError('비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      setError('서버 통신 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/quotes/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, id, status: newStatus })
      });
      if (res.ok) {
        setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: newStatus } : q));
      } else {
        alert('상태 업데이트 실패');
      }
    } catch (error) {
      alert('상태 업데이트 오류');
    }
  };

  const summarizeEquipments = (equipments: any[]) => {
    if (!equipments || equipments.length === 0) return '-';
    const counts = equipments.reduce((acc: any, eq: any) => {
      let label = eq.type;
      if (label === 'Reformer') label = '리포머';
      if (label === 'Cadillac') label = '캐딜락';
      if (label === 'Chair') label = '체어';
      if (label === 'Barrel') label = '바렐';
      if (label === 'Custom') label = eq.customLabel || '가구';
      if (label === 'Door') label = '출입문';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    const summary = Object.entries(counts)
      .filter(([key]) => key !== '출입문' && key !== '가구')
      .map(([key, count]) => `${key} ${count}대`)
      .join(', ');
    return summary || '-';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '신규 접수': return { bg: '#dbeafe', color: '#1e40af' };
      case '제휴사 전달완료': return { bg: '#fef08a', color: '#854d0e' };
      case '상담 진행 중': return { bg: '#ffedd5', color: '#c2410c' };
      case '계약 완료': return { bg: '#dcfce3', color: '#166534' };
      case '보류/취소': return { bg: '#f3f4f6', color: '#4b5563' };
      default: return { bg: '#f3f4f6', color: '#4b5563' };
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f3f4f6', padding: '16px' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '360px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: '#111827' }}>관리자 접속</h1>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#4b5563' }}>비밀번호</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box' }}
              placeholder="비밀번호 입력"
              required
            />
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}
          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '12px', background: '#111827', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {loading ? '확인 중...' : '로그인'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '32px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#111827' }}>👑 견적 요청 관리자 대시보드</h1>
          <button 
            onClick={() => { setIsAuthenticated(false); setPassword(''); setQuotes([]); }}
            style={{ padding: '8px 16px', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
          >
            로그아웃
          </button>
        </div>

        <div className="responsive-table" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f3f4f6' }}>
              <tr>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>접수 일시</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>진행 상태</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>성함/상호</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>연락처</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>오픈 지역 / 시기</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>필요 기구</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>도면 보기</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>접수된 견적 요청이 없습니다.</td>
                </tr>
              ) : quotes.map(q => {
                const status = q.status || '신규 접수';
                const statusColor = getStatusColor(status);
                return (
                <tr key={q.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td data-label="접수 일시" style={{ padding: '16px', color: '#111827', fontSize: '14px' }}>{new Date(q.createdAt).toLocaleDateString()} {new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td data-label="진행 상태" style={{ padding: '16px' }}>
                    <select 
                      value={status}
                      onChange={(e) => handleStatusChange(q.id, e.target.value)}
                      style={{ 
                        padding: '6px 12px', 
                        borderRadius: '20px', 
                        border: 'none', 
                        fontSize: '13px', 
                        fontWeight: 'bold', 
                        cursor: 'pointer',
                        background: statusColor.bg,
                        color: statusColor.color,
                        outline: 'none',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        minWidth: '130px'
                      }}
                    >
                      <option value="신규 접수">🟢 신규 접수</option>
                      <option value="제휴사 전달완료">🟡 제휴사 전달완료</option>
                      <option value="상담 진행 중">🟠 상담 진행 중</option>
                      <option value="계약 완료">🔵 계약 완료</option>
                      <option value="보류/취소">⚫ 보류/취소</option>
                    </select>
                  </td>
                  <td data-label="성함/상호" style={{ padding: '16px', color: '#111827', fontWeight: 500 }}>{q.name}</td>
                  <td data-label="연락처" style={{ padding: '16px', color: '#111827' }}>{q.phone}</td>
                  <td data-label="지역/시기" style={{ padding: '16px', color: '#111827' }}>
                    <div>{q.region}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{q.expectedDate}</div>
                  </td>
                  <td data-label="필요 기구" style={{ padding: '16px', color: '#111827', fontSize: '13px', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={summarizeEquipments(q.equipments)}>
                    {summarizeEquipments(q.equipments)}
                  </td>
                  <td data-label="도면 보기" style={{ padding: '16px' }}>
                    <button 
                      onClick={() => setViewingQuote(q)}
                      style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      도면 열기
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floor Plan Viewer Modal */}
      {viewingQuote && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
          <div className="modal-content" style={{ width: '100%', maxWidth: '1000px', height: '90vh', background: 'white', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#111827' }}>{viewingQuote.name} 원장님의 도면</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>{viewingQuote.region} / {viewingQuote.expectedDate}</p>
            </div>
            <button 
              onClick={() => setViewingQuote(null)}
              style={{ background: '#f3f4f6', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#111827' }}
            >
              닫기
            </button>
          </div>
          <div style={{ flex: 1, background: '#f9fafb', position: 'relative' }}>
            <EditorCanvas 
              rooms={viewingQuote.rooms || []}
              equipments={viewingQuote.equipments || []}
              selectedId={null}
              setSelectedId={() => {}}
              setRooms={() => {}}
              setEquipments={() => {}}
              readOnly={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
