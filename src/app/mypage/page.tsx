'use client';

import { useSession, signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Clock, Package, ArrowRight } from 'lucide-react';

interface Estimate {
  id: string;
  partnerId: string;
  partnerName: string;
  price: string | null;
  message: string;
  fileUrl: string;
  isRead: boolean;
  createdAt: any;
}

interface QuoteRequest {
  id: string;
  region: string;
  expectedDate: string;
  status: string;
  createdAt: string;
  estimatesSent?: string[];
  estimates?: Estimate[];
}

export default function MyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      signIn('kakao');
    }
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchMyQuotes();
    }
  }, [status]);

  const fetchMyQuotes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/quotes/my-quotes');
      if (res.ok) {
        const data = await res.json();
        setQuotes(data.quotes || []);
      }
    } catch (err) {
      console.error('Failed to fetch quotes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReadEstimate = async (estimate: Estimate) => {
    if (!estimate.isRead) {
      try {
        await fetch('/api/quotes/read-estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estimateId: estimate.id })
        });
        
        setQuotes(prev => prev.map(q => ({
          ...q,
          estimates: q.estimates?.map(e => e.id === estimate.id ? { ...e, isRead: true } : e)
        })));
        
        window.dispatchEvent(new Event('estimatesRead'));
      } catch (err) {
        console.error('Failed to mark read', err);
      }
    }
    window.open(estimate.fileUrl, '_blank');
  };

  if (status === 'loading' || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{
          border: '4px solid rgba(59, 130, 246, 0.2)',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          animation: 'spin 1s linear infinite'
        }}>
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '48px 16px' }}>
      <div style={{ maxWidth: '896px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#111827', margin: 0 }}>내 견적함 📦</h1>
            <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#4b5563', margin: '8px 0 0 0' }}>
              {session?.user?.name}님이 요청하신 필라테스 인테리어/기구 견적 진행 상황입니다.
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            style={{ color: '#2563eb', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
          >
            &larr; 도면 편집기로 돌아가기
          </button>
        </div>

        {quotes.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
            <Package style={{ margin: '0 auto 16px auto', height: '48px', width: '48px', color: '#9ca3af' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 500, color: '#111827', margin: 0 }}>접수된 견적이 없습니다</h3>
            <p style={{ marginTop: '8px', color: '#6b7280', margin: '8px 0 0 0' }}>도면을 그리고 첫 견적을 요청해 보세요!</p>
            <button
              onClick={() => router.push('/')}
              style={{ marginTop: '24px', display: 'inline-flex', alignItems: 'center', padding: '8px 16px', border: '1px solid transparent', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', fontSize: '0.875rem', fontWeight: 500, borderRadius: '6px', color: '#ffffff', backgroundColor: '#2563eb', cursor: 'pointer' }}
            >
              새 도면 시작하기
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {quotes.map((quote) => {
              const unreadCount = quote.estimates?.filter(e => !e.isRead).length || 0;
              const hasEstimates = quote.estimates && quote.estimates.length > 0;
              
              return (
                <div key={quote.id} style={{ backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.125rem', lineHeight: '1.5rem', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', margin: 0 }}>
                          {quote.region} 필라테스 오픈 건
                          {unreadCount > 0 && (
                            <span style={{ marginLeft: '12px', display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500, backgroundColor: '#fee2e2', color: '#991b1b' }}>
                              새 견적 {unreadCount}건
                            </span>
                          )}
                        </h3>
                        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#6b7280', gap: '16px' }}>
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            <Clock style={{ flexShrink: 0, marginRight: '6px', height: '16px', width: '16px', color: '#9ca3af' }} />
                            오픈예정: {quote.expectedDate}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            <FileText style={{ flexShrink: 0, marginRight: '6px', height: '16px', width: '16px', color: '#9ca3af' }} />
                            접수일: {new Date(quote.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 500,
                          backgroundColor: quote.status === '신규 접수' ? '#dbeafe' : quote.status === '분석 중' ? '#fef3c7' : hasEstimates ? '#d1fae5' : '#f3f4f6',
                          color: quote.status === '신규 접수' ? '#1e40af' : quote.status === '분석 중' ? '#92400e' : hasEstimates ? '#065f46' : '#1f2937'
                        }}>
                          {hasEstimates ? '견적 도착' : quote.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ padding: '20px 24px' }}>
                    {!hasEstimates ? (
                      <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <p style={{ color: '#6b7280', margin: 0 }}>파트너사들이 도면을 분석 중입니다. 조금만 기다려주세요!</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h4 style={{ fontWeight: 500, color: '#111827', margin: 0 }}>도착한 견적서 ({quote.estimates!.length}건)</h4>
                        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                          {quote.estimates!.map((est) => (
                            <div 
                              key={est.id} 
                              style={{
                                position: 'relative', borderRadius: '8px', border: est.isRead ? '1px solid #e5e7eb' : '1px solid #93c5fd', padding: '16px',
                                backgroundColor: est.isRead ? '#ffffff' : '#eff6ff', cursor: 'pointer', transition: 'box-shadow 0.2s',
                              }}
                              onClick={() => handleReadEstimate(est)}
                              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'}
                              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                            >
                              {!est.isRead && (
                                <span style={{ position: 'absolute', top: 0, right: 0, marginTop: '-8px', marginRight: '-8px', display: 'flex', height: '16px', width: '16px' }}>
                                  <span style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: '#f87171', opacity: 0.75, animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' }}></span>
                                  <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '16px', width: '16px', backgroundColor: '#ef4444' }}></span>
                                </span>
                              )}
                              <style>{`
                                @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
                              `}</style>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <h5 style={{ fontWeight: 700, color: '#111827', margin: 0 }}>{est.partnerName}</h5>
                                {est.price && <span style={{ color: '#2563eb', fontWeight: 700 }}>{est.price} 원</span>}
                              </div>
                              <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '12px', height: '40px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: '0 0 12px 0' }}>{est.message}</p>
                              <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#2563eb', fontWeight: 500 }}>
                                <FileText style={{ height: '16px', width: '16px', marginRight: '4px' }} />
                                첨부 견적서 열람
                                <ArrowRight style={{ height: '16px', width: '16px', marginLeft: '4px' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
