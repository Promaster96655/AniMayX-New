import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, BookOpen, ExternalLink, ArrowLeft } from 'lucide-react';
import { apiGet } from '../lib/apiClient';
import type { MangaDexItem } from '../lib/types';
import { MediaCard } from '../components/MediaCard';
import { PosterGridSkeleton } from '../components/Skeletons';

interface MangaChapter {
  id: string;
  chapter: string;
  volume: string;
  title: string;
  pages: number;
  language: string;
  externalUrl: string | null;
  readableInApp: boolean;
}

export function MangaBrowsePage() {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('en');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MangaDexItem[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set('q', query.trim());
    if (language) params.set('language', language);

    apiGet<{ items: MangaDexItem[] }>(`/api/manga/discover?${params.toString()}`)
      .then((res) => {
        if (active) setItems(res.items || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, language, page]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">Manga</h1>
        <p className="text-sm text-[#A0A0A0] mt-1">
          Discover and read compatible chapters via the official MangaDex v5 API
        </p>
      </div>

      <div className="rounded-xl bg-[#121212] border border-white/10 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-[#A0A0A0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search manga title..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white focus:outline-none focus:border-[#FF6A00]"
          />
        </div>

        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg bg-[#080808] border border-white/12 text-sm text-white"
        >
          <option value="en">Language: English</option>
          <option value="ja">Language: Japanese</option>
          <option value="es">Language: Spanish</option>
          <option value="fr">Language: French</option>
          <option value="ko">Language: Korean</option>
        </select>
      </div>

      {loading ? (
        <PosterGridSkeleton count={10} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
          {items.map((m) => (
            <MediaCard
              key={m.id}
              to={`/manga/${m.id}`}
              title={m.title}
              subtitle={m.tags.slice(0, 2).join(' · ')}
              imageUrl={m.coverUrl}
              metaItems={[m.status, m.year]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MangaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [language, setLanguage] = useState('en');
  const [item, setItem] = useState<MangaDexItem | null>(null);
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [loading, setLoading] = useState(true);

  const [readingChapter, setReadingChapter] = useState<MangaChapter | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGet<{ item: MangaDexItem; chapters: MangaChapter[] }>(`/api/manga/${id}?language=${language}`)
      .then((res) => {
        setItem(res.item);
        setChapters(res.chapters || []);
      })
      .finally(() => setLoading(false));
  }, [id, language]);

  const openChapter = async (ch: MangaChapter) => {
    if (!ch.readableInApp) return;
    setReadingChapter(ch);
    setLoadingPages(true);
    try {
      const res = await apiGet<{ available: boolean; pages: string[] }>(`/api/manga/chapter/${ch.id}/pages`);
      setPages(res.available ? res.pages : []);
    } finally {
      setLoadingPages(false);
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-16 text-sm text-[#A0A0A0]">Loading manga details...</div>;
  }
  if (!item) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-sm text-[#A0A0A0]">Manga not found.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-10">
      {readingChapter ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/8 pb-4">
            <button
              type="button"
              onClick={() => {
                setReadingChapter(null);
                setPages([]);
              }}
              className="inline-flex items-center gap-2 text-sm text-[#FF6A00] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Chapters
            </button>
            <p className="text-sm font-medium text-white">
              Chapter {readingChapter.chapter} {readingChapter.title ? `— ${readingChapter.title}` : ''}
            </p>
          </div>

          {loadingPages ? (
            <p className="text-sm text-[#A0A0A0] text-center py-12">Loading chapter pages...</p>
          ) : pages.length === 0 ? (
            <p className="text-sm text-[#A0A0A0] text-center py-12">
              No reader pages returned for this chapter.
            </p>
          ) : (
            <div className="max-w-3xl mx-auto space-y-2">
              {pages.map((src, idx) => (
                <img
                  key={src}
                  src={src}
                  alt={`Page ${idx + 1}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full rounded bg-[#121212]"
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-48 shrink-0">
              <img
                src={item.coverUrl}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="w-full aspect-[2/3] object-cover rounded-xl bg-[#121212] border border-white/10"
              />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-xs font-medium text-[#FF6A00] capitalize">
                  MangaDex · {item.status} {item.year ? `· ${item.year}` : ''}
                </p>
                <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white mt-1">
                  {item.title}
                </h1>
              </div>
              <p className="text-sm text-[#A0A0A0] leading-relaxed whitespace-pre-line">
                {item.description || 'No description provided.'}
              </p>
              <div className="text-xs text-[#A0A0A0]">
                Tags: {item.tags.join(', ') || 'None'} · Available Translations:{' '}
                {item.availableLanguages.slice(0, 12).join(', ').toUpperCase()}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-xl font-bold text-white">Chapters</h2>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-9 px-3 rounded-lg bg-[#121212] border border-white/12 text-xs text-white"
              >
                <option value="en">English</option>
                <option value="ja">Japanese</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>

            {chapters.length === 0 ? (
              <div className="rounded-xl bg-[#121212] border border-white/8 p-6 text-sm text-[#A0A0A0]">
                No chapters found for the selected language.
              </div>
            ) : (
              <div className="divide-y divide-white/8 rounded-xl bg-[#121212] border border-white/10">
                {chapters.map((ch) => (
                  <div key={ch.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        Chapter {ch.chapter} {ch.title ? `— ${ch.title}` : ''}
                      </p>
                      <p className="text-xs text-[#A0A0A0] font-mono tabular-nums">
                        {ch.language.toUpperCase()} · {ch.pages} pages
                      </p>
                    </div>
                    {ch.readableInApp ? (
                      <button
                        type="button"
                        onClick={() => openChapter(ch)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF6A00] hover:bg-[#FF7E24] text-black text-xs font-semibold shrink-0"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Read
                      </button>
                    ) : ch.externalUrl ? (
                      <a
                        href={ch.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-xs text-white hover:border-[#FF6A00] shrink-0"
                      >
                        Official Publisher <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-[#A0A0A0]">Unavailable</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
