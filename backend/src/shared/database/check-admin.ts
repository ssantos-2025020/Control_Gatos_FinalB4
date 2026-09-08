import bcrypt from 'bcrypt';
import { query } from './database.service';

export async function checkAdmin(): Promise<void> {
  console.log('Verificando usuario admin...');
  
  const usuarios = await query<{ email: string; nombre: string; role: string }>(
    'SELECT email, nombre, role FROM usuarios WHERE role = $1',
    ['ADMIN']
  );

  if (usuarios.length === 0) {
    console.log('❌ No existe usuario ADMIN en la base de datos');
    return;
  }

  console.log(`✅ Usuario ADMIN encontrado: ${usuarios[0].email} - ${usuarios[0].nombre}`);

  // Verificar contraseña
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@controlgastos.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  
  console.log(`Intentando verificar contraseña: ${adminPassword}`);
  
  const usuarioConPassword = await query<{ password: string }>(
    'SELECT password FROM usuarios WHERE LOWER(email) = $1',
    [adminEmail.toLowerCase()]
  );

  if (usuarioConPassword.length === 0) {
    console.log('❌ No se encontró usuario con ese email');
    return;
  }

  const passwordMatches = await bcrypt.compare(adminPassword, usuarioConPassword[0].password);
  
  if (passwordMatches) {
    console.log('✅ Contraseña correcta');
  } else {
    console.log('❌ Contraseña incorrecta');
    console.log('Recreando usuario admin con contraseña correcta...');
    
    const SALT_ROUNDS = 10;
    const hash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    const adminNombre = process.env.ADMIN_NOMBRE || 'Administrador';
    
    await query(
      `UPDATE usuarios 
       SET password = $1, nombre = $2 
       WHERE LOWER(email) = $3`,
      [hash, adminNombre, adminEmail.toLowerCase()]
    );
    
    console.log('✅ Usuario admin actualizado con nueva contraseña');
  }
}
