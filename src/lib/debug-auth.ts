// DEBUG: Script para diagnosticar errores de autenticación en Supabase
// Ejecutar en console del navegador o en el contexto de la aplicación

export async function debugAuthError(email, password, displayName, username) {
  console.log('🔍 Iniciando diagnóstico de autenticación...\n');

  // 1. Validar entrada
  console.log('1️⃣ Validando entrada:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${'*'.repeat(password?.length || 0)} (${password?.length} chars)`);
  console.log(`   Display Name: ${displayName}`);
  console.log(`   Username: ${username}\n`);

  if (!email || !email.includes('@')) {
    console.error('❌ Email inválido');
    return;
  }

  if (!password || password.length < 6) {
    console.error('❌ Contraseña debe tener mínimo 6 caracteres');
    return;
  }

  // 2. Verificar que el usuario no exista en profiles
  console.log('2️⃣ Verificando si el usuario ya existe en profiles...');
  
  try {
    // Esto es lo que hace el signup en AuthContext
    const { data: supabaseClient } = await import('@/integrations/supabase/client');
    
    const { data: existingUsername, error: checkError } = await supabaseClient.supabase
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (checkError) {
      console.error(`   ❌ Error al verificar usuario existente: ${checkError.message}`);
      return;
    }

    if (existingUsername) {
      console.error(`   ❌ El usuario '${username}' ya existe en profiles`);
      return;
    }

    console.log('   ✅ Usuario disponible\n');
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}`);
    return;
  }

  // 3. Intentar registrarse y capturar el error exacto
  console.log('3️⃣ Intentando registrar en auth.users...');
  
  try {
    const { data: supabaseClient } = await import('@/integrations/supabase/client');
    
    const { data, error } = await supabaseClient.supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          display_name: displayName,
          username: username.trim().toLowerCase(),
        },
      },
    });

    if (error) {
      console.error('   ❌ Error de Supabase Auth:');
      console.error(`      Status: ${error.status}`);
      console.error(`      Message: ${error.message}`);
      console.error(`      Name: ${error.name}`);
      console.error(`      Full Error:`, error);
      return;
    }

    console.log('   ✅ Usuario registrado exitosamente');
    console.log(`      User ID: ${data.user?.id}`);
    console.log(`      Email verified: ${data.user?.email_confirmed_at ? 'Sí' : 'No'}\n`);
  } catch (e) {
    console.error(`   ❌ Error de conexión: ${e.message}`);
  }
}

// Uso en console:
// debugAuthError('andres.altuman@gmail.com', 'password123', 'Pedro Andres Altuman Rodas', '6823848')
