// 💡 外部JSONファイルのパス
const JSON_FILE_PATH = 'data.json';

// タグマスターデータ
const TAG_MAP = {
  "sapporo-saikyo-ramen": "🔥 札幌最強ラーメン決定戦",
  "asahikawa-son": "🐻 旭川食べなきゃ損",
  "sapporo-miso": "🌽 札幌味噌ラーメン",
  "ebetsu-son": "🧱 江別食べなきゃ損",
  "sapporo-ninki-ramen": "🥇 札幌人気ラーメン",
  "sapporo-chuka": "🥟 札幌町中華",
  "asahikawa-ramen": "🍜 旭川ラーメン",
  "sapporo-chahan": "🍚 札幌炒飯"
};

// 基本ジャンルボタンの補助判定（genre に無くても、このタグが付いていれば該当とみなす）
const GENRE_TAG_ALIAS = {
  "炒飯": ["sapporo-chahan"]
};

/* ---------- 共通ユーティリティ ---------- */

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// 「2026年7月11日」形式の日付を Date に変換
function parseDate(dateStr) {
  if (!dateStr || dateStr.includes('--')) return new Date(0);
  const matches = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
  if (!matches) return new Date(0);
  return new Date(matches[1], matches[2] - 1, matches[3]);
}

// 店舗データの中から「最も新しい訪問日」を返す
function getLatestDate(shop) {
  const history = shop?.history;
  if (!history || history.length === 0) return new Date(0);
  return new Date(Math.max(...history.map(item => parseDate(item.date))));
}

// 新しい訪問から順にたどって、最初に見つかった写真をカードのメイン写真にする
function getMainPhoto(shop) {
  const history = (shop?.history || []).slice()
    .sort((a, b) => parseDate(b.date) - parseDate(a.date));
  for (const item of history) {
    if (item.photos && item.photos.length > 0 && !item.photos[0].includes('★')) {
      return item.photos[0];
    }
  }
  return null;
}

function toGenreArray(genre) {
  if (Array.isArray(genre)) return genre.map(String);
  return genre ? [String(genre)] : [];
}

/* ---------- メイン処理 ---------- */

fetch(JSON_FILE_PATH)
  .then(res => {
    if (!res.ok) throw new Error('JSONファイルの読み込みに失敗しました');
    return res.json();
  })
  .then(shops => {
    // ➕ 各地域ごとの件数を集計して、それぞれのエリア見出しに表示
    const cityCounts = {};
    Object.values(shops).forEach(shop => {
      if (shop && shop.city) {
        cityCounts[shop.city] = (cityCounts[shop.city] || 0) + 1;
      }
    });

    document.querySelectorAll('.area-section').forEach(section => {
      const city = section.getAttribute('data-city');
      const countSpan = section.querySelector('.city-count');
      if (city && countSpan && cityCounts[city] !== undefined) {
        countSpan.textContent = `(${cityCounts[city]}件)`;
      }
    });

    // 1. 新しく訪れた順に並び替え（カードが描画される前に、属性だけで判定する）
    document.querySelectorAll('.shop-grid').forEach(grid => {
      const cards = Array.from(grid.querySelectorAll('shop-card'));
      cards.sort((a, b) =>
        getLatestDate(shops[b.getAttribute('shop')]) - getLatestDate(shops[a.getAttribute('shop')])
      );
      cards.forEach(card => grid.appendChild(card));
    });

    // 2. カスタムエレメントの定義・登録
    class ShopCard extends HTMLElement {
      connectedCallback() {
        const shopId = this.getAttribute('shop');
        const rawTags = this.getAttribute('tags') || '';
        const shop = shops[shopId];
        if (!shop) return;

        // 並び替えなどで再接続されても二重に描画しない
        if (this.dataset.rendered === shopId) return;
        this.dataset.rendered = shopId;

        const tagKeys = rawTags.split(',').map(t => t.trim()).filter(Boolean);
        const tagsHtml = tagKeys
          .map(key => `<span class="tag">${escapeHtml(TAG_MAP[key] || key)}</span>`)
          .join('');

        this.classList.add('shop-card');
        this.setAttribute('data-shop', shopId);
        this.setAttribute('data-tags', rawTags);
        this.setAttribute('data-genre', toGenreArray(shop.genre).join('|'));

        const photo = getMainPhoto(shop);
        const imageHtml = photo
          ? `<img class="shop-image" src="${escapeHtml(photo)}" alt="${escapeHtml(shop.name)}" loading="lazy">`
          : `<div class="shop-image-placeholder">📷 写真なし</div>`;

        // カード全体をリンクにして、スマホで押しやすくする
        this.innerHTML = `
          <a class="shop-link" href="zukan.html?shop=${encodeURIComponent(shopId)}">
            ${imageHtml}
            <div class="shop-info">
              <h3 class="shop-name">${escapeHtml(shop.name)}</h3>
              <div class="shop-tags">${tagsHtml}</div>
            </div>
          </a>
        `;

        // 写真が読み込めなかったときは、プレースホルダーに差し替える
        const img = this.querySelector('img.shop-image');
        if (img) {
          img.addEventListener('error', () => {
            const ph = document.createElement('div');
            ph.className = 'shop-image-placeholder';
            ph.textContent = '📷 写真なし';
            img.replaceWith(ph);
          }, { once: true });
        }
      }
    }

    if (!customElements.get('shop-card')) {
      customElements.define('shop-card', ShopCard);
    }

    initTagFilters();
  })
  .catch(error => {
    console.error('エラーが発生しました:', error);
    const main = document.querySelector('main');
    if (main) {
      const msg = document.createElement('p');
      msg.className = 'load-error';
      msg.textContent = '⚠️ data.json を読み込めませんでした。ファイルの場所と、サーバー経由で開いているか確認してください。';
      main.prepend(msg);
    }
  });

/* ---------- 絞り込み機能 ---------- */
// ・特製タグどうし、ジャンルどうしは「どれか1つでも該当」（OR）
// ・特製タグとジャンルを両方選んだときは「両方に該当」（AND）
function initTagFilters() {
  const activeTags = new Set();
  const activeGenres = new Set();
  const status = document.getElementById('filter-status');

  function matchesGenre(card, keyword) {
    const genres = (card.getAttribute('data-genre') || '').split('|');
    if (genres.some(g => g.includes(keyword))) return true;
    const aliasTags = GENRE_TAG_ALIAS[keyword] || [];
    const cardTags = (card.getAttribute('data-tags') || '').split(',').map(t => t.trim());
    return aliasTags.some(t => cardTags.includes(t));
  }

  function applyFilter() {
    const cards = document.querySelectorAll('.shop-card');
    const filtering = activeTags.size > 0 || activeGenres.size > 0;
    let visibleCount = 0;

    cards.forEach(card => {
      const cardTags = (card.getAttribute('data-tags') || '').split(',').map(t => t.trim());
      const tagOk = activeTags.size === 0 || [...activeTags].some(t => cardTags.includes(t));
      const genreOk = activeGenres.size === 0 || [...activeGenres].some(k => matchesGenre(card, k));
      const show = tagOk && genreOk;
      card.hidden = !show;
      if (show) visibleCount++;
    });

    // 該当するお店が1つもないエリアは、見出しごと隠す
    document.querySelectorAll('.area-section').forEach(section => {
      const hasVisible = section.querySelector('.shop-card:not([hidden])');
      section.hidden = filtering && !hasVisible;
      const grid = section.querySelector('.shop-grid');
      if (grid) grid.scrollLeft = 0;
    });

    if (status) {
      if (filtering) {
        status.hidden = false;
        status.textContent = visibleCount > 0
          ? `${visibleCount}件のお店を表示中`
          : '該当するお店がありません。条件を変えてみてください。';
      } else {
        status.hidden = true;
        status.textContent = '';
      }
    }
  }

  document.querySelectorAll('.btn-tag').forEach(button => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      const tag = button.getAttribute('data-tag');
      const genre = button.getAttribute('data-genre');
      const set = tag ? activeTags : activeGenres;
      const value = tag || genre;

      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      const isActive = set.has(value);
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
      applyFilter();
    });
  });

  const resetButton = document.getElementById('btn-reset');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      activeTags.clear();
      activeGenres.clear();
      document.querySelectorAll('.btn-tag').forEach(button => {
        button.classList.remove('active');
        button.setAttribute('aria-pressed', 'false');
      });
      applyFilter();
    });
  }
}

/* ---------- 先頭に戻るボタン ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const topButton = document.getElementById('btn-top');
  if (!topButton) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      topButton.hidden = window.scrollY < 600;
      ticking = false;
    });
  }, { passive: true });

  topButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});