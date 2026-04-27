'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

const EditorCanvas = dynamic(() => import('@/components/Editor/EditorCanvas'), { ssr: false });

export default function PartnerDashboard() {
  const [partnerId, setPartnerId] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regData, setRegData] = useState({ companyName: '', contactName: '', phone: '', businessNumber: '' });
  
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
        body: JSON.stringify({ partnerId, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setIsAuthenticated(true);
        setQuotes(data.quotes || []);
      } else {
        setError(data.error || '로그인 실패');
      }
    } catch (err) {
      setError('서버 통신 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId, password, ...regData })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert('입점 신청이 완료되었습니다. 관리자 승인 후 로그인하실 수 있습니다.');
        setIsRegistering(false);
        setPassword('');
      } else {
        setError(data.error || '가입 실패');
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case '신규 접수': return <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>🟢 신규 접수</span>;
      case '제휴사 전달완료': return <span style={{ background: '#fef08a', color: '#854d0e', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>🟡 대기 중</span>;
      case '상담 진행 중': return <span style={{ background: '#ffedd5', color: '#c2410c', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>🟠 상담 중</span>;
      case '계약 완료': return <span style={{ background: '#dcfce3', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>🔵 계약 마감</span>;
      case '보류/취소': return <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>⚫ 보류/취소</span>;
      default: return <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>🟢 신규 접수</span>;
    }
  };

  if (!isAuthenticated) {
    if (isRegistering) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', padding: '16px' }}>
          <form onSubmit={handleRegister} style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', color: '#0f172a' }}>제휴사 입점 신청</h1>
            <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', marginBottom: '24px' }}>관리자 승인 후 파트너 포털을 이용할 수 있습니다.</p>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#334155' }}>희망 아이디 *</label>
              <input type="text" value={partnerId} onChange={e => setPartnerId(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#334155' }}>비밀번호 *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#334155' }}>업체명 (상호) *</label>
              <input type="text" value={regData.companyName} onChange={e => setRegData({...regData, companyName: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#334155' }}>담당자 성함 *</label>
              <input type="text" value={regData.contactName} onChange={e => setRegData({...regData, contactName: e.target.value})} required style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#334155' }}>연락처 *</label>
              <input type="text" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} required placeholder="010-1234-5678" style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#334155' }}>사업자등록번호</label>
              <input type="text" value={regData.businessNumber} onChange={e => setRegData({...regData, businessNumber: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
            </div>

            {error && <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}
            
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px' }}>
              {loading ? '처리 중...' : '입점 신청하기'}
            </button>
            <button type="button" onClick={() => setIsRegistering(false)} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>
              돌아가기
            </button>
          </form>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', padding: '16px' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '360px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', color: '#0f172a' }}>제휴사 파트너 포털</h1>
          <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', marginBottom: '24px' }}>인테리어 및 기구 제휴사 전용 접속</p>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#334155' }}>아이디</label>
            <input 
              type="text" 
              value={partnerId}
              onChange={e => setPartnerId(e.target.value)}
              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box' }}
              placeholder="아이디 입력"
              required
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#334155' }}>비밀번호</label>
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
            style={{ width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '16px' }}
          >
            {loading ? '확인 중...' : '파트너 로그인'}
          </button>
          
          <div style={{ textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>아직 파트너가 아니신가요?</p>
            <button 
              type="button" 
              onClick={() => { setIsRegistering(true); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
            >
              제휴사 입점 신청하기
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0f172a' }}>🤝 제휴사 파트너 오더 현황</h1>
          <button 
            onClick={() => { setIsAuthenticated(false); setPassword(''); setQuotes([]); }}
            style={{ padding: '8px 16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
          >
            로그아웃
          </button>
        </div>

        <div className="responsive-table" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f1f5f9' }}>
              <tr>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>접수 일시</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>상태</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>오픈 예정 지역</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>오픈 시기</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>고객 정보</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>필요 기구</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '14px' }}>상세 도면</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>현재 진행 중인 오더가 없습니다.</td>
                </tr>
              ) : quotes.map(q => (
                <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td data-label="접수 일시" style={{ padding: '16px', color: '#0f172a', fontSize: '14px' }}>{new Date(q.createdAt).toLocaleDateString()}</td>
                  <td data-label="진행 상태" style={{ padding: '16px' }}>{getStatusBadge(q.status)}</td>
                  <td data-label="오픈 지역" style={{ padding: '16px', color: '#0f172a', fontWeight: 'bold' }}>{q.region}</td>
                  <td data-label="오픈 시기" style={{ padding: '16px', color: '#64748b' }}>{q.expectedDate}</td>
                  <td data-label="고객 정보" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
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
                  <td data-label="필요 기구" style={{ padding: '16px', color: '#0f172a', fontSize: '13px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={summarizeEquipments(q.equipments)}>
                    {summarizeEquipments(q.equipments)}
                  </td>
                  <td data-label="도면 보기" style={{ padding: '16px' }}>
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
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
          <div className="modal-content" style={{ width: '100%', maxWidth: '1000px', height: '90vh', background: 'white', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
        </div>
      )}
    </div>
  );
}
