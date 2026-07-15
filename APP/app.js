/*
 * SH! Sorteo Torino — capa de datos compartida (demo).
 * Persistencia en localStorage: no hay backend real en esta maqueta.
 * 1 lata comprada = 1 chance en el sorteo.
 * La marca de fraude simula la acción del sistema de validación automática:
 * un participante marcado queda excluido de las chances, las estadísticas y el sorteo.
 */

const SH = (() => {
  const STORAGE_KEY = 'sh_sorteo_entries_v1';
  const FRAUDE_KEY = 'sh_sorteo_fraude_v1';

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('No se pudieron leer las participaciones', e);
      return [];
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function loadFraude() {
    try {
      const raw = localStorage.getItem(FRAUDE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('No se pudo leer la lista de fraude', e);
      return [];
    }
  }

  function saveFraude(list) {
    localStorage.setItem(FRAUDE_KEY, JSON.stringify(list));
  }

  function isFraude(email) {
    const target = (email || '').trim().toLowerCase();
    return loadFraude().includes(target);
  }

  function markFraude(email) {
    const target = (email || '').trim().toLowerCase();
    const list = loadFraude();
    if (!list.includes(target)) {
      list.push(target);
      saveFraude(list);
    }
  }

  function unmarkFraude(email) {
    const target = (email || '').trim().toLowerCase();
    saveFraude(loadFraude().filter((e) => e !== target));
  }

  function addEntry({ nombre, apellido, email, latas, fotoDataUrl, fotoNombre }) {
    const entries = loadEntries();
    const entry = {
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.trim().toLowerCase(),
      latas: Number(latas),
      fotoDataUrl: fotoDataUrl || null,
      fotoNombre: fotoNombre || null,
      fecha: new Date().toISOString(),
    };
    entries.push(entry);
    saveEntries(entries);
    return entry;
  }

  function chancesForEntry(entry) {
    // Regla del sorteo: 1 lata comprada = 1 chance.
    return Math.max(0, Math.floor(entry.latas || 0));
  }

  function getEntriesByEmail(email) {
    const target = (email || '').trim().toLowerCase();
    return loadEntries().filter((e) => e.email === target);
  }

  function getParticipants() {
    const entries = loadEntries();
    const byEmail = new Map();

    entries.forEach((entry) => {
      const chances = chancesForEntry(entry);
      if (!byEmail.has(entry.email)) {
        byEmail.set(entry.email, {
          email: entry.email,
          nombre: entry.nombre,
          apellido: entry.apellido,
          totalLatas: 0,
          totalChances: 0,
          tickets: [],
          primerRegistro: entry.fecha,
        });
      }
      const p = byEmail.get(entry.email);
      p.totalLatas += entry.latas || 0;
      p.totalChances += chances;
      p.tickets.push(entry);
      // Mantener el nombre/apellido más reciente cargado.
      if (new Date(entry.fecha) >= new Date(p.primerRegistro)) {
        p.nombre = entry.nombre;
        p.apellido = entry.apellido;
      }
    });

    const participants = Array.from(byEmail.values());
    participants.forEach((p) => {
      p.eliminado = isFraude(p.email);
      p.publicId = participantId(p.email);
    });

    return participants.sort((a, b) => {
      if (a.eliminado !== b.eliminado) return a.eliminado ? 1 : -1;
      return b.totalChances - a.totalChances;
    });
  }

  function getStats() {
    const participants = getParticipants();
    const entries = loadEntries();
    const activos = participants.filter((p) => !p.eliminado);
    const eliminados = participants.filter((p) => p.eliminado);
    const totalChances = activos.reduce((sum, p) => sum + p.totalChances, 0);
    const totalLatas = activos.reduce((sum, p) => sum + p.totalLatas, 0);
    return {
      totalParticipantes: activos.length,
      totalEliminados: eliminados.length,
      totalTickets: entries.length,
      totalLatas,
      totalChances,
    };
  }

  function drawWinner() {
    const participants = getParticipants().filter((p) => !p.eliminado && p.totalChances > 0);
    if (participants.length === 0) return null;

    const totalChances = participants.reduce((sum, p) => sum + p.totalChances, 0);
    let ticket = Math.random() * totalChances;

    for (const p of participants) {
      ticket -= p.totalChances;
      if (ticket <= 0) return p;
    }
    return participants[participants.length - 1];
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(FRAUDE_KEY);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function showToast(message, isError = false) {
    let toast = document.getElementById('sh-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'sh-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  // ID público del participante: se muestra en la tabla pública en lugar del correo.
  // Se deriva del correo para que sea siempre el mismo para la misma persona.
  // (En producción se generaría un ID aleatorio al registrarse y se guardaría en el backend,
  // en vez de derivarlo del correo.)
  function participantId(email) {
    const target = (email || '').trim().toLowerCase();
    let hash = 5381;
    for (let i = 0; i < target.length; i++) {
      hash = ((hash * 33) ^ target.charCodeAt(i)) >>> 0;
    }
    const code = hash.toString(36).toUpperCase().padStart(6, '0').slice(-6);
    return 'SH-' + code;
  }

  return {
    loadEntries,
    addEntry,
    chancesForEntry,
    getEntriesByEmail,
    getParticipants,
    getStats,
    drawWinner,
    clearAll,
    fileToDataUrl,
    showToast,
    validEmail,
    isFraude,
    markFraude,
    unmarkFraude,
    participantId,
  };
})();
