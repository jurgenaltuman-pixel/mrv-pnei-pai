#!/usr/bin/env node

/**
 * Admin Tool para crear usuarios en Supabase
 * Uso: node admin-create-user.js <email> <password> <display_name> <username>
 * 
 * Ejemplo:
 * node admin-create-user.js subsistema.pai@mspbs.gov.py MyPassword123 "Subsistema PAI" subsistema.pai
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fqdddcineslaxdkyiksf.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no configurada');
  console.error('Intenta: export SUPABASE_SERVICE_ROLE_KEY="tu_key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createUser(email, password, displayName, username) {
  try {
    console.log('🔄 Creando usuario...');
    
    // 1. Crear en Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        display_name: displayName,
        username: username.trim().toLowerCase(),
      },
    });

    if (authError) {
      console.error('❌ Error en auth:', authError.message);
      return false;
    }

    console.log('✅ Usuario de auth creado:', authUser.user.id);

    // 2. Crear profile en BD
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.user.id,
        email: email.trim().toLowerCase(),
        display_name: displayName,
        username: username.trim().toLowerCase(),
        is_active: true,
        is_approved: false, // Requerirá aprobación
        created_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('⚠️  Error al crear profile:', profileError.message);
      console.log('⚠️  El usuario de auth fue creado pero no el profile');
      return false;
    }

    console.log('✅ Profile creado');

    // 3. Asignar rol (opcional)
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authUser.user.id,
        role: 'user', // Rol por defecto
      });

    if (roleError && !roleError.message.includes('duplicate')) {
      console.warn('⚠️  Error al asignar rol:', roleError.message);
    } else {
      console.log('✅ Rol asignado: user');
    }

    console.log('\n✅ USUARIO CREADO EXITOSAMENTE\n');
    console.log('Email:', email);
    console.log('Username:', username);
    console.log('ID:', authUser.user.id);
    console.log('\n⚠️  NOTA: El usuario requiere aprobación de admin antes de poder iniciar sesión.\n');
    
    return true;

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

async function listUsers() {
  try {
    console.log('🔄 Listando usuarios...\n');
    
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    if (!users || users.users.length === 0) {
      console.log('❌ No hay usuarios en Supabase');
      return;
    }

    console.log(`Total de usuarios: ${users.users.length}\n`);
    users.users.forEach((user, i) => {
      console.log(`${i + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${user.created_at}`);
      console.log(`   Email Confirmed: ${user.email_confirmed_at ? 'Sí' : 'No'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Uso: node admin-create-user.js [comando] [args]

Comandos:
  create <email> <password> <display_name> <username>  - Crear nuevo usuario
  list                                                   - Listar todos los usuarios
  --help                                                 - Mostrar esta ayuda

Ejemplos:
  node admin-create-user.js create subsistema.pai@mspbs.gov.py MyPassword123 "Subsistema PAI" subsistema.pai
  node admin-create-user.js list
  `);
  process.exit(0);
}

if (args[0] === 'list') {
  await listUsers();
} else if (args[0] === 'create') {
  if (args.length < 5) {
    console.error('❌ Faltan argumentos');
    console.error('Uso: node admin-create-user.js create <email> <password> <display_name> <username>');
    process.exit(1);
  }
  const [, email, password, displayName, username] = args;
  const success = await createUser(email, password, displayName, username);
  process.exit(success ? 0 : 1);
} else {
  console.error('❌ Comando desconocido:', args[0]);
  console.error('Intenta: node admin-create-user.js --help');
  process.exit(1);
}
