#!/usr/bin/env node
/**
 * Script para verificar si un usuario existe en Supabase
 * y ejecutar optimizaciones si es necesario
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fqdddcineslaxdkyiksf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY no está configurado');
  console.error('Necesitas: export SUPABASE_SERVICE_ROLE_KEY="tu_clave"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUser(documento) {
  console.log(`\n🔍 Buscando usuario con CI: ${documento}`);
  
  try {
    // 1. Verificar si el usuario existe
    console.log('📊 Consultando base_personas...');
    const { data, error } = await supabase
      .from('base_personas')
      .select('*')
      .eq('documento', documento.trim())
      .single();
    
    if (error && error.code === 'PGRST116') {
      console.log(`❌ Usuario NO encontrado en base_personas`);
      return false;
    }
    
    if (error) {
      console.error(`❌ Error en query:`, error);
      return false;
    }
    
    console.log(`✅ Usuario encontrado:`);
    console.log(`   CI: ${data.documento}`);
    console.log(`   Nombre: ${data.nombre}`);
    console.log(`   Fecha Nacimiento: ${data.fecha_nacimiento}`);
    return true;
  } catch (err) {
    console.error('❌ Error inesperado:', err.message);
    return false;
  }
}

async function checkRPC() {
  console.log('\n🔧 Verificando RPCs optimizadas...');
  
  try {
    // Test RPC search_personas_mejorada
    const { data: rpcTest, error: rpcError } = await supabase.rpc('search_personas_mejorada', {
      search_term: 'test'
    });
    
    if (rpcError) {
      console.log(`❌ RPC search_personas_mejorada NO existe o falla`);
      console.log(`   Error: ${rpcError.message}`);
      return false;
    }
    
    console.log(`✅ RPC search_personas_mejorada existe y funciona`);
    return true;
  } catch (err) {
    console.error('❌ Error verificando RPC:', err.message);
    return false;
  }
}

async function showTableStats() {
  console.log('\n📈 Estadísticas de base_personas...');
  
  try {
    const { data, error } = await supabase
      .from('base_personas')
      .select('documento, nombre', { count: 'exact' });
    
    if (!error) {
      console.log(`   Total de usuarios: ${data ? data.length : 'N/A'}`);
      if (data && data.length > 0) {
        console.log(`   Primeros 5 usuarios:`);
        data.slice(0, 5).forEach(u => {
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
  console.log('Verificador de usuarios en Supabase');
  console.log('='.repeat(60));
  
  const usuario = process.argv[2];
  if (!usuario) {
    console.log('\nUso: node check-usuario.js <CI>');
    console.log('Ejemplo: node check-usuario.js 6823848');
    process.exit(1);
  }
  
  // Verificar conexión
  try {
    await supabase.auth.getSession();
    console.log('✅ Conectado a Supabase');
  } catch (err) {
    console.error('❌ No se puede conectar a Supabase:', err.message);
    process.exit(1);
  }
  
  // Ejecutar checks
  await showTableStats();
  const exists = await checkUser(usuario);
  const rpcWorks = await checkRPC();
  
  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN:');
  console.log('='.repeat(60));
  console.log(`Usuario ${usuario}:        ${exists ? '✅ Existe' : '❌ No existe'}`);
  console.log(`RPC optimizada:             ${rpcWorks ? '✅ Funciona' : '⚠️  No configurada'}`);
  
  if (!rpcWorks) {
    console.log('\n⚠️  IMPORTANTE: Necesitas ejecutar el SQL en Supabase Dashboard');
    console.log('   1. Abre: https://supabase.com/dashboard');
    console.log('   2. SQL Editor → Copia todo de OPTIMIZAR_BUSQUEDA.sql');
    console.log('   3. Pega y ejecuta');
  }
  
  if (!exists) {
    console.log(`\n⚠️  El usuario ${usuario} no existe en la base de datos`);
    console.log('   Opciones:');
    console.log('   a) Verificar si el CI es correcto');
    console.log('   b) Importar datos si está disponible Excel/CSV');
    console.log('   c) Crear manualmente con: node admin-create-user.js create...');
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
