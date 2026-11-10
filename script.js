// 💡 ご自身の外部JSONファイルのパスを指定してください
const JSON_FILE_PATH = 'data.json'; 

// 日付文字列（2026年7月11日）を比較可能なオブジェクトに変換する関数
function parseDate(dateStr) {
    if (!dateStr || dateStr.includes('--')) return new Date(0);
    const matches = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
    if (!matches) return new Date(0);
    return new Date(matches[1], matches[2] - 1, matches[3]);
}

// 店舗データの中から「最も新しい訪問日」を見つける関数
function getLatestDate(shopObj) {
    const history = shopObj?.history;
    if (!history || history.length === 0) return new Date(0);
    const dates = history.map(item => parseDate(item.date));
    return new Date(Math.max(...dates));
}

// 外部JSONデータを読み込んで並び替えるメイン処理
async function sortShopCards() {
    try {
        const response = await fetch(JSON_FILE_PATH);
        if (!response.ok) throw new Error('JSONファイルの読み込みに失敗しました');
        const shopData = await response.json();

        document.querySelectorAll('.shop-grid').forEach(grid => {
            const cards = Array.from(grid.querySelectorAll('.shop-card'));

            cards.sort((a, b) => {
                const shopA = a.dataset.shop;
                const shopB = b.dataset.shop;
                const dateA = getLatestDate(shopData[shopA]);
                const dateB = getLatestDate(shopData[shopB]);
                return dateB - dateA;
            });

            cards.forEach(card => grid.appendChild(card));
        });
    } catch (error) {
        console.error('エラーが発生しました:', error);
    }
}

document.addEventListener('DOMContentLoaded', sortShopCards);

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

// JSONを読み込んでカードを生成した後に、絞り込みイベントを設定する
fetch('data.json')
  .then(res => res.json())
  .then(shops => {

    // 1. カスタムエレメントの定義・登録
    class ShopCard extends HTMLElement {
      connectedCallback() {
        const shopId = this.getAttribute('shop');
        const rawTags = this.getAttribute('tags') || '';
        const shop = shops[shopId];

        if (!shop) return;

        const tagKeys = rawTags.split(',').map(t => t.trim()).filter(Boolean);
        const tagsHtml = tagKeys
          .map(key => `<span class="tag">${TAG_MAP[key] || key}</span>`)
          .join('');

        this.classList.add('shop-card');
        this.setAttribute('data-shop', shopId);
        this.setAttribute('data-tags', rawTags);

        this.innerHTML = `
          <div class="shop-image-placeholder">📷 メイン写真</div>
          <div class="shop-info">
            <a href="zukan.html?shop=${shopId}" target="_blank" style="text-decoration: none;">
              <h3 class="shop-name">${shop.name}</h3>
            </a>
            <div class="shop-tags">${tagsHtml}</div>
          </div>
        `;
      }
    }

    if (!customElements.get('shop-card')) {
      customElements.define('shop-card', ShopCard);
    }

    initTagFilters();
  });

// 絞り込み機能の関数
function initTagFilters() {
  const buttons = document.querySelectorAll('.btn-tag');

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTag = button.getAttribute('data-tag');
      
      button.classList.toggle('active');

      const cards = document.querySelectorAll('.shop-card');

      cards.forEach(card => {
        const cardTags = card.getAttribute('data-tags') || '';
        const tagArray = cardTags.split(',').map(t => t.trim());

        if (targetTag === '' || tagArray.includes(targetTag)) {
          card.style.display = ''; 
        } else {
          card.style.display = 'none'; 
        }
      });
    });
  });
}

// リセットボタンの処理
function initResetButton() {
  const resetButton = document.getElementById('btn-reset');
  if (!resetButton) return;

  resetButton.addEventListener('click', () => {
    document.querySelectorAll('.btn-tag').forEach(button => {
      button.classList.remove('active');
    });

    document.querySelectorAll('.shop-card').forEach(card => {
      card.style.display = '';
    });
  });
}

document.addEventListener('DOMContentLoaded', initResetButton);