import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { BankType } from '@shared/schema';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Save,
  Loader2,
  Palette,
  Type,
  Layout,
  Upload,
  PanelLeftClose,
  PanelRightClose
} from 'lucide-react';

// Importamos los logos de bancos
import liverpoolLogoPath from '@/assets/liverpool_logo.png';
import citibanamexLogoPath from '@/assets/Citibanamex_Logo.png';
import banbajioLogoPath from '@/assets/banbajio_logo.png';
import bbvaLogoWhitePath from '@/assets/bbva_logo_white.png';
import banorteLogoPath from '@/assets/banorte_logo.png';
import bancoppelLogoPath from '@/assets/bancoppel.png';
import hsbcLogoPath from '@/assets/hsbc_logo.png';
import amexLogoPath from '@/assets/Amex.png';
import banregioLogoPath from '@/assets/banregio_logo.png';
import invexLogoPath from '@/assets/invex_logo.png';
import santanderLogoPath from '@/assets/santander_logo.png';
import scotiabankLogoPath from '@/assets/scotiabank_logo.png';

// Interfaces
interface ImageUploaderProps {
  onImageChange: (url: string) => void;
  previewUrl: string | null;
  size: number;
  onSizeChange: (size: number) => void;
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

interface BankScreenConfig {
  bank: string;
  headerBackgroundColor: string;
  headerTextColor: string;
  logoSize: number;
  customLogoUrl: string | null;
  welcomeText: string;
  footerText: string;
  useWhiteLogo: boolean;
}

// Componentes auxiliares
const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageChange, previewUrl, size, onSizeChange }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageChange(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div 
        className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={handleClick}
      >
        {previewUrl ? (
          <div className="flex justify-center">
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="max-h-40 object-contain"
            />
          </div>
        ) : (
          <div className="py-4 flex flex-col items-center text-muted-foreground">
            <Upload className="h-8 w-8 mb-2" />
            <p>Haz clic para cargar imagen</p>
            <p className="text-xs">PNG, JPG, JPEG o SVG</p>
          </div>
        )}
        <input 
          type="file" 
          className="hidden" 
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>

      <div className="space-y-2">
        <Label>Tamaño de la imagen</Label>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Slider
              value={[size]}
              min={1}
              max={40}
              step={1}
              onValueChange={(val) => onSizeChange(val[0])}
            />
          </div>
          <div className="w-16">
            <Input
              type="number"
              value={size}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              min={1}
              max={40}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange }) => {
  return (
    <div className="flex flex-col space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 p-1"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
      </div>
    </div>
  );
};

const defaultConfig: BankScreenConfig = {
  bank: 'BBVA',
  headerBackgroundColor: '#072146', // Azul BBVA
  headerTextColor: '#FFFFFF',
  logoSize: 12,
  customLogoUrl: null,
  welcomeText: 'La manera más fácil y segura de realizar tus operaciones bancarias',
  footerText: '© BBVA México 2024. Todos los Derechos Reservados',
  useWhiteLogo: true
};

const getBankDefaultConfig = (bankName: string): BankScreenConfig => {
  switch (bankName) {
    case 'LIVERPOOL':
      return {
        bank: 'LIVERPOOL',
        headerBackgroundColor: '#E1147B',
        headerTextColor: '#FFFFFF',
        logoSize: 12,
        customLogoUrl: null,
        welcomeText: 'Tu experiencia de banca en línea de Liverpool, segura y confiable',
        footerText: '© Liverpool México 2024. Todos los Derechos Reservados',
        useWhiteLogo: true
      };
    case 'CITIBANAMEX':
      return {
        bank: 'CITIBANAMEX',
        headerBackgroundColor: '#0070BA',
        headerTextColor: '#FFFFFF',
        logoSize: 12,
        customLogoUrl: null,
        welcomeText: 'Banca digital segura para todos tus trámites financieros',
        footerText: '© Citibanamex México 2024. Todos los Derechos Reservados',
        useWhiteLogo: true
      };
    case 'BANBAJIO':
      return {
        bank: 'BANBAJIO',
        headerBackgroundColor: '#4D2C91',
        headerTextColor: '#FFFFFF',
        logoSize: 12,
        customLogoUrl: null,
        welcomeText: 'Banca en línea de BanBajío, tu aliado financiero',
        footerText: '© BanBajío México 2024. Todos los Derechos Reservados',
        useWhiteLogo: true
      };
    case 'BANORTE':
      return {
        bank: 'BANORTE',
        headerBackgroundColor: '#EC1C24',
        headerTextColor: '#FFFFFF',
        logoSize: 20,
        customLogoUrl: null,
        welcomeText: 'Tu banca en línea, más segura y con mayor protección',
        footerText: '© Banorte México 2024. Todos los Derechos Reservados',
        useWhiteLogo: false
      };
    case 'BANCOPPEL':
      return {
        bank: 'BANCOPPEL',
        headerBackgroundColor: '#0066B3',
        headerTextColor: '#FFFFFF',
        logoSize: 20,
        customLogoUrl: null,
        welcomeText: 'La llave a tu mundo financiero',
        footerText: '© BanCoppel México 2024. Todos los Derechos Reservados',
        useWhiteLogo: false
      };
    case 'HSBC':
      return {
        bank: 'HSBC',
        headerBackgroundColor: '#FFFFFF',
        headerTextColor: '#000000',
        logoSize: 28,
        customLogoUrl: null,
        welcomeText: 'El banco local con perspectiva global',
        footerText: '© HSBC México 2024. Todos los Derechos Reservados',
        useWhiteLogo: false
      };
    case 'AMEX':
      return {
        bank: 'AMEX',
        headerBackgroundColor: '#0077C8',
        headerTextColor: '#FFFFFF',
        logoSize: 20,
        customLogoUrl: null,
        welcomeText: 'Bienvenido a American Express',
        footerText: '© American Express México 2024. Todos los Derechos Reservados',
        useWhiteLogo: false
      };
    case 'SANTANDER':
      return {
        bank: 'SANTANDER',
        headerBackgroundColor: '#EC0000',
        headerTextColor: '#FFFFFF',
        logoSize: 28,
        customLogoUrl: null,
        welcomeText: 'Bienvenido a Santander, tu banco de confianza',
        footerText: '© Santander México 2024. Todos los Derechos Reservados',
        useWhiteLogo: true
      };
    case 'SCOTIABANK':
      return {
        bank: 'SCOTIABANK',
        headerBackgroundColor: '#EC111A',
        headerTextColor: '#FFFFFF',
        logoSize: 28,
        customLogoUrl: null,
        welcomeText: 'Bienvenido a Scotiabank, tu banco con más posibilidades',
        footerText: '© Scotiabank México 2024. Todos los Derechos Reservados',
        useWhiteLogo: true
      };
    case 'INVEX':
      return {
        bank: 'INVEX',
        headerBackgroundColor: '#BE0046',
        headerTextColor: '#FFFFFF',
        logoSize: 10,
        customLogoUrl: null,
        welcomeText: 'Bienvenido a INVEX Banca Digital',
        footerText: '© INVEX México 2024. Todos los Derechos Reservados',
        useWhiteLogo: true
      };
    case 'BANREGIO':
      return {
        bank: 'BANREGIO',
        headerBackgroundColor: '#FF6600',
        headerTextColor: '#FFFFFF',
        logoSize: 16,
        customLogoUrl: null,
        welcomeText: 'Bienvenido a Banregio Banca Digital',
        footerText: '© Banregio México 2024. Todos los Derechos Reservados',
        useWhiteLogo: true
      };
    case 'BBVA':
    default:
      return defaultConfig;
  }
};

const getLogoForBank = (bankName: string): string => {
  switch (bankName) {
    case 'LIVERPOOL':
      return liverpoolLogoPath;
    case 'CITIBANAMEX':
      return citibanamexLogoPath;
    case 'BANBAJIO':
      return banbajioLogoPath;
    case 'BBVA':
      return bbvaLogoWhitePath;
    case 'BANORTE':
      return banorteLogoPath;
    case 'BANCOPPEL':
      return bancoppelLogoPath;
    case 'HSBC':
      return hsbcLogoPath;
    case 'AMEX':
      return amexLogoPath;
    case 'SANTANDER':
      return santanderLogoPath;
    case 'SCOTIABANK':
      return scotiabankLogoPath;
    case 'INVEX':
      return invexLogoPath;
    case 'BANREGIO':
      return banregioLogoPath;
    default:
      return bbvaLogoWhitePath;
  }
};

// Componente principal
const BankScreenEditor: React.FC = () => {
  const { toast } = useToast();
  const [selectedBank, setSelectedBank] = useState<string>('BBVA');
  const [config, setConfig] = useState<BankScreenConfig>(defaultConfig);
  const [activeTab, setActiveTab] = useState('appearance');
  const [previewMode, setPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Inicializar la configuración cuando se cambia el banco seleccionado
  useEffect(() => {
    setConfig(getBankDefaultConfig(selectedBank));
  }, [selectedBank]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      // Aquí se implementaría la lógica para guardar la configuración
      // Por ejemplo, hacer una llamada a la API
      // await apiRequest('POST', '/api/bank-screens/config', config);
      
      // Simulamos un retardo para mostrar el estado de carga
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Configuración guardada",
        description: `La configuración para ${selectedBank} ha sido actualizada correctamente.`,
      });
    } catch (error) {
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar la configuración. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(getBankDefaultConfig(selectedBank));
    toast({
      title: "Configuración restablecida",
      description: `Se han restaurado los valores predeterminados para ${selectedBank}.`,
    });
  };

  // Renderizar la vista previa del encabezado del banco
  const renderBankPreview = () => {
    const logoSrc = config.customLogoUrl || getLogoForBank(selectedBank);
    const date = new Date().toLocaleDateString('es-MX', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });

    return (
      <div className="border rounded-md overflow-hidden">
        <div 
          style={{ 
            backgroundColor: config.headerBackgroundColor,
            color: config.headerTextColor
          }}
          className="p-4 text-center"
        >
          <div className="font-bold text-sm mb-2">{date}</div>
          <img 
            src={logoSrc} 
            className={`inline-block ${config.useWhiteLogo ? 'filter invert' : ''}`} 
            alt={selectedBank} 
            style={{ height: `${config.logoSize * 4}px` }}
          />
        </div>
        <div className="text-center mt-4 p-4">
          <p className="text-sm text-gray-600">{config.welcomeText}</p>
        </div>
        {previewMode && (
          <div 
            style={{ backgroundColor: config.headerBackgroundColor }} 
            className="text-white p-4 text-center text-sm mt-auto"
          >
            <div>{config.footerText}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editor de Pantallas de Bancos</CardTitle>
        <CardDescription>
          Personaliza la apariencia de las pantallas de los clientes para cada banco
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[70vh] overflow-y-auto">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bank-select">Seleccionar Banco</Label>
                <Select
                  value={selectedBank}
                  onValueChange={(value) => setSelectedBank(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(BankType)
                      .filter(bank => bank !== BankType.ALL && bank !== BankType.SPIN)
                      .map(bank => (
                        <SelectItem key={bank} value={bank}>
                          {bank}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 mb-4">
                  <TabsTrigger value="appearance">
                    <Palette className="h-4 w-4 mr-2" />
                    Apariencia
                  </TabsTrigger>
                  <TabsTrigger value="content">
                    <Type className="h-4 w-4 mr-2" />
                    Contenido
                  </TabsTrigger>
                  <TabsTrigger value="advanced">
                    <Layout className="h-4 w-4 mr-2" />
                    Avanzado
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="appearance" className="space-y-4">
                  <ColorPicker
                    label="Color de Fondo del Encabezado"
                    value={config.headerBackgroundColor}
                    onChange={(color: string) => setConfig({...config, headerBackgroundColor: color})}
                  />
                  
                  <ColorPicker
                    label="Color de Texto del Encabezado"
                    value={config.headerTextColor}
                    onChange={(color: string) => setConfig({...config, headerTextColor: color})}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="logo-size">Tamaño del Logo</Label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Slider
                          value={[config.logoSize]}
                          min={4}
                          max={40}
                          step={1}
                          onValueChange={(val) => setConfig({...config, logoSize: val[0]})}
                        />
                      </div>
                      <div className="w-16">
                        <Input
                          id="logo-size"
                          type="number"
                          value={config.logoSize}
                          onChange={(e) => setConfig({...config, logoSize: Number(e.target.value)})}
                          min={4}
                          max={40}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="white-logo"
                      checked={config.useWhiteLogo}
                      onCheckedChange={(checked) => setConfig({...config, useWhiteLogo: checked})}
                    />
                    <Label htmlFor="white-logo">Usar logo en color blanco</Label>
                  </div>
                </TabsContent>

                <TabsContent value="content" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="welcome-text">Texto de Bienvenida</Label>
                    <Textarea
                      id="welcome-text"
                      placeholder="Introduzca el texto de bienvenida..."
                      value={config.welcomeText}
                      onChange={(e) => setConfig({...config, welcomeText: e.target.value})}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="footer-text">Texto del Pie de Página</Label>
                    <Input
                      id="footer-text"
                      placeholder="Texto del pie de página..."
                      value={config.footerText}
                      onChange={(e) => setConfig({...config, footerText: e.target.value})}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Logo Personalizado</Label>
                    <ImageUploader
                      onImageChange={(url: string) => setConfig({...config, customLogoUrl: url})}
                      previewUrl={config.customLogoUrl}
                      size={config.logoSize}
                      onSizeChange={(size: number) => setConfig({...config, logoSize: size})}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  {previewMode ? (
                    <>
                      <PanelLeftClose className="h-4 w-4 mr-2" />
                      Vista Básica
                    </>
                  ) : (
                    <>
                      <PanelRightClose className="h-4 w-4 mr-2" />
                      Vista Completa
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                >
                  Restablecer
                </Button>
                <Button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          <div>
            <div className="rounded-md border p-4">
              <h3 className="text-sm font-medium mb-3">Vista Previa</h3>
              <div className="bg-gray-50 rounded-md p-4">
                {renderBankPreview()}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-6">
        <div className="text-xs text-muted-foreground">
          Los cambios se aplicarán a todas las nuevas sesiones después de guardar
        </div>
        <div className="text-xs text-muted-foreground">
          Última actualización: {new Date().toLocaleDateString()}
        </div>
      </CardFooter>
    </Card>
  );
};

export default BankScreenEditor;