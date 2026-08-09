import os
import sqlite3

def clean_database(db_path):
    if not os.path.exists(db_path):
        print(f"[SKIP] Database file not found: {db_path}")
        return

    print(f"[INFO] Cleaning dummy operators from {db_path}...")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    try:
        # Get operator IDs
        c.execute("SELECT id, name, email FROM users WHERE LOWER(role) = 'operator'")
        operators = c.fetchall()
        print(f"Found {len(operators)} operators to remove.")
        for op in operators:
            print(f" - ID {op[0]}: {op[1]} ({op[2]})")

        op_ids = [op[0] for op in operators]

        if op_ids:
            # 1. Unassign roads
            c.execute("UPDATE roads SET assigned_operator_id = NULL WHERE assigned_operator_id IN ({})".format(','.join('?' for _ in op_ids)), op_ids)
            print(f"Unassigned roads for {c.rowcount} records.")

            # 2. Clear operator road assignments junction table if exists
            try:
                c.execute("DELETE FROM operator_road_assignments WHERE operator_id IN ({})".format(','.join('?' for _ in op_ids)), op_ids)
                print(f"Deleted {c.rowcount} operator road assignments.")
            except sqlite3.OperationalError:
                pass

            # 3. Clear assigned_operator_id in alerts if exists
            try:
                c.execute("UPDATE alerts SET assigned_operator_id = NULL WHERE assigned_operator_id IN ({})".format(','.join('?' for _ in op_ids)), op_ids)
            except sqlite3.OperationalError:
                pass

            # 4. Delete operators from users table
            c.execute("DELETE FROM users WHERE LOWER(role) = 'operator'")
            print(f"Deleted {c.rowcount} operator accounts from users table.")

        conn.commit()
        print(f"[SUCCESS] Database {db_path} cleaned successfully.")
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Cleaning failed for {db_path}: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backend_db = os.path.join(base_dir, "trafficvision.db")
    root_db = os.path.join(os.path.dirname(base_dir), "trafficvision.db")

    clean_database(backend_db)
    clean_database(root_db)
