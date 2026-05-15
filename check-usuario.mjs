#!/usr/bin/env node
/**
 * Script para verificar si un usuario existe en Supabase
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fqdddcineslaxdkyiksf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY no está configurado');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUser(documento) {
  console.log(`\n🔍 Buscando usuario con CI: ${documento}`);
  
  try {
    const { data, error } = await supabase
      .from('base_personas')
      .select('*')
      .eq('documento', documento.trim())
      .single();
    
    if (error && error.code === 'PGRST116') {
      console.log(`❌ Usuario NO encontrado`);
      return false;
    }
    
    if (error) {
      console.error(`Error:`, error);
      return false;
    }
    
    console.log(`✅ Usuario encontrado:`);
    console.log(`   CI: ${data.documento}`);
    console.log(`   Nombre: ${data.nombre}`);
    return true;
  } catch (err) {
    console.error('Error:', err.message);
    return false;
  }
}

async function showTableStats() {
  console.log('\n📊 Verificando tabla base_personas...');
  
  try {
    const { data, error, count } = await supabase
      .from('base_personas')
      .select('*', { count: 'exact' })
      .limit(5);
    
    if (!error && count !== null) {
      console.log(`   Total de registros: ${count}`);
      if (data && data.length > 0) {
        console.log(`   Primeros registros:`);
        data.forEach(u => {
          console.log(`     - ${u.documento}: ${u.nombre}`);
        });
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Verificador de Usuarios Supabase');
  console.log('='.repeat(60));
  
  const usuario = process.argv[2];
  if (!usuario) {
    console.log('\nUso: node check-usuario.mjs <CI>');
    process.exit(1);
  }
  
  await showTableStats();
  await checkUser(usuario);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
