#!/usr/bin/env python3
"""
Export SQLite database to PostgreSQL SQL file
"""
import sqlite3
import sys

DB_PATH = 'data/uu_database.db'
OUTPUT_PATH = 'data/peraturan_postgresql.sql'

def export_to_postgresql():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Get all data
    c.execute('SELECT * FROM peraturan')
    rows = c.fetchall()
    
    # Get column names
    c.execute('PRAGMA table_info(peraturan)')
    columns = [col[1] for col in c.fetchall()]
    
    print(f"Exporting {len(rows)} rows...")
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        # Write header
        f.write('-- ============================================\n')
        f.write('-- PostgreSQL SQL Export for ASEAN Challenge\n')
        f.write('-- Database: uu_database.db\n')
        f.write(f'-- Total Records: {len(rows)}\n')
        f.write('-- ============================================\n\n')
        
        # Create table statement
        f.write('DROP TABLE IF EXISTS peraturan;\n\n')
        f.write('CREATE TABLE peraturan (\n')
        f.write('    id SERIAL PRIMARY KEY,\n')
        f.write('    uu_id TEXT NOT NULL,\n')
        f.write('    judul TEXT,\n')
        f.write('    tentang TEXT,\n')
        f.write('    tahun TEXT,\n')
        f.write('    bab TEXT,\n')
        f.write('    pasal TEXT,\n')
        f.write('    isi TEXT NOT NULL,\n')
        f.write('    sumber TEXT,\n')
        f.write('    created_at TIMESTAMP NULL,\n')
        f.write('    updated_at TIMESTAMP NULL\n')
        f.write(');\n\n')
        
        # Create indexes
        f.write('CREATE INDEX idx_uu_id ON peraturan(uu_id);\n')
        f.write('CREATE INDEX idx_tentang ON peraturan(tentang);\n\n')
        
        # Insert data
        f.write('INSERT INTO peraturan (uu_id, judul, tentang, tahun, bab, pasal, isi, sumber, created_at, updated_at) VALUES\n')
        
        values_list = []
        for i, row in enumerate(rows):
            # Skip id (first column) - PostgreSQL will auto-generate it
            vals = []
            for v in row[1:]:
                if v is None:
                    vals.append('NULL')
                else:
                    # Escape single quotes and backslashes
                    escaped = str(v).replace("\\", "\\\\").replace("'", "''")
                    vals.append(f"'{escaped}'")
            vals.append('NOW()')
            vals.append('NOW()')
            values_list.append('(' + ', '.join(vals) + ')')
        
        # Write in batches
        batch_size = 50
        for i in range(0, len(values_list), batch_size):
            batch = values_list[i:i+batch_size]
            if i > 0:
                f.write('\nINSERT INTO peraturan (uu_id, judul, tentang, tahun, bab, pasal, isi, sumber, created_at, updated_at) VALUES\n')
            f.write(',\n'.join(batch) + ';\n')
        
        f.write('\n-- End of export\n')
    
    conn.close()
    print(f"Export complete! File saved to: {OUTPUT_PATH}")
    print(f"Total rows exported: {len(rows)}")

if __name__ == '__main__':
    export_to_postgresql()
