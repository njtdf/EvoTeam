// rss.js - Feature 9: RSS 每日新闻
// 多源 RSS 抓取 + 内存缓存(TTL 1h) + 降级处理
// Cordis-shaped: 导出 apply(ctx, config),W1 由 server.js 直接 import

import RSSParser from 'rss-parser'

const parser = new RSSParser({ timeout: 10000 })

// 默认订阅源(arXiv 国内可直连;IEEE Spectrum 可能需代理)
const DEFAULT_FEEDS = [
  { name: 'arXiv cs.AI', url: 'http://export.arxiv.org/rss/cs.AI' },
  { name: 'arXiv eess.SP', url: 'http://export.arxiv.org/rss/eess.SP' },
  { name: 'arXiv cs.SE', url: 'http://export.arxiv.org/rss/cs.SE' },
  { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/feeds/feed.rss' },
]

// 内存缓存
let cache = { items: [], fetchedAt: 0 }
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// --- 抓取单个 feed,降级返回空 ---
async function fetchFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url)
    return (parsed.items || []).map(item => ({
      title: item.title || '',
      link: item.link || '',
      pubDate: item.pubDate || item.isoDate || '',
      source: feed.name,
    }))
  } catch (e) {
    console.error(`[rss] fetch failed: ${feed.name} - ${e.message}`)
    return []
  }
}

// --- 并行抓取所有 feeds,按日期降序 ---
export async function getAllFeeds() {
  const results = await Promise.allSettled(DEFAULT_FEEDS.map(f => fetchFeed(f)))
  const items = []
  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value)
  }
  items.sort((a, b) => {
    const da = new Date(a.pubDate || 0).getTime() || 0
    const db = new Date(b.pubDate || 0).getTime() || 0
    return db - da
  })
  return items
}

// --- 获取最新 N 条(带缓存) ---
export async function getLatestNews(limit = 10) {
  const now = Date.now()
  if (cache.items.length > 0 && (now - cache.fetchedAt) < CACHE_TTL) {
    return cache.items.slice(0, limit)
  }
  const items = await getAllFeeds()
  cache = { items, fetchedAt: now }
  return items.slice(0, limit)
}

// --- Cordis 形态(W3 接入 runtime) ---
export function apply(ctx, config = {}) {
  ctx.service('rss', {
    latest: (limit) => getLatestNews(limit),
    feeds: () => getAllFeeds(),
  })
  ctx.on('ready', () => {
    ctx.logger?.info?.('rss plugin ready')
  })
}

export default { getLatestNews, getAllFeeds, apply }