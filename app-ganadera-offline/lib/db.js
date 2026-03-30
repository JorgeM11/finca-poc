// lib/db.js
import Dexie from 'dexie';

// Creamos la base de datos local llamada 'FincaOfflineDB'
export const db = new Dexie('FincaOfflineDB');

// Definimos la estructura de las tablas locales
// OJO: En Dexie solo declaramos las columnas por las que vamos a buscar o filtrar.
db.version(1).stores({
  vacas: 'id, numero_arete, estado_sync' 
});

/* Explicación de los campos que guardaremos en Dexie:
  - id: UUID único.
  - numero_arete: El número de la vaca.
  - peso: El peso en kg.
  - foto_url: La URL de la foto si ya viene de Supabase.
  - foto_local: La foto en formato Base64 (texto) cuando se toma sin internet.
  - estado_sync: Fundamental. Puede ser:
      'sincronizado' (Viene de Supabase, no hay cambios)
      'pendiente_crear' (Se creó offline)
      'pendiente_editar' (Se editó offline)
      'pendiente_eliminar' (Se borró offline)
*/