require('dotenv').config({ path: '.env.vercel.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_SUPABASE_URL, process.env.VITE_SUPABASE_SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

(async () => {
  console.log('=== MEMBER DIVISION DISTRIBUTION ===\n');
  
  // Get member distribution per division
  const { data: members } = await sb.from('members').select('bagian_id');
  const memberDivisions = {};
  members.forEach(m => {
    memberDivisions[m.bagian_id] = (memberDivisions[m.bagian_id] || 0) + 1;
  });
  
  console.log('1. MEMBERS DISTRIBUTION:');
  Object.entries(memberDivisions).forEach(([div, count]) => {
    console.log('   ' + div + ': ' + count + ' members');
  });
  
  // Get candidate distribution per division
  const { data: candidates } = await sb.from('candidates').select('bagian_id');
  const candidateDivisions = {};
  candidates.forEach(c => {
    candidateDivisions[c.bagian_id] = (candidateDivisions[c.bagian_id] || 0) + 1;
  });
  
  console.log('\n2. CANDIDATES DISTRIBUTION:');
  Object.entries(candidateDivisions).forEach(([div, count]) => {
    console.log('   ' + div + ': ' + count + ' candidates');
  });
  
  // Get division names
  const { data: divisions } = await sb.from('divisions').select('bagian_id, nama_bagian');
  const divisionMap = {};
  divisions.forEach(d => {
    divisionMap[d.bagian_id] = d.nama_bagian;
  });
  
  console.log('\n3. FULL DISTRIBUTION COMPARISON:');
  console.log('   Div ID     | Div Name                 | Members | Candidates');
  console.log('   -----------|--------------------------|---------|-----------');
  Object.keys(divisionMap).sort().forEach(div => {
    const mCount = memberDivisions[div] || 0;
    const cCount = candidateDivisions[div] || 0;
    console.log('   ' + div.padEnd(10) + ' | ' + divisionMap[div].padEnd(24) + ' | ' + mCount.toString().padEnd(7) + ' | ' + cCount);
  });
  
  console.log('\n4. CANDIDATE-MEMBER JOIN ANALYSIS:');
  
  // Get sample of candidates with member matching
  const { data: sampleCandidates } = await sb.from('candidates')
    .select('kandidat_id, nomor_anggota, bagian_id')
    .limit(10);
  
  console.log('   Sample candidates:');
  for (const cand of sampleCandidates) {
    const { data: matchingMember } = await sb.from('members')
      .select('nomor_anggota, bagian_id, email')
      .eq('nomor_anggota', cand.nomor_anggota)
      .limit(1);
    
    const match = matchingMember ? matchingMember[0] : null;
    const status = match ? 
      (match.bagian_id === cand.bagian_id ? 'MATCH' : 'MISMATCH') : 
      'NO_MEMBER';
    
    console.log('   ' + cand.kandidat_id + ' -> ' + cand.nomor_anggota);
    console.log('     candidate.division: ' + cand.bagian_id);
    console.log('     member.division: ' + (match ? match.bagian_id : 'N/A'));
    console.log('     status: ' + status);
  }
  
  // Check orphan candidates
  const candidateNumbers = candidates.map(c => c.nomor_anggota);
  const memberNumbers = members.map(m => m.nomor_anggota);
  const orphanCandidates = candidateNumbers.filter(cn => !memberNumbers.includes(cn));
  
  console.log('\n5. DATA INTEGRITY:');
  console.log('   Total members: ' + members.length);
  console.log('   Total candidates: ' + candidates.length);
  console.log('   Orphan candidates (no member): ' + orphanCandidates.length);
})();