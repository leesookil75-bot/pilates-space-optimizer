'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const EditorCanvas = dynamic(() => import('@/components/Editor/EditorCanvas'), { ssr: false });

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'quotes' | 'partners' | 'settings'>('quotes');
  const [settings, setSettings] = useState<any>(null);
  
  // Floor plan viewer state
  const [viewingQuote, setViewingQuote] = useState<any | null>(null);

  const [teaserModalOpen, setTeaserModalOpen] = useState(false);
  const [selectedQuoteForTeaser, setSelectedQuoteForTeaser] = useState<any | null>(null);
  const [teaserEmails, setTeaserEmails] = useState('');
  const [teaserType, setTeaserType] = useState<'equipment' | 'interior'>('equipment');
  const [sendingTeaser, setSendingTeaser] = useState(false);

  // Estimates Modal state
  const [estimatesModalOpen, setEstimatesModalOpen] = useState(false);
  const [selectedQuoteEstimates, setSelectedQuoteEstimates] = useState<any[]>([]);
  const [fetchingEstimates, setFetchingEstimates] = useState(false);
  const [viewingEstimateQuoteId, setViewingEstimateQuoteId] = useState('');

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
      
      const partnerRes = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'get' })
      });
      const partnerData = await partnerRes.json();
      
      const settingsRes = await fetch('/api/admin/settings');
      const settingsData = await settingsRes.json();
      
      if (res.ok) {
        setIsAuthenticated(true);
        setQuotes(data.quotes || []);
        setPartners(partnerData.partners || []);
        setSettings(settingsData);
      } else {
        setError('비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      setError('서버 통신 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm('설정을 저장하시겠습니까?')) return;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, settings })
      });
      if (res.ok) {
        alert('설정이 성공적으로 저장되었습니다.');
      } else {
        alert('설정 저장 실패');
      }
    } catch (err) {
      alert('오류 발생');
    }
  };

  const handleChargeCoins = async (partnerId: string, currentCoins: number) => {
    const amountStr = prompt(`현재 보유 코인: ${currentCoins || 0}개\n추가하거나 차감할 코인 개수를 입력하세요. (차감하려면 - 붙이기)\n예: 1000`);
    if (!amountStr) return;
    
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount)) {
      alert('숫자만 입력해 주세요.');
      return;
    }

    try {
      const res = await fetch('/api/admin/partners/coin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, partnerDocId: partnerId, amount })
      });
      if (res.ok) {
        setPartners(prev => prev.map(p => p.id === partnerId ? { ...p, coins: (p.coins || 0) + amount } : p));
        alert('코인이 업데이트 되었습니다.');
      } else {
        alert('코인 업데이트 실패');
      }
    } catch (err) {
      alert('서버 통신 오류');
    }
  };

  const handleViewEstimates = async (quoteId: string) => {
    setEstimatesModalOpen(true);
    setFetchingEstimates(true);
    setViewingEstimateQuoteId(quoteId);
    setSelectedQuoteEstimates([]);

    try {
      const res = await fetch(`/api/admin/quotes/estimates?quoteId=${quoteId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedQuoteEstimates(data.estimates || []);
      } else {
        alert(data.error || '견적 내역을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      alert('서버 통신 오류');
    } finally {
      setFetchingEstimates(false);
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

  const handlePartnerStatusChange = async (partnerId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'updateStatus', partnerId, newStatus })
      });
      if (res.ok) {
        setPartners(prev => prev.map(p => p.id === partnerId ? { ...p, status: newStatus } : p));
      } else {
        alert('파트너 상태 업데이트 실패');
      }
    } catch (error) {
      alert('파트너 상태 업데이트 오류');
    }
  };

  const handleSendTeaserEmail = async () => {
    if (!teaserEmails.trim()) {
      alert('발송할 이메일 주소를 입력해주세요.');
      return;
    }

    setSendingTeaser(true);
    // Parse emails (comma or newline separated)
    const emailsList = teaserEmails
      .split(/[\n,]+/)
      .map(e => e.trim())
      .filter(e => e && e.includes('@'));

    if (emailsList.length === 0) {
      alert('유효한 이메일 주소가 없습니다.');
      setSendingTeaser(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/send-teaser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          password, 
          quoteId: selectedQuoteForTeaser.id, 
          targetEmails: emailsList,
          teaserType
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert(`${emailsList.length}건의 영업 이메일 발송이 완료되었습니다!`);
        setTeaserModalOpen(false);
        setTeaserEmails('');
      } else {
        alert(data.error || '발송 실패');
      }
    } catch (error) {
      alert('서버 통신 오류');
    } finally {
      setSendingTeaser(false);
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

  const getPartnerStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return { bg: '#fef08a', color: '#854d0e', label: '승인 대기' };
      case 'approved': return { bg: '#dcfce3', color: '#166534', label: '승인 완료' };
      case 'rejected': return { bg: '#fee2e2', color: '#991b1b', label: '반려됨' };
      default: return { bg: '#f3f4f6', color: '#4b5563', label: '알 수 없음' };
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
            onClick={() => { setIsAuthenticated(false); setPassword(''); setQuotes([]); setPartners([]); }}
            style={{ padding: '8px 16px', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
          >
            로그아웃
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button 
            onClick={() => setActiveTab('quotes')}
            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'quotes' ? '#111827' : 'white', color: activeTab === 'quotes' ? 'white' : '#4b5563', boxShadow: activeTab === 'quotes' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            📋 견적 요청 관리
          </button>
          <button 
            onClick={() => setActiveTab('partners')}
            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'partners' ? '#111827' : 'white', color: activeTab === 'partners' ? 'white' : '#4b5563', boxShadow: activeTab === 'partners' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            🤝 제휴사 파트너 관리
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'settings' ? '#111827' : 'white', color: activeTab === 'settings' ? 'white' : '#4b5563', boxShadow: activeTab === 'settings' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            ⚙️ 시스템 설정
          </button>
        </div>

        {activeTab === 'settings' ? (
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '32px', maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>플랫폼 전역 설정</h2>
            {settings && (
              <form onSubmit={handleUpdateSettings}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>무통장 입금 은행명</label>
                  <input 
                    type="text" 
                    value={settings.bankName}
                    onChange={e => setSettings({...settings, bankName: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>계좌번호</label>
                  <input 
                    type="text" 
                    value={settings.bankAccount}
                    onChange={e => setSettings({...settings, bankAccount: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>예금주</label>
                  <input 
                    type="text" 
                    value={settings.bankOwner}
                    onChange={e => setSettings({...settings, bankOwner: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>연락처 및 상세 도면 열람 차감 코인 (기본: 20000)</label>
                  <input 
                    type="number" 
                    value={settings.unlockCost}
                    onChange={e => setSettings({...settings, unlockCost: parseInt(e.target.value) || 0})}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>견적서만 이메일 발송 차감 코인 (기본: 5000)</label>
                  <input 
                    type="number" 
                    value={settings.estimateCost || 5000}
                    onChange={e => setSettings({...settings, estimateCost: parseInt(e.target.value) || 0})}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>알림 수신 이메일 주소 (입점/충전 알림용)</label>
                  <input 
                    type="email" 
                    value={settings.adminEmail || ''}
                    onChange={e => setSettings({...settings, adminEmail: e.target.value})}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <div style={{ marginBottom: '32px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>오더 자동 만료 기간 (일 단위, 기본: 30)</label>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px 0' }}>설정된 기간이 지나거나, 상태가 '계약 완료' 등으로 변경되면 개인정보가 블라인드 처리됩니다.</p>
                  <input 
                    type="number" 
                    value={settings.expireDays || 30}
                    onChange={e => setSettings({...settings, expireDays: parseInt(e.target.value) || 0})}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <button type="submit" style={{ background: '#3b82f6', color: 'white', fontWeight: 'bold', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', width: '100%' }}>
                  설정 저장하기
                </button>
              </form>
            )}
          </div>
        ) : activeTab === 'quotes' ? (
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
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>관리 기능</th>
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
                  <td data-label="관리 기능" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => setViewingQuote(q)}
                        style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        도면
                      </button>
                      <button 
                        onClick={() => { setSelectedQuoteForTeaser(q); setTeaserModalOpen(true); }}
                        style={{ background: '#ec4899', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        📧 영업 발송
                      </button>
                      <button 
                        onClick={() => handleViewEstimates(q.id)}
                        style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        📄 접수된 견적
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        ) : (
        <div className="responsive-table" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f3f4f6' }}>
              <tr>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>가입 신청일</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>상태 관리</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>업체명 (상호)</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>담당자 성함</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>연락처</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>사업자등록번호</th>
                <th style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '14px' }}>보유 코인 (충전)</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>가입한 파트너가 없습니다.</td>
                </tr>
              ) : partners.map(p => {
                const partnerColor = getPartnerStatusColor(p.status);
                return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td data-label="가입 신청일" style={{ padding: '16px', color: '#111827', fontSize: '14px' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td data-label="상태 관리" style={{ padding: '16px' }}>
                    <select 
                      value={p.status}
                      onChange={(e) => handlePartnerStatusChange(p.id, e.target.value)}
                      style={{ 
                        padding: '6px 12px', 
                        borderRadius: '20px', 
                        border: 'none', 
                        fontSize: '13px', 
                        fontWeight: 'bold', 
                        cursor: 'pointer',
                        background: partnerColor.bg,
                        color: partnerColor.color,
                        outline: 'none',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        minWidth: '100px'
                      }}
                    >
                      <option value="pending">🟡 승인 대기</option>
                      <option value="approved">🟢 승인 완료</option>
                      <option value="rejected">🔴 반려됨</option>
                    </select>
                  </td>
                  <td data-label="업체명" style={{ padding: '16px', color: '#111827', fontWeight: 500 }}>{p.companyName} ({p.partnerId})</td>
                  <td data-label="담당자 성함" style={{ padding: '16px', color: '#111827' }}>{p.contactName}</td>
                  <td data-label="연락처" style={{ padding: '16px', color: '#111827' }}>{p.phone}</td>
                  <td data-label="사업자등록번호" style={{ padding: '16px', color: '#111827' }}>{p.businessNumber || '-'}</td>
                  <td data-label="보유 코인" style={{ padding: '16px', color: '#111827' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>{p.coins || 0}</span>
                      <button 
                        onClick={() => handleChargeCoins(p.id, p.coins || 0)}
                        style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        수동충전
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        )}
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
        </div>
      )}

      {/* Teaser Email Modal */}
      {teaserModalOpen && selectedQuoteForTeaser && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', margin: '0 0 16px 0' }}>영업용 티저 이메일 발송</h2>
            <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '24px', lineHeight: 1.5 }}>
              <strong>{selectedQuoteForTeaser.region}</strong> 오더의 일부 정보를 미끼로 활용하여,<br/>
              아직 가입하지 않은 잠재 제휴사들의 가입을 유도합니다.<br/>
              (고객 연락처와 상세 도면은 이메일에 포함되지 않습니다.)
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>
                발송 목적 (타겟 업체)
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="teaserType" 
                    value="equipment" 
                    checked={teaserType === 'equipment'} 
                    onChange={() => setTeaserType('equipment')} 
                  />
                  <span>기구 견적 업체용</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="teaserType" 
                    value="interior" 
                    checked={teaserType === 'interior'} 
                    onChange={() => setTeaserType('interior')} 
                  />
                  <span>인테리어 시공 업체용</span>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>
                수신 대상 이메일 주소
              </label>
              <textarea 
                value={teaserEmails}
                onChange={(e) => setTeaserEmails(e.target.value)}
                placeholder="발송할 이메일 주소를 콤마(,) 또는 줄바꿈으로 구분하여 여러 개 입력하세요."
                style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                * 숨은참조(BCC)로 한 번에 발송되므로 수신자들은 서로의 주소를 볼 수 없습니다.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setTeaserModalOpen(false)}
                disabled={sendingTeaser}
                style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', color: '#374151', fontWeight: 'bold', cursor: 'pointer' }}
              >
                취소
              </button>
              <button 
                onClick={handleSendTeaserEmail}
                disabled={sendingTeaser}
                style={{ flex: 2, padding: '12px', background: '#ec4899', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                {sendingTeaser ? '발송 중...' : '🚀 이메일 일괄 발송하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estimates Modal */}
      {estimatesModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f3f4f6', paddingBottom: '16px', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#111827' }}>접수된 견적 내역</h2>
              <button 
                onClick={() => setEstimatesModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', color: '#9ca3af', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {fetchingEstimates ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>
                데이터를 불러오는 중입니다...
              </div>
            ) : selectedQuoteEstimates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280', background: '#f9fafb', borderRadius: '8px' }}>
                아직 이 오더에 접수된 견적이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedQuoteEstimates.map(est => (
                  <div key={est.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: '16px' }}>{est.partnerName}</h3>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>접수일시: {new Date(est.createdAt).toLocaleString()}</div>
                      </div>
                      <div style={{ background: '#fef3c7', color: '#d97706', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '15px' }}>
                        {est.price ? `${parseInt(est.price).toLocaleString()} 원` : '금액 미기재'}
                      </div>
                    </div>
                    
                    <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', color: '#334155', minHeight: '60px', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                      {est.message || '작성된 어필 메시지가 없습니다.'}
                    </div>

                    <a 
                      href={est.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ display: 'inline-block', background: '#3b82f6', color: 'white', padding: '10px 16px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}
                    >
                      📎 견적서 파일 확인 (PDF/JPG)
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
