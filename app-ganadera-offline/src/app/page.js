'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { sileo, Toaster } from 'sileo';
import { db } from '../../lib/db';
import { supabase } from '../../lib/supabase';

export default function AppGanadera() {
  const [numero, setNumero] = useState('');
  const [peso, setPeso] = useState('');
  const [fotoLocal, setFotoLocal] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Escuchamos la base de datos local en tiempo real
  const vacasLocales = useLiveQuery(() => db.vacas.toArray(), []);

  // 1. AUTO-SINCRONIZACIÓN AL RECUPERAR INTERNET
  useEffect(() => {
    const handleOnline = () => {
      sileo.info({ title: '¡Señal recuperada! Sincronizando en segundo plano... 📡' });
      sincronizarDatos();
    };

    window.addEventListener('online', handleOnline);

    if (navigator.onLine) {
      sincronizarDatos();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Función para manejar la foto en modo offline
  const manejarFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFotoLocal(reader.result); // Convierte la foto a Base64
      reader.readAsDataURL(file);
    }
  };

  // 2. GUARDAR Y AUTO-SUBIR (Si hay internet)
  const guardarVacaLocal = async (e) => {
    e.preventDefault();
    try {
      await db.vacas.add({
        id: crypto.randomUUID(),
        numero_arete: numero,
        peso: parseFloat(peso),
        foto_local: fotoLocal,
        estado_sync: 'pendiente_crear'
      });
      
      // Limpiamos el formulario
      setNumero(''); 
      setPeso(''); 
      setFotoLocal(null);
      
      sileo.success({ title: 'Vaca registrada localmente 🐄' });

      if (navigator.onLine) {
        sincronizarDatos();
      }

    } catch (error) {
      sileo.error({ title: 'Error al guardar el registro en el teléfono.' });
    }
  };

  // 3. EL CEREBRO DE LA SINCRONIZACIÓN Y RESOLUCIÓN DE CONFLICTOS
  const sincronizarDatos = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);

    try {
      // --- PASO 1: PULL ---
      const { data: serverVacas, error: errorServer } = await supabase.from('vacas').select('*');
      if (errorServer) throw errorServer;

      const localesActuales = await db.vacas.toArray() || [];

      for (const serverVaca of serverVacas) {
        const localVaca = localesActuales.find(v => v.id === serverVaca.id);
        
        if (!localVaca) {
          await db.vacas.add({ ...serverVaca, estado_sync: 'sincronizado' });
        } else if (localVaca.estado_sync === 'sincronizado') {
          await db.vacas.update(localVaca.id, { ...serverVaca, estado_sync: 'sincronizado' });
        }
      }

      // --- PASO 2: PUSH ---
      const pendientes = await db.vacas.where('estado_sync').notEqual('sincronizado').toArray();
      
      if (pendientes.length > 0) {
        sileo.info({ title: 'Subiendo tus cambios a la nube... ☁️' });
      }

      for (const p of pendientes) {
        let fotoUrlDefinitiva = p.foto_url;

        if (p.foto_local) {
          const res = await fetch(p.foto_local);
          const blob = await res.blob();
          const fileName = `${p.id}.jpg`;

          // Subimos la foto a Storage
          const { error: uploadError } = await supabase.storage
            .from('fotos_vacas')
            .upload(fileName, blob, { upsert: true });

          if (!uploadError) {
            const { data } = supabase.storage.from('fotos_vacas').getPublicUrl(fileName);
            fotoUrlDefinitiva = data.publicUrl;
          } else {
            // AQUÍ CAPTURAMOS EL ERROR DE PERMISOS DE SUPABASE
            console.error("ERROR RECHAZADO POR SUPABASE:", uploadError);
            sileo.error({ title: `Error al subir foto: ${uploadError.message}` });
          }
        }

        const datosParaSubir = {
          id: p.id,
          numero_arete: p.numero_arete,
          peso: p.peso,
          foto_url: fotoUrlDefinitiva
        };

        if (p.estado_sync === 'pendiente_crear') {
          await supabase.from('vacas').insert(datosParaSubir);
        } else {
          await supabase.from('vacas').update(datosParaSubir).eq('id', p.id);
        }

        // Marcamos como sincronizada localmente y limpiamos la foto pesada
        await db.vacas.update(p.id, { 
          estado_sync: 'sincronizado', 
          foto_url: fotoUrlDefinitiva, 
          foto_local: null 
        });
      }

      if (pendientes.length > 0) {
        sileo.success({ title: '¡Todo sincronizado exitosamente! ✅' });
      }
      
    } catch (error) {
      console.error('Error de sincronización:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <Toaster position="top-right" />

      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Gestión Ganadera</h1>
        
        <form onSubmit={guardarVacaLocal} className="space-y-4 mb-8" suppressHydrationWarning={true}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Número de Arete</label>
            <input 
              type="text" required value={numero} onChange={(e) => setNumero(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              placeholder="Ej: 045" suppressHydrationWarning={true}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Peso (kg)</label>
            <input 
              type="number" required value={peso} onChange={(e) => setPeso(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              placeholder="Ej: 450" suppressHydrationWarning={true}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Foto del Animal (Opcional)</label>
            <input 
              type="file" accept="image/*" onChange={manejarFoto}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            
            {/* Vista Previa de la Foto */}
            {fotoLocal && (
              <div className="mt-2">
                <p className="text-xs text-green-600 mb-1">✓ Foto lista para guardar</p>
                <img src={fotoLocal} alt="Vista previa" className="w-full h-32 object-cover rounded-md border" />
              </div>
            )}
          </div>

          <button type="submit" className="w-full bg-green-600 text-white p-2 rounded-md hover:bg-green-700 disabled:bg-green-400 mt-4" disabled={isSyncing}>
            {isSyncing ? 'Guardando...' : 'Guardar Vaca'}
          </button>
        </form>

        <hr className="my-6" />

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Mis Vacas</h2>
          {isSyncing ? (
            <span className="text-sm text-blue-600 animate-pulse font-medium">Sincronizando...</span>
          ) : (
            <span className="text-sm text-gray-400 font-medium">Al día</span>
          )}
        </div>

        <ul className="space-y-3">
          {vacasLocales?.map((vaca) => (
            <li key={vaca.id} className="p-3 bg-gray-50 rounded-md border flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold text-gray-800">#{vaca.numero_arete}</span>
                  <span className="text-gray-500 ml-2">{vaca.peso} kg</span>
                </div>
                <div>
                  {vaca.estado_sync !== 'sincronizado' 
                    ? <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">Pendiente</span>
                    : <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">En Nube</span>
                  }
                </div>
              </div>
              {(vaca.foto_local || vaca.foto_url) && (
                <img 
                  src={vaca.foto_local || vaca.foto_url} 
                  alt={`Vaca ${vaca.numero_arete}`} 
                  className="w-full h-32 object-cover rounded-md mt-2"
                />
              )}
            </li>
          ))}
          {vacasLocales?.length === 0 && <p className="text-gray-500 text-sm">No hay vacas registradas.</p>}
        </ul>
      </div>
    </div>
  );
}