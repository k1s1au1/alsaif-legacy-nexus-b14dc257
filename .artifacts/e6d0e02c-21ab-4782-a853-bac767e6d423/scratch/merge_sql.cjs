
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../../../supabase/migrations');
const outputFile = path.join(__dirname, 'full_schema.sql');

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

let fullSql = `-- Consolidated Schema Script (V7 - THE NUCLEAR CLEANUP)\n`;
fullSql += `SET client_encoding = 'UTF8';\n`;
fullSql += `SET check_function_bodies = false;\n\n`;

// 1. THE NUCLEAR CLEANUP (Deletes EVERYTHING in public and breaks restricted links)
fullSql += `
-- Nuclear cleanup to fix "must be owner" errors
DO $$
BEGIN
    -- Remove the publication link first (common cause of ownership errors)
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.messages;
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.conversations;
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.profiles;
    END IF;
END $$;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;
\n`;

for (const file of files) {
  let content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  // Clean up all restricted commands
  content = content.replace(/ALTER PUBLICATION supabase_realtime ADD TABLE .*/gi, '-- Realtime skipped');
  content = content.replace(/ALTER TABLE .* OWNER TO .*/gi, '-- Ownership skipped');
  content = content.replace(/ALTER TABLE .* REPLICA IDENTITY FULL/gi, '-- Identity skipped');

  // Force correct project ID
  content = content.replace(/wzgzkyzpzniduwcgdozl/g, 'zqllblksdyutspauafgi');

  // Fix syntax
  content = content.replace(/DO \$/g, 'DO $$');
  content = content.replace(/END \$/g, 'END $$');

  fullSql += `-- Migration: ${file}\n`;
  fullSql += content + '\n\n';
}

fs.writeFileSync(outputFile, fullSql, 'utf8');
console.log(`Merged ${files.length} files into ${outputFile} (V7)`);
