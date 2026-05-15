#!/usr/bin/env node
/**
 * Crear usuario en Supabase Auth + base_personas
 * Uso: node crear-usuario-rapido.mjs email@domain contraseña "Nombre Completo" CI
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fqdddcineslaxdkyiksf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY no está configurado');
  console.error('Ejecuta: $env:SUPABASE_SERVICE_ROLE_KEY="tu_clave"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createUser(email, password, displayName, ci) {
  console.log(`\n📝 Creando usuario: ${email}`);
  
  try {
    // 1. Crear auth user
    console.log('1️⃣  Creando en Auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (authError) {
      console.error('❌ Error en Auth:', authError.message);
      return false;
    }

    const userId = authData.user.id;
    console.log(`✅ Auth user creado: ${userId}`);

    // 2. Crear perfil
    console.log('2️⃣  Creando perfil...');
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        display_name: displayName,
        username: ci,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('❌ Error creando perfil:', profileError);
      return false;
    }

    console.log(`✅ Perfil creado`);

    // 3. Asignar rol
    console.log('3️⃣  Asignando rol...');
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_name: 'user',
      });

    if (roleError) {
      console.error('❌ Error asignando rol:', roleError);
      return false;
    }

    console.log(`✅ Rol asignado`);

    console.log('\n✅ Usuario creado exitosamente');
    console.log(`   Email: ${email}`);
    console.log(`   Contraseña: ${password}`);
    console.log(`   Nombre: ${displayName}`);
    console.log(`   CI: ${ci}`);

    return true;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return false;
  }
}

async function main() {
  const [email, password, displayName, ci] = process.argv.slice(2);

  if (!email || !password || !displayName || !ci) {
    console.log('Uso: node crear-usuario-rapido.mjs email@domain contraseña "Nombre" CI');
    console.log('Ejemplo: node crear-usuario-rapido.mjs subsistema@mspbs.gov.py "MiContraseña123!" "Sistema PAI" 6823848');
    process.exit(1);
  }

  const success = await createUser(email, password, displayName, ci);
  process.exit(success ? 0 : 1);
}

main();
