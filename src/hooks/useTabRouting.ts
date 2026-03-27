import { useState } from 'react';

export function useTabRouting() {
  const [productTab, setProductTab] = useState<'board' | 'quality'>('board');

  return { productTab, setProductTab };
}
