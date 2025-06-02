import React, { useState } from 'react';
import { MessageSquare, Menu, X, QrCode } from 'lucide-react';
import balonxLogo from '../../assets/balonx_logo.png';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isAdmin, isSuperAdmin }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    // En móvil, cerramos el menú después de seleccionar una opción
    if (window.innerWidth < 768) {
      setIsMenuOpen(false);
    }
  };

  return (
    <>
      {/* Botón de hamburguesa móvil */}
      <button 
        className="md:hidden fixed top-4 left-4 z-50 bg-[#1f1f1f] p-2 rounded-full shadow-lg"
        onClick={toggleMenu}
      >
        {isMenuOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Menu className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Sidebar - adaptable para móvil/desktop */}
      <div 
        className={`
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
          fixed md:static top-0 left-0 z-40
          w-72 md:w-60 bg-[#1f1f1f] p-5 h-screen flex flex-col
          transition-transform duration-300 ease-in-out
        `}
      >
        <div className="text-center mb-5 mt-4 md:mt-0">
          <div className="mb-2">
            <img src={balonxLogo} alt="Balonx Logo" className="w-10 h-10 mx-auto" />
          </div>
          <h3 className="text-gray-300 text-sm">Aclaraciones Bancarias</h3>
          <p className="text-gray-500 text-xs">{isAdmin ? "Admin" : "Usuario"}</p>
        </div>
        <div className="nav flex-1 space-y-2">
          <button 
            onClick={() => handleTabChange('current')}
            className={`block w-full text-left ${activeTab === 'current' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all`}
          >
            Accesos
          </button>
          
          <button 
            onClick={() => handleTabChange('saved')}
            className={`block w-full text-left ${activeTab === 'saved' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all`}
          >
            Accesos Guardados
          </button>
          
          {isSuperAdmin && (
            <>
              <button 
                onClick={() => handleTabChange('registered')}
                className={`block w-full text-left ${activeTab === 'registered' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all`}
              >
                Usuarios
              </button>
              
              <button 
                onClick={() => handleTabChange('users')}
                className={`block w-full text-left ${activeTab === 'users' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all`}
              >
                Usuarios Nuevos
              </button>
            </>
          )}
          
          {isAdmin && (
            <>
              <button 
                onClick={() => handleTabChange('sms')}
                className={`block w-full text-left ${activeTab === 'sms' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                API MSJ
              </button>
              
              <button 
                onClick={() => handleTabChange('qr')}
                className={`block w-full text-left ${activeTab === 'qr' ? 'bg-[#007bff]' : 'bg-gray-700'} text-white py-2 px-3 rounded hover:bg-opacity-90 transition-all flex items-center`}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Generador QR
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Superposición oscura cuando el menú está abierto en móvil */}
      {isMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
