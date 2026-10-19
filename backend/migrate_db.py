import sqlite3
import os

DB_PATH = 'portfolio.db'

def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found. No migration needed.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    columns_to_add = [
        ("is_verified", "BOOLEAN DEFAULT 0"),
        ("email_verification_code", "VARCHAR"),
        ("email_verification_expires", "DATETIME"),
        ("mfa_code", "VARCHAR"),
        ("mfa_expires", "DATETIME")
    ]

    for col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            print(f"[OK] Added column: {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"[INFO] Column already exists: {col_name}")
            else:
                print(f"[ERROR] Error adding {col_name}: {e}")

    # Sentiment columns on news_articles
    news_sentiment_cols = [
        ("sentiment_score", "REAL"),
        ("sentiment_label", "VARCHAR"),
        ("catalysts", "VARCHAR"),
        ("sentiment_reasoning", "VARCHAR"),
        ("sentiment_analyzed_at", "DATETIME")
    ]
    for col_name, col_type in news_sentiment_cols:
        try:
            cursor.execute(f"ALTER TABLE news_articles ADD COLUMN {col_name} {col_type}")
            print(f"[OK] Added news_articles column: {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"[INFO] Column already exists in news_articles: {col_name}")
            else:
                print(f"[ERROR] Error adding news_articles {col_name}: {e}")

    # Set existing users to verified so you can log in to your old account
    try:
        cursor.execute("UPDATE users SET is_verified = 1")
        print("[OK] Set existing users to verified=True.")
    except Exception as e:
        print(f"[ERROR] Error updating users: {e}")

    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS news_articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url_hash VARCHAR UNIQUE NOT NULL,
                title VARCHAR NOT NULL,
                summary VARCHAR,
                source VARCHAR NOT NULL,
                url VARCHAR NOT NULL,
                image_url VARCHAR,
                published_at DATETIME,
                tickers VARCHAR,
                sector VARCHAR,
                fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("[OK] Created news_articles table.")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_news_articles_url_hash ON news_articles (url_hash)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_news_articles_published_at ON news_articles (published_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_news_articles_sector ON news_articles (sector)")
    except Exception as e:
        print(f"[ERROR] Error creating news_articles: {e}")

    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == '__main__':
    migrate()
