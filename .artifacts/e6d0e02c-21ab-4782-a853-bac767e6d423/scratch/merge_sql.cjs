
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../../../supabase/migrations');
const outputFile = path.join(__dirname, 'full_schema.sql');

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

let fullSql = `-- Consolidated Schema Script (V10 - THE DEFINITIVE OWNER FIX)\n`;
fullSql += `SET client_encoding = 'UTF8';\n`;
fullSql += `SET check_function_bodies = false;\n`;
fullSql += `SET search_path = public, extensions;\n\n`;

// 1. HARD RESET
fullSql += `
-- Force break all links to publication
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        DROP PUBLICATION supabase_realtime;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Wipe public schema completely
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Standard Supabase permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
\n`;

for (const file of files) {
  let content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  // Clean up restricted commands
  content = content.replace(/ALTER PUBLICATION .*/gi, '-- Restricted command skipped');
  content = content.replace(/ALTER TABLE .* OWNER TO .*/gi, '-- Ownership handled globally');
  content = content.replace(/ALTER TABLE .* REPLICA IDENTITY .*/gi, '-- Identity skipped');

  // Fix common syntax issues in merged files
  content = content.replace(/DO \$/g, 'DO $$');
  content = content.replace(/END \$/g, 'END $$');

  // Force project ID
  content = content.replace(/wzgzkyzpzniduwcgdozl/g, 'zqllblksdyutspauafgi');

  fullSql += `-- Migration: ${file}\n`;
  fullSql += content + '\n\n';
}

// 2. RE-ESTABLISH OWNERSHIP AT THE VERY END
fullSql += `
-- Final Ownership Correction
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO postgres';
    END LOOP;
END $$;

-- Re-create publication if needed (Optional, user can do in UI)
-- CREATE PUBLICATION supabase_realtime;
`;

fs.writeFileSync(outputFile, fullSql, 'utf8');
console.log(`Merged ${files.length} files into ${outputFile} (V10)`);
