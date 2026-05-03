'use client';

import { useSession, signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Clock, CheckCircle, Package, ArrowRight, X } from 'lucide-react';

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
  estimates?: Estimate[]; // Joined on client for display
}

export default function MyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      signIn('kakao');
    }
  }, [status]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchMyQuotes();
    }
  }, [session]);

  const fetchMyQuotes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/quotes/my-quotes');
      if (res.ok) {
        const data = await res.json();
        setQuotes(data.quotes);
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
        
        // Update local state to remove badge immediately
        setQuotes(prev => prev.map(q => ({
          ...q,
          estimates: q.estimates?.map(e => e.id === estimate.id ? { ...e, isRead: true } : e)
        })));
        
        // Dispatch custom event to update TopBar badge
        window.dispatchEvent(new Event('estimatesRead'));
      } catch (err) {
        console.error('Failed to mark read', err);
      }
    }
    
    // Open file
    window.open(estimate.fileUrl, '_blank');
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">내 견적함 📦</h1>
            <p className="mt-2 text-sm text-gray-600">
              {session?.user?.name}님이 요청하신 필라테스 인테리어/기구 견적 진행 상황입니다.
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            &larr; 도면 편집기로 돌아가기
          </button>
        </div>

        {quotes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">접수된 견적이 없습니다</h3>
            <p className="mt-2 text-gray-500">도면을 그리고 첫 견적을 요청해 보세요!</p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              새 도면 시작하기
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {quotes.map((quote) => {
              const unreadCount = quote.estimates?.filter(e => !e.isRead).length || 0;
              const hasEstimates = quote.estimates && quote.estimates.length > 0;
              
              return (
                <div key={quote.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg leading-6 font-semibold text-gray-900 flex items-center">
                        {quote.region} 필라테스 오픈 건
                        {unreadCount > 0 && (
                          <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            새 견적 {unreadCount}건
                          </span>
                        )}
                      </h3>
                      <div className="mt-1 flex items-center text-sm text-gray-500 space-x-4">
                        <span className="flex items-center">
                          <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          오픈예정: {quote.expectedDate}
                        </span>
                        <span className="flex items-center">
                          <FileText className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          접수일: {new Date(quote.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4 sm:mt-0 flex items-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        quote.status === '신규 접수' ? 'bg-blue-100 text-blue-800' : 
                        quote.status === '분석 중' ? 'bg-yellow-100 text-yellow-800' : 
                        hasEstimates ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {hasEstimates ? '견적 도착' : quote.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="px-6 py-5">
                    {!hasEstimates ? (
                      <div className="text-center py-6">
                        <p className="text-gray-500">파트너사들이 도면을 분석 중입니다. 조금만 기다려주세요!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 mb-3">도착한 견적서 ({quote.estimates!.length}건)</h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {quote.estimates!.map((est) => (
                            <div 
                              key={est.id} 
                              className={`relative rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer ${!est.isRead ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                              onClick={() => handleReadEstimate(est)}
                            >
                              {!est.isRead && (
                                <span className="absolute top-0 right-0 -mt-2 -mr-2 flex h-4 w-4">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                                </span>
                              )}
                              <div className="flex justify-between items-start mb-2">
                                <h5 className="font-bold text-gray-900">{est.partnerName}</h5>
                                {est.price && <span className="text-blue-600 font-bold">{est.price} 원</span>}
                              </div>
                              <p className="text-sm text-gray-600 line-clamp-2 mb-3 h-10">{est.message}</p>
                              <div className="flex items-center text-sm text-blue-600 font-medium">
                                <FileText className="h-4 w-4 mr-1" />
                                첨부 견적서 열람
                                <ArrowRight className="h-4 w-4 ml-1" />
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
