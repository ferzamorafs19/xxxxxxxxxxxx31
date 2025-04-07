import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
      <div className="bg-[#2c2c2c] p-6 rounded-lg max-w-lg w-full relative">
        <button 
          className="absolute top-2 right-3 text-gray-400 hover:text-white text-xl"
          onClick={onClose}
        >
          &times;
        </button>
        <h3 className="text-xl font-semibold mb-4 text-white">{title}</h3>
        {children}
      </div>
    </div>
  );
};

interface ProtectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: string) => void;
}

export const ProtectModal: React.FC<ProtectModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');

  const handleSubmit = () => {
    onConfirm(amount);
    setAmount('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Proteger Saldo">
      <div className="mb-4">
        <Label htmlFor="cantidadProteger" className="block text-sm text-gray-300 mb-1">
          Cantidad $
        </Label>
        <Input 
          id="cantidadProteger" 
          type="number" 
          placeholder="Ingrese la cantidad"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
        />
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
        >
          Continuar
        </Button>
      </div>
    </Modal>
  );
};

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { cantidad: string, titular: string, clabe: string, alias: string }) => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [formData, setFormData] = useState({
    cantidad: '',
    titular: '',
    clabe: '',
    alias: 'Cuenta de respaldo'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id.replace('transfer', '').toLowerCase()]: value
    }));
  };

  const handleSubmit = () => {
    onConfirm(formData);
    setFormData({
      cantidad: '',
      titular: '',
      clabe: '',
      alias: 'Cuenta de respaldo'
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transferir">
      <div className="space-y-3">
        <div>
          <Input 
            id="transferCantidad" 
            type="number" 
            placeholder="Ingrese la cantidad"
            value={formData.cantidad}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
        <div>
          <Input 
            id="transferTitular" 
            type="text" 
            placeholder="Ingrese el titular"
            value={formData.titular}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
        <div>
          <Input 
            id="transferClabe" 
            type="text" 
            placeholder="Ingrese la CLABE"
            value={formData.clabe}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
        <div>
          <Input 
            id="transferAlias" 
            type="text" 
            placeholder="Cuenta de respaldo"
            value={formData.alias}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
        >
          Continuar
        </Button>
      </div>
    </Modal>
  );
};

interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { importe: string, negocio: string }) => void;
}

export const CancelModal: React.FC<CancelModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [formData, setFormData] = useState({
    importe: '',
    negocio: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id.replace('cancelacion', '').toLowerCase()]: value
    }));
  };

  const handleSubmit = () => {
    onConfirm(formData);
    setFormData({
      importe: '',
      negocio: ''
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancelación">
      <div className="space-y-3">
        <div>
          <Input 
            id="cancelacionImporte" 
            type="number" 
            placeholder="Ingrese el importe"
            value={formData.importe}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
        <div>
          <Input 
            id="cancelacionNegocio" 
            type="text" 
            placeholder="Ingrese el negocio"
            value={formData.negocio}
            onChange={handleChange}
            className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
          />
        </div>
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
        >
          Continuar
        </Button>
      </div>
    </Modal>
  );
};

interface SmsCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (telefono: string) => void;
}

export const SmsCompraModal: React.FC<SmsCompraModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [telefono, setTelefono] = useState('');

  const handleSubmit = () => {
    if (telefono.length === 4) {
      onConfirm(telefono);
      setTelefono('');
      onClose();
    } else {
      alert('Por favor ingresa exactamente 4 dígitos');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SMS Compra - Cancelación de cargos">
      <div className="mb-4">
        <Label htmlFor="telefonoSmsCompra" className="block text-sm text-gray-300 mb-1">
          Ingresa los últimos 4 dígitos del celular:
        </Label>
        <Input 
          id="telefonoSmsCompra" 
          type="tel" 
          maxLength={4}
          placeholder="Ej: 5678"
          value={telefono}
          onChange={(e) => {
            // Solo permitir números y limitar a 4 dígitos
            const value = e.target.value.replace(/\D/g, '').substring(0, 4);
            setTelefono(value);
          }}
          className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          Solo se requieren los últimos 4 dígitos del número celular. 
          Estos dígitos se mostrarán en la pantalla de cancelación.
        </p>
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
          disabled={telefono.length !== 4}
        >
          Enviar
        </Button>
      </div>
    </Modal>
  );
};

interface CodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (telefono: string) => void;
}

export const CodeModal: React.FC<CodeModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [telefono, setTelefono] = useState('');

  const handleSubmit = () => {
    onConfirm(telefono);
    setTelefono('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Teléfono">
      <div className="mb-4">
        <Label htmlFor="telefonoCodigo" className="block text-sm text-gray-300 mb-1">
          Ingresa tu número celular:
        </Label>
        <Input 
          id="telefonoCodigo" 
          type="tel" 
          maxLength={10}
          placeholder="10 dígitos"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
        />
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
        >
          Aceptar
        </Button>
      </div>
    </Modal>
  );
};

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mensaje: string) => void;
}

export const MessageModal: React.FC<MessageModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [mensaje, setMensaje] = useState('');

  const handleSubmit = () => {
    onConfirm(mensaje);
    setMensaje('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mensaje personalizado">
      <div className="mb-4">
        <Label htmlFor="mensajeTexto" className="block text-sm text-gray-300 mb-1">
          Escribe el mensaje (máx. 300 caracteres):
        </Label>
        <Textarea 
          id="mensajeTexto" 
          maxLength={300}
          rows={5}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          className="w-full p-2 rounded bg-[#1f1f1f] text-white border border-gray-700 focus:outline-none"
        />
      </div>
      
      <div className="flex justify-end space-x-2 mt-6">
        <Button 
          onClick={onClose}
          variant="secondary"
          className="bg-gray-600 text-white hover:bg-gray-700"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="default"
          className="bg-[#007bff] text-white hover:bg-opacity-90"
        >
          Enviar
        </Button>
      </div>
    </Modal>
  );
};
