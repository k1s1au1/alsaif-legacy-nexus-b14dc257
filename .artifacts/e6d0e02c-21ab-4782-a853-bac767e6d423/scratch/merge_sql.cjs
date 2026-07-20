
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../../../supabase/migrations');
const outputFile = path.join(__dirname, 'full_schema.sql');

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

let fullSql = `-- Consolidated Schema Script (V8 - FINAL SIMPLIFIED CLEANUP)\n`;
fullSql += `SET client_encoding = 'UTF8';\n`;
fullSql += `SET check_function_bodies = false;\n\n`;

// 1. SIMPLEST CLEANUP (No complex logic, just direct drops)
fullSql += `
DROP PUBLICATION IF EXISTS supabase_realtime;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;
\n`;

for (const file of files) {
  let content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  // Strip ALL restricted commands across all files
  content = content.replace(/ALTER PUBLICATION .*/gi, '-- Command skipped');
  content = content.replace(/ALTER TABLE .* OWNER TO .*/gi, '-- Ownership skipped');
  content = content.replace(/ALTER TABLE .* REPLICA IDENTITY .*/gi, '-- Identity skipped');
  content = content.replace(/ALTER TABLE .* ENABLE ROW LEVEL SECURITY/gi, 'ALTER TABLE $&'); // keep RLS

  // Force correct project ID
  content = content.replace(/wzgzkyzpzniduwcgdozl/g, 'zqllblksdyutspauafgi');

  // Fix DO $ syntax
  content = content.replace(/DO \$/g, 'DO $$');
  content = content.replace(/END \$/g, 'END $$');

  fullSql += `-- Migration: ${file}\n`;
  fullSql += content + '\n\n';
}

fs.writeFileSync(outputFile, fullSql, 'utf8');
console.log(`Merged ${files.length} files into ${outputFile} (V8)`);
