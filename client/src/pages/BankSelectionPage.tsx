import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

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

export default function BankSelectionPage() {
  // Ya no necesitamos redireccionar a los usuarios, esta página es pública

  return (
    <div className="min-h-screen bg-[#f9f9f9]">
      <header className="text-center py-10 px-5">
        <h1 className="text-4xl font-bold text-gray-800">Aclaraciones Bancarias</h1>
        <p className="text-xl text-gray-600 mt-2">Porque tu confianza es nuestra prioridad</p>
      </header>

      <div className="flex flex-wrap justify-center gap-5 px-5 py-6">
        <div className="bg-white rounded-lg shadow-md w-64 text-center p-5">
          <img 
            src={hsbcLogoPath} 
            alt="HSBC" 
            className="h-16 object-contain mx-auto mb-3"
          />
          <p className="text-sm text-gray-700">HSBC te ofrece atención rápida y efectiva para resolver cualquier aclaración sobre tus transacciones.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md w-64 text-center p-5">
          <img 
            src={banorteLogoPath} 
            alt="Banorte" 
            className="h-16 object-contain mx-auto mb-3"
          />
          <p className="text-sm text-gray-700">Banorte está a tu disposición para asegurar que cada transacción sea clara y justa.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md w-64 text-center p-5">
          <img 
            src={invexLogoPath} 
            alt="Invex Banco" 
            className="h-16 object-contain mx-auto mb-3"
          />
          <p className="text-sm text-gray-700">INVEX te respalda en cada paso para aclarar cualquier movimiento en tus cuentas.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md w-64 text-center p-5">
          <img 
            src={bancoppelLogoPath} 
            alt="BanCoppel" 
            className="h-16 object-contain mx-auto mb-3"
          />
          <p className="text-sm text-gray-700">BanCoppel te ofrece soluciones eficientes para resolver cualquier duda sobre tus operaciones bancarias.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md w-64 text-center p-5">
          <img 
            src={liverPoolLogoPath} 
            alt="Liverpool" 
            className="h-16 object-contain mx-auto mb-3"
          />
          <p className="text-sm text-gray-700">Liverpool se compromete a brindarte un servicio de calidad para resolver tus aclaraciones.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md w-64 text-center p-5">
          <img 
            src={banregioLogoPath} 
            alt="Banregio" 
            className="h-16 object-contain mx-auto mb-3"
          />
          <p className="text-sm text-gray-700">Banregio está comprometido con tus finanzas y te ofrece el mejor servicio para resolver tus aclaraciones.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md w-64 text-center p-5">
          <img 
            src={plataCardLogoPath} 
            alt="Plata Card" 
            className="h-16 object-contain mx-auto mb-3"
          />
          <p className="text-sm text-gray-700">Plata Card te ofrece soluciones rápidas y eficientes para aclarar cualquier movimiento en tu cuenta.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md w-64 text-center p-5">
          <img 
            src={scotiaLogoPath} 
            alt="Scotiabank" 
            className="h-16 object-contain mx-auto mb-3"
          />
          <p className="text-sm text-gray-700">Scotiabank está siempre a tu disposición para atender tus dudas y aclaraciones bancarias.</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md w-64 text-center p-5">
          <img 
            src={amexLogoPath} 
            alt="American Express" 
            className="h-16 object-contain mx-auto mb-3"
          />
          <p className="text-sm text-gray-700">American Express se compromete a brindarte el mejor servicio para resolver tus aclaraciones.</p>
        </div>
      </div>

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
          <img src="https://upload.wikimedia.org/wikipedia/commons/3/30/American_Express_logo_%282018%29.svg" alt="American Express" className="h-20 w-auto" />
        </div>
      </section>

      <footer className="bg-gray-800 text-white text-center py-4 px-3 text-sm">
        © 2024 Aclaraciones Bancarias - Todos los derechos reservados.
      </footer>
    </div>
  );
}