/**
 * Script untuk memperbaiki data divisions table
 * Men-sinkronkan total_anggota dari members table ke divisions table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.production.local' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.VITE_SUPABASE_SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Environment variables not configured');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncDivisions() {
  console.log('🔄 Starting divisions sync...\n');

  // Get all members and count per division
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('bagian_id');

  if (membersError) {
    console.error('❌ Error fetching members:', membersError.message);
    return;
  }

  const memberCounts = {};
  for (const m of members || []) {
    memberCounts[m.bagian_id] = (memberCounts[m.bagian_id] || 0) + 1;
  }

  console.log(`📊 Total members: ${members.length}`);
  console.log(`📊 Divisions with members: ${Object.keys(memberCounts).length}\n`);

  // Get current divisions
  const { data: divisions, error: divsError } = await supabase
    .from('divisions')
    .select('*');

  if (divsError) {
    console.error('❌ Error fetching divisions:', divsError.message);
    return;
  }

  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (const div of divisions) {
    const realCount = memberCounts[div.bagian_id] || 0;

    if (div.total_anggota !== realCount) {
      // Update with correct count
      const { error: updateError } = await supabase
        .from('divisions')
        .update({ total_anggota: realCount })
        .eq('bagian_id', div.bagian_id);

      if (updateError) {
        console.error(`❌ Error updating ${div.bagian_id}:`, updateError.message);
        errors++;
      } else {
        console.log(`✅ ${div.bagian_id}: ${div.total_anggota} → ${realCount}`);
        updated++;
      }
    } else {
      unchanged++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Sync Summary:');
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Errors: ${errors}`);
  console.log('='.repeat(60));

  if (errors === 0 && updated > 0) {
    console.log('\n✅ Divisions table successfully synced!');
  } else if (errors > 0) {
    console.log(`\n⚠️ Completed with ${errors} error(s)`);
  } else {
    console.log('\n✅ All data was already in sync');
  }
}

syncDivisions().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
