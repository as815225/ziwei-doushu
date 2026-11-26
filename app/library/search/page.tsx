import { Suspense } from 'react';
import SearchResults from './SearchResults';

export const metadata = {
  title: '搜索 · 古籍原典库',
};

export default function SearchPage() {
  return (
    <Suspense fallback={<p role="status">正在加载搜索结果…</p>}>
      <SearchResults />
    </Suspense>
  );
}
