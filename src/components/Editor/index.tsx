'use client';
import dynamic from 'next/dynamic';

const EditorCanvas = dynamic(() => import('./EditorCanvas'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', color: '#888' }}>
      로딩 중... (Loading Editor...)
    </div>
  ),
});

export default EditorCanvas;
