import { useState } from 'react';

export type ProductTab = 'board' | 'quality' | 'release';

export function useTabRouting() {
  const [productTab, setProductTab] = useState<ProductTab>('board');

  return { productTab, setProductTab };
}
