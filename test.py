import json
from pathlib import Path


def sync_gourmet_map():
    # test.py が置いてあるフォルダ（my-gourmet-map）のパスを自動取得
    base_path = Path(__file__).resolve().parent
    json_path = base_path / "data.json"
    images_dir = base_path / "images"

    # data.json が見つからない場合の詳細エラー表示
    if not json_path.exists():
        print(f"❌ エラー: 以下の場所に data.json が見つかりませんでした:")
        print(f"   {json_path}")
        return

    # 1. JSONファイルを読み込んで、すべての "photos" 内の文字列を収集
    with open(json_path, "r", encoding="utf-8") as f:
        json_data = json.load(f)

    json_photo_paths = set()

    def extract_photos(data):
        if isinstance(data, dict):
            for key, value in data.items():
                if key == "photos" and isinstance(value, list):
                    for photo_path in value:
                        # Windowsの「\」対策として「/」に統一
                        json_photo_paths.add(photo_path.replace("\\", "/"))
                else:
                    extract_photos(value)
        elif isinstance(data, list):
            for item in data:
                extract_photos(item)

    extract_photos(json_data)

    # 2. images フォルダ内の全画像ファイルを検索
    image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    actual_photo_paths = set()

    if images_dir.exists():
        for file in images_dir.rglob("*"):
            if file.is_file() and file.suffix.lower() in image_extensions:
                # 相対パス（例: "images/札幌市/xxx.jpg"）を作成
                relative_path = file.relative_to(base_path).as_posix()
                actual_photo_paths.add(relative_path)
    else:
        print(f"⚠️ 警告: images フォルダが見つかりません ({images_dir})")

    # 3. 照合結果の表示
    print("--- 🔍 照合チェック結果 ---")
    print(f"実体がある画像ファイル数: {len(actual_photo_paths)}")
    print(f"JSONに登録されているパス数: {len(json_photo_paths)}")
    print("-" * 35)

    # フォルダにあるが、JSONに未登録の画像
    missing_in_json = actual_photo_paths - json_photo_paths
    if missing_in_json:
        print(
            f"❌ フォルダにあるが、JSONに未登録の画像 ({len(missing_in_json)}件):"
        )
        for img in sorted(missing_in_json):
            print(f"  - {img}")
    else:
        print("✅ すべての画像ファイルがJSONに正しく登録されています！")

    # JSONに記載があるが、ファイルが存在しない画像
    missing_in_folder = json_photo_paths - actual_photo_paths
    if missing_in_folder:
        print(
            f"\n❌ JSONに記載があるが、ファイルが存在しない画像 ({len(missing_in_folder)}件):"
        )
        for img in sorted(missing_in_folder):
            print(f"  - {img}")


# 実行
if __name__ == "__main__":
    sync_gourmet_map()