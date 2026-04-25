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
            print(f"✅ Added column: {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"ℹ️ Column already exists: {col_name}")
            else:
                print(f"❌ Error adding {col_name}: {e}")

    # Set existing users to verified so you can log in to your old account
    try:
        cursor.execute("UPDATE users SET is_verified = 1")
        print("✅ Set existing users to verified=True.")
    except Exception as e:
        print(f"❌ Error updating users: {e}")

    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == '__main__':
    migrate()
