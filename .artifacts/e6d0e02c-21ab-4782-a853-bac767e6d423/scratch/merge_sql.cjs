
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../../../supabase/migrations');
const outputFile = path.join(__dirname, 'full_schema.sql');

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

let fullSql = `-- Consolidated Schema Script (V11 - SURGICAL CLEANUP & NO OWNER LOOP)\n`;
fullSql += `SET client_encoding = 'UTF8';\n`;
fullSql += `SET check_function_bodies = false;\n\n`;

// 1. SURGICAL CLEANUP
fullSql += `
-- Surgical cleanup to avoid "must be owner" errors
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop publication if possible
    BEGIN
        DROP PUBLICATION IF EXISTS supabase_realtime;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Drop all tables in public schema individually
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;

    -- Drop all types in public
    FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND typtype = 'e') LOOP
        BEGIN
            EXECUTE 'DROP TYPE public.' || quote_ident(r.typname) || ' CASCADE';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END $$;
\n`;

for (const file of files) {
  let content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  // Strip restricted commands
  content = content.replace(/ALTER PUBLICATION .*/gi, '-- Restricted command skipped');
  content = content.replace(/ALTER TABLE .* OWNER TO .*/gi, '-- Ownership handled by creator');
  content = content.replace(/ALTER TABLE .* REPLICA IDENTITY .*/gi, '-- Identity skipped');

  // Fix project ID
  content = content.replace(/wzgzkyzpzniduwcgdozl/g, 'zqllblksdyutspauafgi');

  // Fix syntax
  content = content.replace(/DO \$/g, 'DO $$');
  content = content.replace(/END \$/g, 'END $$');

  fullSql += `-- Migration: ${file}\n`;
  fullSql += content + '\n\n';
}

fs.writeFileSync(outputFile, fullSql, 'utf8');
console.log(`Merged ${files.length} files into ${outputFile} (V11)`);
