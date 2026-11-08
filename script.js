// 💡 ご自身の外部JSONファイルのパスを指定してください
const JSON_FILE_PATH = 'data.json'; 

// 日付文字列（2026年7月11日）を比較可能なオブジェクトに変換する関数
function parseDate(dateStr) {
    if (!dateStr || dateStr.includes('--')) return new Date(0); // 日付が未設定のものは最古扱い
    const matches = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
    if (!matches) return new Date(0);
    return new Date(matches[1], matches[2] - 1, matches[3]);
}

// 💡 店舗データの中から「最も新しい訪問日」を見つける関数
function getLatestDate(shopObj) {
    const history = shopObj?.history;
    if (!history || history.length === 0) return new Date(0); // 履歴がない場合は最古扱い

    // 全ての履歴の日付をDateオブジェクトに変換
    const dates = history.map(item => parseDate(item.date));
    
    // その中から「最大値（＝最新の日付）」を返す
    return new Date(Math.max(...dates));
}

// 外部JSONデータを読み込んで並び替えるメイン処理
async function sortShopCards() {
    try {
        // 1. 外部JSONの取得
        const response = await fetch(JSON_FILE_PATH);
        if (!response.ok) throw new Error('JSONファイルの読み込みに失敗しました');
        const shopData = await response.json();

        // 2. 各エリア（shop-grid）ごとに処理
        document.querySelectorAll('.shop-grid').forEach(grid => {
            const cards = Array.from(grid.querySelectorAll('.shop-card'));

            // 3. 各店舗の「最新の訪問日」を基準にソート
            cards.sort((a, b) => {
                const shopA = a.dataset.shop;
                const shopB = b.dataset.shop;

                // 💡 getLatestDate関数を使って、履歴内の最新日付を取得
                const dateA = getLatestDate(shopData[shopA]);
                const dateB = getLatestDate(shopData[shopB]);

                // 新しい順（降順）
                return dateB - dateA;
            });

            // 4. 並び替えたカードを画面に再配置
            cards.forEach(card => grid.appendChild(card));
        });
    } catch (error) {
        console.error('エラーが発生しました:', error);
    }
}

// ページが読み込まれたら実行
document.addEventListener('DOMContentLoaded', sortShopCards);

document.addEventListener("DOMContentLoaded", () => {
    const tagButtons = document.querySelectorAll(".btn-tag");
    const shopCards = document.querySelectorAll(".shop-card");

    tagButtons.forEach(button => {
        button.addEventListener("click", () => {
            // ボタンの選択状態（ON/OFF）を切り替える
            button.classList.toggle("active");

            // 現在ON（active）になっているタグのdata-tag値を配列で取得
            const activeButtons = document.querySelectorAll(".btn-tag.active");
            const selectedTags = Array.from(activeButtons).map(btn => btn.getAttribute("data-tag"));

            shopCards.forEach(card => {
                // 店舗が持っている data-tags をスペースで区切って配列にする
                const cardTagsAttr = card.getAttribute("data-tags") || "";
                const cardTags = cardTagsAttr.split(" ").filter(t => t !== "");

                // 選択されたすべてのタグが、その店舗のカードに含まれているか判定
                // （何も選択されていない場合は true になり、すべて表示される）
                const isMatch = selectedTags.every(tag => cardTags.includes(tag));

                if (selectedTags.length === 0 || isMatch) {
                    card.style.display = "block"; // 条件に合うので表示
                } else {
                    card.style.display = "none";  // 非表示
                }
            });
        });
    });
});

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

    // 2. カード生成完了後に、絞り込み機能を初期化
    initTagFilters();
  });

// 絞り込み機能の関数
function initTagFilters() {
  const buttons = document.querySelectorAll('.btn-tag');

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTag = button.getAttribute('data-tag');
      
      // アクティブ状態の切り替え（見た目）
      button.classList.toggle('active');

      // 全カード（旧仕様div / 新仕様shop-cardの両方）を取得して判定
      const cards = document.querySelectorAll('.shop-card');

      cards.forEach(card => {
        const cardTags = card.getAttribute('data-tags') || '';
        const tagArray = cardTags.split(',').map(t => t.trim());

        // 該当するタグが含まれているかチェック
        if (targetTag === '' || tagArray.includes(targetTag)) {
          card.style.display = ''; // 表示
        } else {
          card.style.display = 'none'; // 非表示
        }
      });
    });
  });
}

// リセットボタンの処理を初期化する関数
function initResetButton() {
  const resetButton = document.getElementById('btn-reset');
  if (!resetButton) return;

  resetButton.addEventListener('click', () => {
    // 1. すべてのタグボタンから active クラスを外す（✅も消える）
    document.querySelectorAll('.btn-tag').forEach(button => {
      button.classList.remove('active');
    });

    // 2. すべての店舗カードを再表示する
    document.querySelectorAll('.shop-card').forEach(card => {
      card.style.display = '';
    });
  });
}

// ページ読み込み完了時にリセット処理をセット
document.addEventListener('DOMContentLoaded', initResetButton);