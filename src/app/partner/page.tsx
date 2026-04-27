'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

const EditorCanvas = dynamic(() => import('@/components/Editor/EditorCanvas'), { ssr: false });

export default function PartnerDashboard() {
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
      const res = await fetch('/api/partner/quotes', {
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

  const handleRequestContact = () => {
    alert('이 기능은 실제 서비스 오픈 시 과금(또는 포인트 차감) 후 고객의 원본 연락처를 열람할 수 있는 기능입니다. 현재는 테스트 모드입니다.');
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '320px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', color: '#0f172a' }}>제휴사 파트너 포털</h1>
          <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', marginBottom: '24px' }}>인테리어 및 기구 제휴사 전용 접속</p>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#334155' }}>발급받은 비밀번호</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box' }}
              placeholder="비밀번호 입력"
              required
            />
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}
          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {loading ? '확인 중...' : '파트너 로그인'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0f172a' }}>🤝 제휴사 파트너 오더 현황</h1>
          <button 
            onClick={() => { setIsAuthenticated(false); setPassword(''); setQuotes([]); }}
            style={{ padding: '8px 16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
          >
            로그아웃
          </button>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f1f5f9' }}>
              <tr>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>접수 일시</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>오픈 예정 지역</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>오픈 시기</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>고객 정보</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>상세 도면</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>현재 진행 중인 오더가 없습니다.</td>
                </tr>
              ) : quotes.map(q => (
                <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px', color: '#0f172a', fontSize: '14px' }}>{new Date(q.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '16px', color: '#0f172a', fontWeight: 'bold' }}>{q.region}</td>
                  <td style={{ padding: '16px', color: '#64748b' }}>{q.expectedDate}</td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#0f172a' }}>{q.name}</span>
                      <span style={{ fontSize: '13px', color: '#0f172a' }}>{q.phone}</span>
                      <button 
                        onClick={handleRequestContact}
                        style={{ marginTop: '4px', background: '#fff', border: '1px solid #3b82f6', color: '#3b82f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        연락처 열람하기
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <button 
                      onClick={() => setViewingQuote(q)}
                      style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                    >
                      도면 확인
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floor Plan Viewer Modal */}
      {viewingQuote && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 24px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>{viewingQuote.region} 오픈 예정 도면</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>고객명: {viewingQuote.name}</p>
            </div>
            <button 
              onClick={() => setViewingQuote(null)}
              style={{ background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#0f172a' }}
            >
              닫기
            </button>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', position: 'relative' }}>
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
