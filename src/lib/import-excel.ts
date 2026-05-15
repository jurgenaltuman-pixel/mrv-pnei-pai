import XLSX from 'xlsx';
import { z } from 'zod';
import { 
  EmailSchema, 
  UsernameSchema, 
  NombreSchema, 
  RolSchema,
  CISchema,
  validarOLanzar 
} from '@/lib/validation-schemas';

export interface ImportaUsuario {
  email: string;
  username: string;
  nombre: string;
  rol: 'super_admin' | 'admin' | 'vacunador';
  ci?: string;
}

export interface ImportResult {
  validos: ImportaUsuario[];
  errores: Array<{
    fila: number;
    razon: string;
    datos: any;
  }>;
  duplicados: Array<{
    email?: string;
    username?: string;
  }>;
}

/**
 * Validar esquema de usuario
 */
function validarUsuario(
  row: any,
  numeroFila: number,
  errores: ImportResult['errores'],
  vistos: { emails: Set<string>; usernames: Set<string> }
): ImportaUsuario | null {
  try {
    // Validar campos requeridos
    if (!row.email || !row.username || !row.nombre || !row.rol) {
      errores.push({
        fila: numeroFila,
        razon: 'Campos requeridos faltando: email, username, nombre, rol',
        datos: row,
      });
      return null;
    }

    // Validar email
    let email: string;
    try {
      email = validarOLanzar(EmailSchema, row.email);
    } catch (err) {
      errores.push({
        fila: numeroFila,
        razon: `Email inválido: ${err instanceof Error ? err.message : String(err)}`,
        datos: row,
      });
      return null;
    }

    // Verificar email no duplicado EN ESTE IMPORT
    if (vistos.emails.has(email)) {
      errores.push({
        fila: numeroFila,
        razon: `Email duplicado en archivo: ${email}`,
        datos: row,
      });
      return null;
    }
    vistos.emails.add(email);

    // Validar username
    let username: string;
    try {
      username = validarOLanzar(UsernameSchema, row.username);
    } catch (err) {
      errores.push({
        fila: numeroFila,
        razon: `Username inválido: ${err instanceof Error ? err.message : String(err)}`,
        datos: row,
      });
      return null;
    }

    // Verificar username no duplicado EN ESTE IMPORT
    if (vistos.usernames.has(username)) {
      errores.push({
        fila: numeroFila,
        razon: `Username duplicado en archivo: ${username}`,
        datos: row,
      });
      return null;
    }
    vistos.usernames.add(username);

    // Validar nombre
    let nombre: string;
    try {
      nombre = validarOLanzar(NombreSchema, row.nombre);
    } catch (err) {
      errores.push({
        fila: numeroFila,
        razon: `Nombre inválido: ${err instanceof Error ? err.message : String(err)}`,
        datos: row,
      });
      return null;
    }

    // Validar rol
    let rol: 'super_admin' | 'admin' | 'vacunador';
    try {
      rol = validarOLanzar(RolSchema, String(row.rol).toLowerCase());
    } catch (err) {
      errores.push({
        fila: numeroFila,
        razon: `Rol inválido. Valores permitidos: super_admin, admin, vacunador`,
        datos: row,
      });
      return null;
    }

    // CI opcional pero si existe debe ser válido
    let ci: string | undefined;
    if (row.ci) {
      try {
        ci = validarOLanzar(CISchema, row.ci);
      } catch (err) {
        errores.push({
          fila: numeroFila,
          razon: `CI inválido: ${err instanceof Error ? err.message : String(err)}`,
          datos: row,
        });
        return null;
      }
    }

    return { email, username, nombre, rol, ci };
  } catch (err) {
    errores.push({
      fila: numeroFila,
      razon: `Error inesperado: ${err instanceof Error ? err.message : String(err)}`,
      datos: row,
    });
    return null;
  }
}

/**
 * Importar usuarios desde archivo Excel
 * Valida cada fila y retorna separado los válidos de los inválidos
 */
export function importarUsuariosDeExcel(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        // Validar MIME type
        if (
          !file.type.includes('spreadsheet') &&
          !file.name.endsWith('.xlsx') &&
          !file.name.endsWith('.xls')
        ) {
          reject(
            new Error(
              'Solo archivos Excel (.xlsx, .xls) permitidos. MIME type: ' + file.type
            )
          );
          return;
        }

        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (!workbook.SheetNames.length) {
          reject(new Error('Archivo Excel no tiene hojas'));
          return;
        }

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (!rows.length) {
          reject(new Error('Archivo no contiene datos'));
          return;
        }

        const result: ImportResult = {
          validos: [],
          errores: [],
          duplicados: [],
        };

        const vistos = {
          emails: new Set<string>(),
          usernames: new Set<string>(),
        };

        // Procesar cada fila
        rows.forEach((row: any, index: number) => {
          const numeroFila = index + 2; // Excel empieza en fila 1, encabezados en fila 1
          const usuario = validarUsuario(row, numeroFila, result.errores, vistos);

          if (usuario) {
            result.validos.push(usuario);
          }
        });

        resolve(result);
      } catch (err) {
        reject(
          new Error(
            `Error procesando archivo: ${err instanceof Error ? err.message : String(err)}`
          )
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Error leyendo archivo'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Generar template Excel para descargar
 */
export function generarTemplateExcel(): void {
  const templateData = [
    {
      email: 'ejemplo@domain.com',
      username: 'usuario_ejemplo',
      nombre: 'Nombre Completo',
      rol: 'vacunador',
      ci: '12345678',
    },
    {
      email: 'admin@domain.com',
      username: 'admin_user',
      nombre: 'Admin Usuario',
      rol: 'admin',
      ci: '87654321',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
  
  // Configurar ancho de columnas
  ws['!cols'] = [
    { wch: 25 },
    { wch: 20 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
  ];

  XLSX.writeFile(wb, `template-usuarios-${new Date().toISOString().split('T')[0]}.xlsx`);
}
