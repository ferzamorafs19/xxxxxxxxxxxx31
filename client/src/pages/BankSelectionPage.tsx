import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { BankType } from '@shared/schema';

// Importamos los logos de los bancos
import banorteLogoPath from '@assets/Banorte-01.png';
import liverPoolLogoPath from '@assets/logo-brand-liverpool-f-c-design-acaab2087aa7319e33227c007e2d759b.png';
import hsbcLogoPath from '@assets/Hsbc.png';
import banregioLogoPath from '@assets/Banregio.png.png';
import invexLogoPath from '@assets/Invex.png';
import bancoppelLogoPath from '@assets/bancoppel.png';
import plataCardLogoPath from '@assets/Plata_Card_Logo.png';
import scotiaLogoPath from '@assets/Skotia.png';
import amexLogoPath from '@assets/Amex.png';
import bancoAztecaLogoPath from '@assets/Banco_Azteca_Logo.png';
import bienestarLogoPath from '@assets/Logo_Banco_del_Bienestar.png';

// Definir mapa de logos
const bankLogos: Record<string, string> = {
  [BankType.HSBC]: hsbcLogoPath,
  [BankType.BANORTE]: banorteLogoPath,
  [BankType.INVEX]: invexLogoPath,
  [BankType.BANCOPPEL]: bancoppelLogoPath,
  [BankType.LIVERPOOL]: liverPoolLogoPath,
  [BankType.BANREGIO]: banregioLogoPath,
  [BankType.PLATACARD]: plataCardLogoPath,
  [BankType.SCOTIABANK]: scotiaLogoPath,
  [BankType.AMEX]: amexLogoPath,
  [BankType.BANCOAZTECA]: bancoAztecaLogoPath,
  [BankType.BIENESTAR]: bienestarLogoPath
};

// Definir mapa de descripciones
const bankDescriptions: Record<string, string> = {
  [BankType.HSBC]: "HSBC te ofrece atención rápida y efectiva para resolver cualquier aclaración sobre tus transacciones.",
  [BankType.BANORTE]: "Banorte está a tu disposición para asegurar que cada transacción sea clara y justa.",
  [BankType.INVEX]: "INVEX te respalda en cada paso para aclarar cualquier movimiento en tus cuentas.",
  [BankType.BANCOPPEL]: "BanCoppel te ofrece soluciones eficientes para resolver cualquier duda sobre tus operaciones bancarias.",
  [BankType.LIVERPOOL]: "Liverpool se compromete a brindarte un servicio de calidad para resolver tus aclaraciones.",
  [BankType.BANREGIO]: "Banregio está comprometido con tus finanzas y te ofrece el mejor servicio para resolver tus aclaraciones.",
  [BankType.PLATACARD]: "Plata Card te ofrece soluciones rápidas y eficientes para aclarar cualquier movimiento en tu cuenta.",
  [BankType.SCOTIABANK]: "Scotiabank está siempre a tu disposición para atender tus dudas y aclaraciones bancarias.",
  [BankType.AMEX]: "American Express te garantiza soluciones efectivas para todas tus aclaraciones bancarias.",
  [BankType.BANCOAZTECA]: "Banco Azteca te acompaña con atención personalizada para resolver tus aclaraciones de forma rápida y eficiente.",
  [BankType.BIENESTAR]: "Banco del Bienestar está comprometido con brindarte el mejor servicio en aclaraciones bancarias."
};

export default function BankSelectionPage() {
  const { user } = useAuth();
  const [allowedBanks, setAllowedBanks] = useState<string[]>([]);
  
  // Obtener los bancos permitidos del usuario
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/user/allowed-banks'],
    queryFn: async () => {
      try {
        if (!user) return { success: true, allowedBanks: [] };
        
        const res = await apiRequest('GET', '/api/user/allowed-banks');
        return await res.json();
      } catch (error) {
        console.error('Error obteniendo bancos permitidos:', error);
        return { success: true, allowedBanks: [] };
      }
    },
    enabled: !!user // Solo ejecutar si hay un usuario autenticado
  });
  
  useEffect(() => {
    if (data && data.success) {
      console.log('[BankSelection] Datos de bancos permitidos recibidos:', data);
      setAllowedBanks(data.allowedBanks || []);
      console.log('[BankSelection] Bancos permitidos actualizados:', data.allowedBanks || []);
    }
  }, [data]);

  // Confiar en los datos del endpoint en lugar de los datos de usuario cacheados
  const banksToShow = isLoading 
    ? [] // Mientras se carga, mostrar array vacío (se mostrará el spinner)
    : allowedBanks; // Usar siempre los datos del endpoint
    
  // Mostrar información de depuración
  useEffect(() => {
    console.log('[BankSelection] Bancos a mostrar:', banksToShow);
    console.log('[BankSelection] Usuario actual:', user);
    if (user) {
      console.log('[BankSelection] Bancos permitidos en usuario:', user.allowedBanks || 'no disponible');
    }
  }, [banksToShow, user]);

  return (
    <div className="min-h-screen bg-[#f9f9f9]">
      <header className="text-center py-10 px-5">
        <h1 className="text-4xl font-bold text-gray-800">Aclaraciones Bancarias</h1>
        <p className="text-xl text-gray-600 mt-2">Porque tu confianza es nuestra prioridad</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Cargando bancos disponibles...</span>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-5 px-5 py-6">
          {banksToShow.map(bank => {
            const logo = bankLogos[bank as keyof typeof bankLogos];
            const description = bankDescriptions[bank as keyof typeof bankDescriptions];
            
            return (
              <div key={bank} className="bg-white rounded-lg shadow-md w-64 text-center p-5">
                <img 
                  src={logo} 
                  alt={bank} 
                  className="h-16 object-contain mx-auto mb-3"
                />
                <p className="text-sm text-gray-700">{description}</p>
              </div>
            );
          })}
          
          {banksToShow.length === 0 && (
            <div className="bg-white rounded-lg shadow-md w-full max-w-lg text-center p-8">
              <h3 className="text-xl font-semibold mb-3 text-gray-800">No tienes bancos asignados</h3>
              <p className="text-gray-600">
                No se te han asignado bancos para operaciones. Contacta con el administrador para obtener acceso.
              </p>
            </div>
          )}
        </div>
      )}

      <section className="py-8 px-5 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-5">¿Qué es una Aclaración Bancaria?</h2>
        <p className="max-w-4xl mx-auto text-gray-600 leading-relaxed mb-5">
          Una aclaración bancaria es un proceso mediante el cual un cliente solicita la revisión de un movimiento en su cuenta bancaria que considera incorrecto o no autorizado. Este proceso puede incluir cargos no reconocidos, errores en el saldo, o cualquier otra situación que requiera una verificación por parte del banco. Las aclaraciones bancarias son fundamentales para mantener la confianza y seguridad de los clientes en sus instituciones financieras.
        </p>
        <p className="max-w-4xl mx-auto text-gray-600 leading-relaxed">
          Los bancos ofrecen diferentes canales para realizar estas aclaraciones, incluyendo atención en sucursales, llamadas telefónicas, y plataformas en línea. Es importante que los clientes actúen rápidamente al detectar un problema para que el banco pueda investigar y resolver la situación lo antes posible.
        </p>
      </section>

      <section className="py-8 px-5 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-5">Aclaraciones con Tarjetas de Crédito</h2>
        <p className="max-w-4xl mx-auto text-gray-600 leading-relaxed mb-6">
          Además de las cuentas bancarias, también puedes realizar aclaraciones por cargos no reconocidos en tus tarjetas de crédito. Este proceso es similar y generalmente requiere contactar a tu banco emisor y presentar una solicitud de aclaración.
        </p>
        <div className="flex justify-center gap-10">
          <img src="https://upload.wikimedia.org/wikipedia/commons/0/04/Visa.svg" alt="Visa" className="h-20 w-auto" />
          <img src="https://upload.wikimedia.org/wikipedia/commons/0/04/Mastercard-logo.png" alt="Mastercard" className="h-20 w-auto" />
          <img src={amexLogoPath} alt="American Express" className="h-20 w-auto" />
        </div>
      </section>

      <footer className="bg-gray-800 text-white text-center py-4 px-3 text-sm">
        © 2024 Aclaraciones Bancarias - Todos los derechos reservados.
      </footer>
    </div>
  );
}